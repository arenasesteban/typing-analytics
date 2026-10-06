import { Injectable } from '@nestjs/common';
import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';

const ARGON2_MEMORY_KIB = 19 * 1024;
const ARGON2_PASSES = 2;
const ARGON2_PARALLELISM = 1;
const ARGON2_TAG_LENGTH = 32;
const ARGON2_SALT_LENGTH = 16;

const HASH_PREFIX = `$argon2id$v=19$m=${ARGON2_MEMORY_KIB},t=${ARGON2_PASSES},p=${ARGON2_PARALLELISM}$`;

function derivePasswordHash(password: string, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        argon2(
            'argon2id',
            {
                message: password,
                nonce: salt,
                parallelism: ARGON2_PARALLELISM,
                tagLength: ARGON2_TAG_LENGTH,
                memory: ARGON2_MEMORY_KIB,
                passes: ARGON2_PASSES,
            },
            (error, derivedKey) => {
                if (error !== null) {
                    reject(error);
                    return;
                }

                resolve(derivedKey);
            },
        );
    });
}

@Injectable()
export class PasswordService {
    async hash(password: string): Promise<string> {
        const salt = randomBytes(ARGON2_SALT_LENGTH);
        const derivedKey = await derivePasswordHash(password, salt);

        return [
            HASH_PREFIX,
            salt.toString('base64url'),
            '$',
            derivedKey.toString('base64url'),
        ].join('');
    }

    async verify(encodedHash: string, password: string): Promise<boolean> {
        if (!encodedHash.startsWith(HASH_PREFIX)) {
            return false;
        }

        const encodedPayload = encodedHash.slice(HASH_PREFIX.length);
        const parts = encodedPayload.split('$');

        if (parts.length !== 2) {
            return false;
        }

        const [encodedSalt, encodedDerivedKey] = parts;

        if (encodedSalt === undefined || encodedDerivedKey === undefined) {
            return false;
        }

        const salt = Buffer.from(encodedSalt, 'base64url');
        const expectedDerivedKey = Buffer.from(encodedDerivedKey, 'base64url');

        if (salt.length !== ARGON2_SALT_LENGTH || expectedDerivedKey.length !== ARGON2_TAG_LENGTH) {
            return false;
        }

        const actualDerivedKey = await derivePasswordHash(password, salt);

        return timingSafeEqual(expectedDerivedKey, actualDerivedKey);
    }
}
