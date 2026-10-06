import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { AuthSessionResponse } from '../src/auth/auth.types.js';

export const TEST_PASSWORD = 'correct-horse-battery-staple';

export async function registerTestUser(
    app: INestApplication,
    email: string,
): Promise<AuthSessionResponse> {
    const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
            email,
            password: TEST_PASSWORD,
        })
        .expect(201);

    return response.body as AuthSessionResponse;
}

export function authorizationHeader(accessToken: string): string {
    return `Bearer ${accessToken}`;
}
