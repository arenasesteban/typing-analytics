import { describe, expect, it } from 'vitest';

import { validateWebDeliveryConfig } from './delivery-config';

describe('Web delivery configuration', () => {
    it('accepts a secure external production API origin', () => {
        expect(
            validateWebDeliveryConfig('https://api.example.com', 'production', undefined),
        ).toEqual({ localContainerDelivery: false });
    });

    it('accepts an explicit loopback HTTP origin for local container delivery', () => {
        expect(validateWebDeliveryConfig('http://localhost:3001', 'production', 'true')).toEqual({
            localContainerDelivery: true,
        });
    });

    it.each(['127.0.0.1', '[::1]'])('accepts loopback host %s', (hostname) => {
        expect(validateWebDeliveryConfig(`http://${hostname}:3001`, 'production', 'true')).toEqual({
            localContainerDelivery: true,
        });
    });

    it('rejects missing production API configuration', () => {
        expect(() => validateWebDeliveryConfig(undefined, 'production', 'true')).toThrow(
            'NEXT_PUBLIC_API_BASE_URL is required in production',
        );
    });

    it('rejects loopback HTTP in standard production', () => {
        expect(() =>
            validateWebDeliveryConfig('http://localhost:3001', 'production', 'false'),
        ).toThrow('NEXT_PUBLIC_API_BASE_URL must be a non-local HTTPS origin in production');
    });

    it('rejects an external HTTP origin in local container delivery', () => {
        expect(() =>
            validateWebDeliveryConfig('http://api.example.com', 'production', 'true'),
        ).toThrow(
            'NEXT_PUBLIC_API_BASE_URL must be a loopback HTTP origin for local container delivery',
        );
    });

    it('rejects external HTTPS in local container delivery', () => {
        expect(() =>
            validateWebDeliveryConfig('https://api.example.com', 'production', 'true'),
        ).toThrow(
            'NEXT_PUBLIC_API_BASE_URL must be a loopback HTTP origin for local container delivery',
        );
    });

    it('rejects an unspecified bind address', () => {
        expect(() =>
            validateWebDeliveryConfig('http://0.0.0.0:3001', 'production', 'true'),
        ).toThrow(
            'NEXT_PUBLIC_API_BASE_URL must be a loopback HTTP origin for local container delivery',
        );
    });

    it('rejects enabling local delivery outside production', () => {
        expect(() =>
            validateWebDeliveryConfig('http://localhost:3001', 'development', 'true'),
        ).toThrow('LOCAL_CONTAINER_DELIVERY requires NODE_ENV=production');
    });

    it('rejects invalid local delivery flags', () => {
        expect(() =>
            validateWebDeliveryConfig('https://api.example.com', 'production', 'yes'),
        ).toThrow('LOCAL_CONTAINER_DELIVERY must be true or false');
    });

    it('rejects API origins containing paths or credentials', () => {
        expect(() =>
            validateWebDeliveryConfig('https://api.example.com/path', 'production', 'false'),
        ).toThrow('NEXT_PUBLIC_API_BASE_URL must be a valid HTTP or HTTPS origin');

        expect(() =>
            validateWebDeliveryConfig('https://user:pass@api.example.com', 'production', 'false'),
        ).toThrow('NEXT_PUBLIC_API_BASE_URL must be a valid HTTP or HTTPS origin');
    });

    it('preserves development configuration without a required public origin', () => {
        expect(validateWebDeliveryConfig(undefined, 'development', undefined)).toEqual({
            localContainerDelivery: false,
        });
    });
});
