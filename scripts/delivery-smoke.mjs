import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const apiOrigin = process.env.DELIVERY_API_URL ?? 'http://localhost:3001';
const webOrigin = process.env.DELIVERY_WEB_URL ?? 'http://localhost:3000';

const verifyExisting = process.argv.includes('--verify');

const email = process.env.DELIVERY_SMOKE_EMAIL ?? `delivery-smoke-${randomUUID()}@example.test`;

const password = process.env.DELIVERY_SMOKE_PASSWORD ?? `Smoke-${randomUUID()}-A1`;

const existingSessionId = process.env.DELIVERY_SMOKE_SESSION_ID;

async function api(path, options = {}) {
    const { method = 'GET', body, token, cookie } = options;

    const headers = { Origin: webOrigin };

    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    if (cookie) {
        headers.Cookie = cookie;
    }

    const response = await fetch(`${apiOrigin}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
    });

    const responseText = await response.text();
    const data = responseText ? JSON.parse(responseText) : null;

    if (!response.ok) {
        throw new Error(`${method} ${path}: HTTP ${response.status} ${responseText.slice(0, 500)}`);
    }

    assert.equal(
        response.headers.get('access-control-allow-origin'),
        webOrigin,
        `CORS origin mismatch for ${path}`,
    );

    return { response, data };
}

function getCookie(response) {
    const setCookie = response.headers.get('set-cookie');
    assert.ok(setCookie, 'Refresh cookie was not issued');
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
    return setCookie.split(';', 1)[0];
}

async function verifyWeb() {
    for (const path of ['/', '/login', '/register']) {
        const response = await fetch(`${webOrigin}${path}`, {
            redirect: 'manual',
            signal: AbortSignal.timeout(15000),
        });

        assert.equal(response.status, 200, `Web route ${path} is unavailable`);
    }
}

async function login() {
    const { data } = await api('/auth/login', {
        method: 'POST',
        body: { email, password },
    });

    assert.ok(data?.accessToken, 'Login did not return an access token');
    assert.equal(data.user.email, email);

    return data.accessToken;
}

async function verifyPersistedSession(token, sessionId) {
    const { data: history } = await api('/typing-sessions?page=1&pageSize=20', { token });

    assert.ok(
        history.pagination.totalItems >= 1,
        'Private history does not contain completed sessions',
    );

    const { data: overview } = await api('/analytics/overview?range=all', { token });

    assert.ok(
        overview.summary.sessionCount >= 1,
        'Historical analytics does not include the persisted session',
    );

    for (let attempt = 0; attempt < 60; attempt++) {
        const { data: detail } = await api(`/typing-sessions/${sessionId}`, { token });

        assert.equal(detail.id, sessionId);

        if (detail.behavioral.status === 'ready') {
            assert.ok(detail.typingText.text);
            assert.ok(detail.behavioral.temporal);

            return;
        }

        assert.equal(
            detail.behavioral.status,
            'pending',
            'Event delivery entered an unexpected state',
        );

        await delay(1000);
    }

    throw new Error('Behavioral event delivery did not reach READY');
}

async function run() {
    await verifyWeb();

    const { data: readiness } = await api('/health/ready');
    assert.ok(readiness);

    if (verifyExisting) {
        assert.ok(
            process.env.DELIVERY_SMOKE_EMAIL &&
                process.env.DELIVERY_SMOKE_PASSWORD &&
                existingSessionId,
            'Verification requires saved smoke credentials and session ID',
        );

        const token = await login();
        await verifyPersistedSession(token, existingSessionId);

        console.log(
            JSON.stringify({
                status: 'passed',
                mode: 'verify',
                sessionId: existingSessionId,
            }),
        );
        return;
    }

    const { response: registration, data: registered } = await api('/auth/register', {
        method: 'POST',
        body: { email, password },
    });

    assert.ok(registered.accessToken);
    assert.equal(registered.user.email, email);

    const registrationCookie = getCookie(registration);

    const { response: refreshResponse, data: refreshed } = await api('/auth/refresh', {
        method: 'POST',
        cookie: registrationCookie,
    });

    assert.ok(refreshed.accessToken);
    const refreshedCookie = getCookie(refreshResponse);

    await api('/auth/logout', {
        method: 'POST',
        cookie: refreshedCookie,
    });

    const token = await login();

    const { data: identity } = await api('/auth/me', { token });
    assert.equal(identity.email, email);

    const { data: created } = await api('/typing-sessions', {
        method: 'POST',
        token,
    });

    assert.ok(created.id);
    assert.ok(created.typingText.text);

    const inputs = Array.from(created.typingText.text, (value, index) => ({
        type: 'insert',
        value,
        timestampMs: (index + 1) * 120,
    }));

    const { data: completed } = await api(`/typing-sessions/${created.id}/complete`, {
        method: 'POST',
        token,
        body: { inputs },
    });

    assert.equal(completed.id, created.id);
    assert.equal(completed.typingText.text, created.typingText.text);

    await verifyPersistedSession(token, created.id);

    console.log(
        JSON.stringify({
            status: 'passed',
            mode: 'create',
            email,
            sessionId: created.id,
        }),
    );
}

run().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
