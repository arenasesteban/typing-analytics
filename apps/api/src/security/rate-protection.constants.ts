export const RATE_LIMIT_WINDOW_MS = 60_000;

export const RATE_LIMITS = {
    register: 10,
    login: 15,
    refresh: 30,
    logout: 30,
    sessionCreate: 30,
    sessionComplete: 30,
} as const;
