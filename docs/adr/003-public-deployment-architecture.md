# ADR-003 — Free-Tier Public Deployment Architecture for Typing Analytics

**Status:** Proposed  
**Scope:** Public Portfolio Deployment

## 1. Context

Typing Analytics has a reproducible full-stack application consisting of a Next.js frontend, a NestJS REST API, PostgreSQL transactional persistence, MongoDB session-event persistence, and automated validation.

The project requires a publicly accessible HTTPS demonstration that preserves authentication, ownership, persistence, behavioral analytics, and reproducible delivery.

The previously approved AWS architecture, documented in ADR-002, was designed for a temporary deployment but was not completed. Its infrastructure requirements are not compatible with the current objective of maintaining a public portfolio demonstration without mandatory paid subscriptions.

The selected architecture must therefore:

- Reuse the existing application and persistence contracts.
- Provide publicly trusted HTTPS without requiring a purchased domain.
- Use free hosting and database plans without fixed promotional expiration.
- Preserve authentication and secure refresh-cookie behavior.
- Execute PostgreSQL migrations independently of the persistent API process.
- Support recoverable event delivery through the existing transactional outbox.
- Allow controlled release promotion and operational diagnosis.
- Document provider limitations, recovery, portability, and resource lifecycle.

The objective is a public demonstration, not a commercially operated production environment with guaranteed availability.

## 2. Decision

**Typing Analytics will use Vercel Hobby for Next.js, Render Free Web Service for NestJS, Neon Free for PostgreSQL, and MongoDB Atlas Free for validated session-event documents.**

GitHub Actions remains the delivery and validation platform.

The deployment responsibilities are:

| Component              | Service            | Responsibility                                                          |
| ---------------------- | ------------------ | ----------------------------------------------------------------------- |
| Web                    | Vercel Hobby       | Next.js application and public HTTPS entry point                        |
| API                    | Render Free        | Independent NestJS REST service                                         |
| Transactional database | Neon Free          | PostgreSQL authentication, ownership, sessions, metrics, and outbox     |
| Event database         | MongoDB Atlas Free | Versioned validated session-event documents                             |
| Delivery               | GitHub Actions     | Existing quality gates, controlled migrations, and release coordination |

PostgreSQL remains the authoritative transactional datastore.

MongoDB retains the `session_events` collection and the document identity contract established in ADR-001.

The PostgreSQL transactional outbox continues coordinating recoverable, idempotent event delivery. No distributed transaction or separate messaging system is introduced.

### 2.1. Public HTTP and authentication

The browser accesses the application through a provider-managed HTTPS hostname.

The preferred integration is to expose the existing API paths through the web origin using supported Next.js or Vercel external-origin rewrites.

This approach is intended to avoid dependence on third-party browser cookies while preserving the existing REST API paths and authentication contract.

The integration must verify:

- HTTPS for all public browser requests.
- `HttpOnly` refresh cookies.
- `Secure` cookies in production.
- Compatible `SameSite`, `Path`, and cookie-domain behavior.
- Refresh-token rotation and revocation.
- Access-token handling.
- Authenticated requests and server-enforced ownership.
- Correct forwarding of request and response headers, including `Set-Cookie`.

The existing refresh-cookie path must remain compatible with the public routing strategy.

The final routing configuration is subject to implementation and browser validation. A rewrite alone does not prove cookie compatibility.

### 2.2. Persistence

Neon hosts the existing PostgreSQL schema, including users, refresh sessions, typing texts, completed sessions, metrics, and event-delivery outbox records.

MongoDB Atlas stores validated event documents associated with individual completed PostgreSQL sessions.

Both connections must use authenticated and encrypted transport.

Database credentials and connection strings must be stored outside source control and public build artifacts.

Database access must use the minimum practical permissions and network exposure supported by the selected free plans.

### 2.3. Database migrations

Production Prisma migrations must be independently executable and must not run implicitly during persistent NestJS startup.

The preferred mechanism is a controlled GitHub Actions migration job using the existing committed Prisma migrations and an authorized deployment context.

The job must:

- Run against the intended PostgreSQL database.
- Use protected credentials.
- Be associated with an authorized source revision.
- Report success or failure.
- Prevent promotion of an incompatible application revision when migrations fail.
- Avoid assuming that an application rollback reverses database migrations.

The concrete execution workflow and its failure handling will be established and verified separately before application deployment.

### 2.4. Release delivery

The existing GitHub Actions quality gates remain the validation baseline.

Public release promotion must associate the approved source revision with the deployed web and API revisions, with migration status and appropriate health and smoke verification.

Provider-side automatic deployment must not bypass the approved validation and promotion process.

The complete release coordination mechanism will be implemented only after the required service integrations are available.

## 3. Architectural Rationale

The architecture prioritizes reuse of the existing application, managed persistence, free-tier eligibility, and public demonstrability.

The previously selected AWS EC2/RDS architecture provides greater infrastructure-level control but introduces cost and operational responsibilities that are not justified by the current free-tier demonstration requirement.

A fully self-managed single-host deployment could consolidate services but would reintroduce database administration, storage durability, networking, and operational responsibilities.

Using managed PostgreSQL and MongoDB services preserves the established persistence boundaries while reducing self-managed database infrastructure.

The selected architecture introduces additional cross-provider networking, deployment coordination, usage limits, and availability dependencies. These trade-offs are accepted for a personal, non-commercial portfolio demonstration.

No unmeasured performance, uptime, or cost advantage is claimed over alternative deployments.

## 4. Deployment and Operational Strategy

### 4.1. Network and security

Vercel and Render provide public HTTPS endpoints through provider-managed hostnames and TLS.

PostgreSQL and MongoDB are accessed through authenticated encrypted connections.

Database access must be restricted to the authorized clients as far as the free-tier networking capabilities permit.

MongoDB Atlas Free does not provide private endpoints. Render may use shared regional outbound IP ranges rather than a dedicated static address.

The final Atlas access rules must be based on the actual Render outbound ranges and reviewed before allowing public API traffic.

Unrestricted database network access is not an architectural default or an accepted substitute for assessing provider connectivity.

The architecture does not require an AWS VPC, private load balancer, purchased domain, or additional paid network service.

### 4.2. Secrets

Runtime and deployment credentials must remain in protected environment configuration or GitHub Actions environment secrets.

The deployment must distinguish application credentials from database migration credentials where supported.

Secrets must not appear in source control, container images, frontend bundles, workflow logs, or published documentation.

### 4.3. Runtime recovery

Render Free may suspend the NestJS service during inactivity and restart it when traffic resumes.

The API must preserve its existing startup, health, and readiness behavior.

PostgreSQL persists completed session summaries and durable outbox records independently of the API process.

After service recovery, the existing event-delivery mechanism must resume pending deliveries without duplicate MongoDB documents.

The application must preserve the distinction between temporarily pending events and permanently unavailable historical events.

The actual cold-start duration and recovery behavior require later measurement.

### 4.4. Observability

The deployment will use provider-supported logs and the existing API liveness/readiness endpoints.

Relevant diagnostic signals include:

- Backend startup and recovery.
- Dependency connection failures.
- Migration execution results.
- Application errors.
- Transactional outbox failures and retries.
- Deployment and public smoke-test outcomes.

Logs must be sanitized and must not expose credentials or private typing-session data.

No paid observability service is required.

### 4.5. Portability and recovery

The deployment must retain versioned application code, committed Prisma migrations, and reproducible build artifacts.

PostgreSQL and MongoDB export and restore procedures must preserve their separate responsibilities and eventual-consistency relationship.

Restoration must account for PostgreSQL outbox records and MongoDB event documents, including events already delivered and removed from the outbox.

Application rollback must not assume automatic database schema rollback.

Credential rotation, controlled resource removal, and migration to other providers will be documented as operational procedures.

## 5. Free-Tier Eligibility and Resource Lifecycle

The target subscription cost is USD 0.

The selected services are subject to provider policies, quotas, and fair-use restrictions. A free plan does not imply permanent availability, unlimited use, or immunity from policy changes.

The following limits were checked against official provider documentation on 2026-11-04. Account-level availability and billing configuration must be confirmed before provisioning.

| Provider                | Documented free-tier conditions                                           | Principal limitations                                                                                           |
| ----------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Vercel Hobby            | Free personal plan without a fixed trial period                           | Non-commercial use only; execution, deployment, transfer, and log limits                                        |
| Render Free Web Service | Free instance with 750 instance-hours per workspace per month             | Idle suspension after 15 minutes; ephemeral filesystem; no one-off jobs or shell access; bandwidth/build limits |
| Neon Free               | USD 0, no credit card required, 100 CU-hours and 1 GB storage per project | Automatic compute scale-to-zero after 5 minutes; transfer, storage, and history limits                          |
| MongoDB Atlas Free      | Free cluster without a fixed expiration date; 0.5 GB storage              | Restricted regions/features, throughput limits, and pause after 30 days without connections                     |

Additional operational considerations:

- Vercel Hobby must be used only when the intended deployment complies with its personal and non-commercial restrictions.
- Render may bill for additional usage when a payment method is configured. Without a payment method, relevant quota exhaustion can suspend services or builds instead.
- Neon Free has finite compute, storage, and network allowances; scaling and restoration features differ from paid plans.
- MongoDB Atlas Free cannot be treated as an unlimited archival or high-availability storage service.
- Provider quotas and billing behavior must be reviewed in the actual account before resources are created.
- Automatic paid upgrades or billable consumption are not authorized.
- Usage monitoring must rely on each provider's available dashboard and quota information.
- Provider policy changes may require a future architecture review.

### 5.1. Provisioning gates

Before creating managed resources, verify:

1. Each selected free modality is available in the intended account.
2. No mandatory paid subscription or expiring promotional trial is required.
3. Account payment requirements and possible overage charges are understood.
4. Required regions and connectivity options are available without paid features.
5. The intended personal portfolio demonstration complies with provider terms.
6. The consequences of quota exhaustion and service suspension are documented.

If a provider cannot satisfy these conditions, dependent provisioning must stop until the architectural impact is reviewed.

No account-specific eligibility, payment configuration, or provisioned resource is asserted as verified by this ADR alone.

## 6. Consequences

The selected architecture enables a public HTTPS demonstration without requiring AWS infrastructure or a purchased domain.

It preserves the existing Next.js, NestJS, Prisma, PostgreSQL, MongoDB, authentication, and transactional outbox contracts.

It also introduces operational limitations:

- API cold starts after inactivity.
- Independent database availability and suspension.
- External network connectivity requirements.
- Multiple provider configuration surfaces.
- Limited free-tier compute, storage, transfer, and logging.
- Additional responsibility for secure credentials and controlled migrations.
- No guaranteed continuous uptime or commercial production SLA.

These limitations are accepted for the planned portfolio demonstration, subject to the eligibility and implementation gates described above.

ADR-001 remains the authoritative decision for MongoDB session-event persistence.

ADR-002 remains the historical record of the previously approved AWS deployment design. That AWS implementation was not completed and must not be represented as an operationally validated deployment.

**ADR-003 establishes the free-tier public deployment architecture without changing the application's domain or persistence responsibilities.**
