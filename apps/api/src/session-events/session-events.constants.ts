import { MAX_COMPLETION_INPUTS } from '../typing-sessions/typing-sessions.constants.js';

export const SESSION_EVENT_SCHEMA_VERSION = 1 as const;

export const MAX_STORED_SESSION_EVENTS = MAX_COMPLETION_INPUTS;

export const MAX_SESSION_EVENT_DOCUMENT_BYTES = 8 * 1024 * 1024;
