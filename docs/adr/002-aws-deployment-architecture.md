# ADR-002 — AWS Deployment Architecture for Typing Analytics

**Status:** Superseded  
**Scope:** Temporary AWS Deployment

## 1. Context

The original Typing Analytics AWS deployment proposal required selecting an infrastructure architecture that preserves the existing application, authentication, and persistence contracts while introducing secure public access, operational visibility, and controlled resource management.

The approved design targeted `us-east-1` and was intended for a temporary 48-hour demonstration rather than continuous production hosting. This creates an architectural trade-off between managed infrastructure, operational complexity, availability, reproducibility, and recurring cost.

The architecture was required to reuse the existing production containers, support PostgreSQL and MongoDB, enable secure deployment automation, and provide reproducible provisioning and resource removal procedures.

Sections 2–6 preserve the originally accepted AWS design and its trade-offs. They describe the planned architecture, not a completed deployment or verified operational experience.

## 2. Decision

**Amazon EC2 was selected to host the containerized application and MongoDB, while Amazon RDS provides managed PostgreSQL persistence.**

The architecture assigns responsibilities as follows:

- **Amazon EC2:** A Linux `t3.medium` instance hosting the existing Next.js and NestJS production containers, MongoDB 8.2, and Caddy through Docker Compose.
- **Amazon RDS:** PostgreSQL 18.6 on `db.t4g.micro`, Single-AZ, with 20 GiB of gp2 storage and private network access. The engine and instance-class combination was verified through the AWS Management Console in `us-east-1`.
- **Amazon EBS:** Encrypted 30 GiB gp3 storage supporting the EC2 runtime and persistent MongoDB data.
- **Amazon ECR:** Private distribution of version-identifiable production container images.
- **Amazon VPC:** Dedicated network isolation between the publicly accessible application entry point and private database infrastructure.
- **AWS IAM and Secrets Manager:** Protected application credentials, least-privilege access, and separation of deployment and runtime permissions.
- **Amazon CloudWatch Logs:** Centralized application and runtime logging with three-day retention.
- **GitHub Actions:** Deployment authentication through AWS OIDC federation using temporary credentials.

Caddy terminates public HTTPS connections and routes requests to the application containers. A purchased domain and managed AWS load balancer are not required.

The temporary deployment requires publicly trusted HTTPS. A free DNS hostname or another compatible certificate-validation mechanism will be selected during infrastructure configuration. The selected mechanism must support the application's authentication, secure cookies, browser-to-API communication, and public API connectivity.

The architecture uses a single publicly accessible EC2 instance with an allocated IPv4 address. PostgreSQL remains private, while the application containers and MongoDB are not directly exposed to the internet.

PostgreSQL remains the authoritative transactional datastore established by ADR-001. MongoDB retains validated session-event documents, and the existing transactional outbox continues coordinating recoverable, idempotent event delivery.

The deployment does not introduce independent worker services, container orchestration, multi-region infrastructure, or high-availability guarantees.

## 3. Architectural Rationale

Three principal compute and persistence approaches were evaluated: a fully self-managed EC2 deployment, EC2 with managed PostgreSQL, and managed container execution through ECS/Fargate.

A single EC2 instance hosting both databases would reduce the number of AWS services and consolidate infrastructure costs. However, it would transfer PostgreSQL administration, backup management, and recovery responsibilities to the application host.

ECS/Fargate would provide managed container execution and greater workload separation. Its additional networking, deployment, and operational considerations are not justified by the limited duration and expected traffic of the demonstration.

The selected EC2–RDS architecture preserves compatibility with the existing production containers while separating transactional database administration from application hosting. It was intended to provide practical exposure to AWS networking, identity, managed persistence, deployment automation, and observability without requiring a more complex orchestration platform.

MongoDB remains containerized rather than adopting Amazon DocumentDB. The existing event-persistence contract relies on standard MongoDB behavior, while DocumentDB compatibility would require independent validation and introduce additional infrastructure cost.

Public HTTPS termination through Caddy avoids the cost and operational dependencies of an Application Load Balancer. Requiring a publicly trusted certificate rather than ownership of a purchased domain preserves the security requirement without making domain registration a prerequisite.

**The decision prioritizes compatibility, reproducibility, operational learning, and cost containment over high availability and managed container orchestration.** It does not assume an unmeasured performance advantage over the rejected alternatives.

## 4. Deployment and Operational Strategy

The architecture adopts **private database networking, restricted public ingress, and identity-based operational access**.

A dedicated VPC separates the EC2 application infrastructure from private RDS subnet infrastructure spanning two Availability Zones. The application entry point accepts public HTTP and HTTPS traffic for certificate validation and secure routing. PostgreSQL accepts connections only from the authorized EC2 application infrastructure, while MongoDB communicates through the internal container network.

Application and database ports remain inaccessible directly from the internet. Administrative access uses AWS Systems Manager rather than publicly exposed SSH. The selected topology does not require an Application Load Balancer or NAT Gateway.

The proposed GitHub Actions deployment would authenticate through OIDC federation with a dedicated deployment role restricted to the authorized repository and deployment context. Its trust policy must validate the applicable OIDC claims and operate alongside the corresponding GitHub environment protections.

The EC2 runtime uses a separate IAM role with permissions limited to its operational responsibilities. Permanent AWS access keys are not required for deployment automation.

Application credentials are managed through AWS Secrets Manager and excluded from source control, production container images, and diagnostic logs. Runtime configuration must retrieve these credentials through authorized mechanisms without unnecessarily exposing their values.

Production delivery reuses the existing application Dockerfiles and independent Prisma migration image. Container images are distributed through private Amazon ECR repositories, preserving identifiable deployment artifacts without changing the application's domain or persistence contracts.

The public hostname and TLS configuration must preserve the application's authentication behavior, including secure cookies, allowed origins, and credentialed browser requests.

CloudWatch Logs provides centralized visibility into relevant web, API, proxy, and runtime events with three-day retention. Existing health and readiness endpoints remain the operational contracts for verifying application availability.

RDS backup retention must be explicitly configured. MongoDB data persists on encrypted EBS storage during the demonstration, without assuming managed backups or independent high availability.

Infrastructure provisioning and deployment follow reproducible procedures specific to the selected AWS services, without introducing a new infrastructure orchestration framework.

## 5. Cost and Resource Lifecycle

The deployment is designed for a **48-hour demonstration in `us-east-1`**, with resource usage and retention limited to the required demonstration period.

The initial cost evaluation was prepared using AWS Pricing Calculator. It reported **USD 10.09** under mixed monthly and short-duration assumptions. Adjusting only the public IPv4 charge to 48 hours yielded an indicative **USD 6.68**.

These figures are planning estimates rather than fully normalized deployment costs. They exclude unquantified transfer, DNS, applicable taxes, and residual resource usage. The estimate must be revised if the selected configuration, pricing, or resource lifetime changes.

An AWS Budgets monthly alert threshold of **USD 15** is established for the demonstration, with notifications planned at 50%, 80%, and 100%. This provides spending visibility but does not constitute an automatic spending limit.

EC2, RDS, EBS, public IPv4, ECR, CloudWatch, and Secrets Manager introduce usage-based or continuously billed resources. Stopping application containers does not eliminate these costs, and storage or retained resources may continue generating charges after the demonstration.

Provisioning and teardown must follow reproducible, documented procedures. Resource removal must explicitly account for compute instances, databases, storage volumes, snapshots, public IPv4 allocations, container images, logs, secrets, and temporary networking or identity configuration.

The lifecycle concludes only after verifying that the intended resources have been removed and identifying any retained resources or outstanding billing implications.

## 6. Consequences

The selected architecture enables a temporary AWS demonstration while preserving the existing full-stack delivery model, managed PostgreSQL persistence, MongoDB event storage, and transactional outbox consistency boundary.

It introduces infrastructure responsibilities involving network isolation, IAM permissions, container administration, TLS configuration, centralized logging, backup policies, and resource lifecycle management.

A single EC2 instance represents a shared failure domain for Next.js, NestJS, and MongoDB. RDS Single-AZ does not provide multi-AZ failover, and containerized MongoDB does not offer independent high availability or managed backup guarantees.

Because successfully delivered outbox records may be removed from PostgreSQL, losing MongoDB storage can permanently remove historical event documents. PostgreSQL alone cannot reconstruct every previously delivered event sequence. This limitation is accepted only for a disposable demonstration using synthetic data and does not supersede ADR-001.

The public HTTPS topology depends on obtaining a suitable hostname and maintaining compatibility with the application's authentication behavior. The selected compute capacity must also accommodate the combined container workloads. These constraints require operational validation without changing the architectural responsibilities established here.

Operational, recovery, availability, and residual-cost limitations are explicitly accepted within the temporary demonstration scope.

**This ADR records the AWS architecture originally selected for v0.8.0.** It preserves the rationale, security boundaries, operational assumptions, and trade-offs of that decision. Its replacement and partial implementation outcome are recorded below; it no longer defines the active v0.8.0 deployment.

## 7. Implementation Outcome and Supersession

### 7.1. Partial provisioning and observed deviations

The original design was partially provisioned before the AWS work was discontinued. The implementation diverged from the approved configuration in the following ways:

| Component                  | Original design                            | Provisioning outcome                                                                                                                     |
| -------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Region                     | `us-east-1`                                | `us-east-2` (Ohio)                                                                                                                       |
| EC2                        | `t3.medium`                                | `m7i-flex.large`                                                                                                                         |
| EBS                        | Encrypted 30 GiB gp3                       | Initial 8 GiB volume; expansion to 30 GiB was not confirmed                                                                              |
| MongoDB                    | `mongo:8.2`                                | `mongo:8.0` used during infrastructure preparation                                                                                       |
| RDS                        | PostgreSQL 18.6, `db.t4g.micro`, Single-AZ | RDS provisioned in `us-east-2`; complete application connectivity and TLS verification were not established as final acceptance evidence |
| Public entry point         | Caddy and trusted HTTPS                    | Caddy and an `sslip.io` hostname were prepared; full application routing was not deployed                                                |
| GitHub deployment identity | AWS OIDC provider and deployment role      | Federation was not completed or validated through AWS CLI and a GitHub Actions deployment workflow                                       |

Networking, runtime access, secrets, logging, and database preparations were undertaken, but partial provisioning does not establish satisfaction of every original acceptance criterion. Proposed alternatives involving GHCR and deployment through Session Manager were discussed but were not implemented or accepted as the final AWS delivery architecture.

### 7.2. Uncompleted validation and delivery

The AWS implementation did not complete the production deployment of Next.js and NestJS, execution of the independent Prisma migration image, deployment automation through GitHub Actions, full end-to-end verification of the public application, or a documented successful 48-hour demonstration. Full infrastructure teardown and final billing reconciliation are not attested by this ADR.

The AWS OIDC limitation was investigated through account and console restrictions, but an AWS CLI creation attempt was not completed. This record therefore does not claim a definitive CLI test outcome. The account eligibility and cost constraints made continuing the AWS implementation unacceptable for the project.

**The existence of this ADR and the partial infrastructure work are evidence of architecture planning and limited provisioning activities, not proof of a completed AWS deployment, operational AWS proficiency, or an AWS-based CI/CD implementation.**

### 7.3. Supersession and future work

The project subsequently approved **v0.8.0 — Public Deployment** using Vercel Hobby for Next.js, Render Free for NestJS, Neon Free for PostgreSQL, and MongoDB Atlas Free for session-event documents, subject to technical validation of authentication, database connectivity, migrations, the transactional outbox, and provider limitations. The detailed active deployment decision belongs in **ADR-003 — Public Deployment Architecture**.

ADR-002 is retained unchanged in architectural intent as a historical record. It must not be rewritten to portray GHCR, manual EC2 promotion, or the new multi-provider hosting design as the original AWS decision.

An AWS deployment may be reconsidered as **optional future work**, only after a new review of account eligibility, costs, service availability, security, and operational requirements. Such work would require a new approval and fresh validation; no AWS deployment or AWS expertise is implied by retaining this document.
