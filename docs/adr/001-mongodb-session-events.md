# ADR-001 — MongoDB for Validated Typing Session Events

**Status:** Accepted  
**Scope:** Session Event Persistence

## 1. Context

Typing Analytics uses PostgreSQL as its primary transactional database, responsible for user identities, authentication, typing sessions, ownership, and final performance metrics. This architecture provides a reliable foundation for managing structured application data and preserving the consistency of completed typing sessions.

The introduction of Behavioral Analytics creates an additional persistence requirement: retaining the validated sequence of events generated during an individual typing session. Unlike final metrics, which summarize overall performance, these events preserve the information necessary to reconstruct temporal WPM and Raw WPM evolution, incorrect insertions, corrections, and character-level statistics.

Each completed session therefore requires a recoverable event history associated with its existing PostgreSQL record. This requirement introduces a distinction between transactional application data and the event documents used for session-level behavioral analysis.

## 2. Decision

**MongoDB is adopted as the dedicated datastore for validated typing session events, while PostgreSQL remains the authoritative transactional database.**

The architecture assigns responsibilities according to the nature of the information being persisted:

- **PostgreSQL:** User identities, authentication, session ownership, typing texts, completion state, final metrics, and durable event-delivery coordination.
- **MongoDB:** Versioned documents containing the validated event sequences of completed typing sessions.
- **Typing Core:** Deterministic reconstruction of typing sessions and derivation of behavioral metrics from validated events and their corresponding target text.

MongoDB uses the `session_events` collection, with **one document per completed session**. Each document is uniquely identified by the corresponding PostgreSQL session identifier (`_id`) and includes a `schemaVersion` to support future evolution of the document structure.

The event representation preserves only the information required to reconstruct the approved behavioral analysis: sequence, event type, timestamp, affected position, and entered character when applicable. Expected characters, correctness, and correction associations are reconstructed using the exact typing target and the existing typing engine.

This separation avoids duplicating derived metrics or introducing additional latency statistics into the persistence model. MongoDB does not replicate user identities, authorization relationships, or final session summaries.

## 3. Architectural Rationale

Two persistence approaches were considered: storing all typing events in PostgreSQL or introducing MongoDB as a specialized datastore alongside PostgreSQL.

A PostgreSQL-only approach would reduce infrastructure complexity and allow session summaries and their events to be managed within the same transactional system. It remains a technically valid alternative, particularly because PostgreSQL supports structured and semi-structured data.

The selected PostgreSQL–MongoDB architecture instead organizes each validated event sequence as an independent, versioned document associated with a completed session. This representation aligns with the primary access pattern of Behavioral Analytics: retrieving the complete event history of a specific session and processing it as a single unit.

**The decision prioritizes separation of persistence responsibilities and a document-oriented representation of session events.** It does not assume an unmeasured performance advantage over PostgreSQL, nor does it introduce cross-session event aggregation as a requirement.

The additional operational and consistency complexity is recognized as an explicit architectural trade-off accepted for v0.5.0.

## 4. Consistency and Delivery Strategy

Because PostgreSQL and MongoDB are independent datastores, the architecture adopts a **transactional outbox pattern with recoverable, idempotent delivery**. No distributed transaction is established between the two databases.

When the API receives a session completion request, the typing engine first replays and validates the submitted inputs. A single PostgreSQL transaction then persists the completed session metrics and records the corresponding validated event payload in a durable outbox. This guarantees that a successfully confirmed completion retains the information required for subsequent delivery.

A background delivery mechanism retrieves pending outbox records and persists their event documents in MongoDB. Each write uses the PostgreSQL session identifier as its unique document key, making repeated deliveries idempotent. After MongoDB confirms persistence, PostgreSQL records the successful delivery and the corresponding outbox entry can be removed.

The delivery mechanism supports retries and recovery following application interruptions, database failures, or unsuccessful acknowledgments. Concurrent workers coordinate through exclusive, time-limited claims so that pending work remains recoverable without producing duplicate event documents.

The architecture distinguishes three event-availability states:

| State         | Meaning                                                                              |
| ------------- | ------------------------------------------------------------------------------------ |
| `UNAVAILABLE` | A historical session without recoverable event data.                                 |
| `PENDING`     | A completed session whose validated events have not yet been confirmed in MongoDB.   |
| `READY`       | A completed session whose event document has been successfully persisted in MongoDB. |

A temporary MongoDB failure does not invalidate a session already committed in PostgreSQL. Its events remain pending until delivery succeeds. Similarly, an operational failure while retrieving an existing document must not be interpreted as historical unavailability.

The resulting consistency model is **recoverable eventual consistency**, rather than atomic consistency across both datastores.

## 5. Consequences

The decision establishes a clear separation between authoritative session records and their associated behavioral event histories. It enables deterministic reconstruction of individual sessions, versioned document storage, and recoverable event persistence without changing the established responsibilities of PostgreSQL.

This architecture also introduces additional considerations. Operating two datastores requires independent configuration, availability management, monitoring, and backup procedures. Session summaries and event documents may temporarily have different availability states, and recovery must preserve their relationship.

PostgreSQL backups must account for pending outbox records, while MongoDB backups must preserve event documents that have already been delivered. Because successfully delivered outbox entries may be removed, PostgreSQL alone is not sufficient to reconstruct every historical event sequence. A restored environment must therefore maintain or reconcile consistency between PostgreSQL sessions marked `READY` and their corresponding MongoDB documents.

These consequences are accepted as part of the architectural decision.

**This ADR establishes MongoDB as the definitive persistence destination for validated, session-level typing events in v0.5.0.** PostgreSQL remains authoritative for session identity, ownership, completion, and final metrics, while the transactional outbox provides the consistency boundary between both datastores. The decision does not expand the scope to cross-session behavioral aggregation, new latency statistics, or additional analytics resources.
