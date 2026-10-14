export type StoredSessionEvent =
    | {
          readonly sequence: number;
          readonly type: 'insert';
          readonly position: number;
          readonly enteredCharacter: string;
          readonly timestampMs: number;
      }
    | {
          readonly sequence: number;
          readonly type: 'backspace';
          readonly position: number;
          readonly timestampMs: number;
      };

export interface SessionEventDocument {
    readonly _id: string;
    readonly schemaVersion: 1;
    readonly events: readonly StoredSessionEvent[];
}
