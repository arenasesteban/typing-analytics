import { describe, expect, it } from 'vitest';

import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
    const passwordService = new PasswordService();

    it('hashes and verifies a password using Argon2id', async () => {
        const password = 'correct-horse-battery-staple';

        const hash = await passwordService.hash(password);

        expect(hash).not.toBe(password);
        expect(hash).toMatch(/^\$argon2id\$v=19\$/);

        await expect(passwordService.verify(hash, password)).resolves.toBe(true);
        await expect(passwordService.verify(hash, 'wrong-password')).resolves.toBe(false);
    });

    it('rejects malformed password hashes', async () => {
        await expect(passwordService.verify('not-an-argon2-hash', 'some-password')).resolves.toBe(
            false,
        );
    });
});
