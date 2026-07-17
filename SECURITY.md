# Security Policy

## Supported Versions

VertexChain is currently pre-1.0 and under active development. Security reports
are accepted for the default branch and the most recent public release, when a
release exists.

| Version | Supported |
| --- | --- |
| `main` | Yes |
| Latest release | Yes |
| Older releases | Best effort |

## Reporting a Vulnerability

Please do not open a public issue for a suspected vulnerability.

**Primary contact:** [security@vertexchain.io](mailto:security@vertexchain.io)

Use GitHub private vulnerability reporting when it is available for this
repository. If private reporting is not available, email the address above or
contact maintainers privately and include enough detail to reproduce and assess
the issue.

**Operational channel:** `#vertexchain-security` (internal Slack)

Helpful details include:

- affected component: Frontend, Backend, contracts, infrastructure, or analytics
- vulnerable endpoint, contract method, or user workflow
- steps to reproduce
- expected impact and affected users
- proof-of-concept code, screenshots, or logs when safe to share
- suggested fix or mitigation, if known

Do not include secrets, private keys, seed phrases, wallet credentials, or real
user data in the report.

## Response Timeline

The project aims to follow this response process:

| Step | Target |
| --- | --- |
| Acknowledge receipt | Within 3 business days |
| Initial triage | Within 7 business days |
| Status update for accepted reports | At least every 14 days |
| Public advisory or release notes | After a fix or mitigation is available |

Complex blockchain, infrastructure, or data-integrity issues may require more
time. Maintainers will share status updates when remediation is still in
progress.

## Disclosure Policy

Please give maintainers a reasonable opportunity to investigate and remediate
before sharing details publicly. Coordinate disclosure timing with maintainers,
especially when an issue could affect user funds, location privacy, identity
privacy, data integrity, or service availability.

Public disclosure should avoid publishing exploit-ready details until users have
a fix or mitigation path.

## Security Scope

Reports are especially valuable when they affect:

- Soroban contract authorization, state integrity, or asset movement
- location privacy or deanonymization risks
- backend authentication, authorization, or rate limiting
- API access to private or sensitive user data
- frontend wallet interaction or transaction-signing flows
- infrastructure configuration that could expose secrets or production data
- IPFS content integrity or cache poisoning

Out-of-scope reports include:

- vulnerabilities that require compromised user devices or browsers
- social engineering or phishing without a technical platform flaw
- denial-of-service findings based only on extremely high traffic volume
- reports against third-party services not controlled by VertexChain

## Safe Harbor

Good-faith security research is welcome when it:

- avoids privacy violations and data destruction
- does not access, modify, or exfiltrate data that is not needed for the report
- does not disrupt service availability
- is reported privately before public disclosure

Maintainers will not pursue action against good-faith researchers who follow
this policy and avoid harming users or the project.

---

## Threat Model

This section documents the primary attack paths for VertexChain, the mitigations
in place today, who owns each control, and where the implementation lives in the
repository. It is intended for coordinated disclosure, security review, and
onboarding — not as a formal certification.

### System context

```
Client (browser / wallet)
    │  POST /gists, CSRF token, rate limit
    ▼
Backend API (NestJS)
    │  sanitize → IPFS pin → Soroban tx → Postgres + Redis cache
    ▼
Soroban (GistRegistry contract)          IPFS / Pinata gateway
    │  on-chain gist_id + content_hash       │  pinned JSON blobs
    ▼                                        ▼
Indexer worker (event poll → upsert)     Cached reads (Redis)
```

### Threat owners

| Team | Scope |
| --- | --- |
| **Platform** | Backend API, IPFS integration, Redis cache, rate limits, CSRF |
| **Blockchain** | Soroban contracts, indexer, on-chain authorization |
| **Security** | WAF, traffic rules, compliance checks, disclosure process |
| **Infrastructure** | Network policies, secrets rotation, container hardening |

---

### 1. Anonymous posting abuse

**Threat path:** An unauthenticated caller floods `POST /gists`, posts oversized or
malicious HTML content, or submits invalid coordinates to pollute the map feed.

| Stage | Attack | Mitigation | Owner | Code / PR |
| --- | --- | --- | --- | --- |
| Ingress | High-volume spam posts | Per-route throttle: 10 requests/min on `POST /gists`; global `ThrottlerGuard` | Platform | [`Backend/src/gists/gists.controller.ts`](Backend/src/gists/gists.controller.ts) — PR [#39](https://github.com/VertexChainLabs/VertexChain/pull/39), [#107](https://github.com/VertexChainLabs/VertexChain/pull/107) |
| Ingress | Cross-site request forgery on gist creation | Double-submit CSRF cookie + `x-csrf-token` header on mutating requests; `GET /csrf-token` bootstrap | Platform | [`Backend/src/common/middleware/csrf.middleware.ts`](Backend/src/common/middleware/csrf.middleware.ts) — PR [#54](https://github.com/VertexChainLabs/VertexChain/pull/54) |
| Validation | Oversized or malformed payloads | `ValidationPipe` (whitelist, forbid unknown fields); `@MaxLength(280)`, `@IsLatitude` / `@IsLongitude` on DTO | Platform | [`Backend/src/gists/dto/create-gist.dto.ts`](Backend/src/gists/dto/create-gist.dto.ts), [`Backend/test/gists.e2e.spec.ts`](Backend/test/gists.e2e.spec.ts) |
| Content | Stored XSS via gist body | `stripHtml()` sanitization before IPFS pin and DB persist | Platform | [`Backend/src/common/utils/sanitize.ts`](Backend/src/common/utils/sanitize.ts), [`Backend/src/gists/gists.service.ts`](Backend/src/gists/gists.service.ts) — Issue [#87](https://github.com/VertexChainLabs/VertexChain/issues/87), PR [#69](https://github.com/VertexChainLabs/VertexChain/pull/69) |
| Edge | Automated abuse at network layer | AWS WAF managed rule sets on public ingress | Security | [`infrastructure/terraform/waf.tf`](infrastructure/terraform/waf.tf) — PR [#515](https://github.com/VertexChainLabs/VertexChain/pull/515) |
| Edge | DDoS / port-scan patterns | VPC flow-log anomaly thresholds and traffic rules | Security | [`infrastructure/security/traffic-rules.yml`](infrastructure/security/traffic-rules.yml), [`infrastructure/scripts/analyze-traffic.sh`](infrastructure/scripts/analyze-traffic.sh) |
| Observability | Spam trend detection (no enforcement) | Analytics moderation dashboard (mock metrics for review workflows) | Platform | [`analytics/app/moderation/page.tsx`](analytics/app/moderation/page.tsx) — PR [#335](https://github.com/VertexChainLabs/VertexChain/pull/335) |

**Residual risk / planned work**

- No backend moderation queue or automated spam classifier is wired to block posts.
- Rate limits are IP/session scoped via NestJS throttler; per-wallet limits are not enforced when `author` is omitted.
- Track follow-up in Issue [#186](https://github.com/VertexChainLabs/VertexChain/issues/186).

---

### 2. IPFS / cache injection

**Threat path:** An attacker supplies or substitutes a malicious IPFS CID, poisons
the Redis cache with tampered gist rows, or serves stale content that no longer
matches the on-chain `content_hash`.

| Stage | Attack | Mitigation | Owner | Code / PR |
| --- | --- | --- | --- | --- |
| Write path | Unpinned or attacker-controlled CID written to chain/DB | Backend pins sanitized JSON via Pinata before persisting `content_hash`; retries on gateway failures | Platform | [`Backend/src/ipfs/ipfs.service.ts`](Backend/src/ipfs/ipfs.service.ts), [`Backend/src/gists/gists.service.ts`](Backend/src/gists/gists.service.ts) — PR [#105](https://github.com/VertexChainLabs/VertexChain/pull/105), [#31](https://github.com/VertexChainLabs/VertexChain/pull/31) |
| Read path | Serving poisoned rows from Redis without verification | Cache TTL + pattern invalidation; reads return DB content that was pinned at write time | Platform | [`Backend/src/cache/cache.service.ts`](Backend/src/cache/cache.service.ts), [`Backend/src/gists/gists.service.ts`](Backend/src/gists/gists.service.ts) |
| Storage | CID / content drift between IPFS and Postgres | `content_hash` column stores the Pinata-returned CID at creation time | Platform | [`Backend/src/gists/gist.repository.ts`](Backend/src/gists/gist.repository.ts), [`Backend/src/database/migrations/CreateGistsTable.ts`](Backend/src/database/migrations/CreateGistsTable.ts) |
| Monitoring | Abnormal pin growth | Prometheus alert on rapid IPFS pin increase | Security | [`infrastructure/monitoring/vertexchain-exporter-rules.yml`](infrastructure/monitoring/vertexchain-exporter-rules.yml) |
| Supply chain | Vulnerable dependencies in image | Trivy scan gates production Docker builds on CRITICAL/HIGH CVEs | Security | [`infrastructure/ci/docker-build-pipeline.yml`](infrastructure/ci/docker-build-pipeline.yml), [`.trivyignore`](.trivyignore) |

**Residual risk / planned work**

- No read-time re-fetch from IPFS with CID/content-hash verification before serving cached gists.
- No strict CID format validation (multibase/multihash checks) on ingest.
- Dev mode generates mock CIDs when Pinata keys are absent — must not be enabled in production.
- Track follow-up in Issue [#186](https://github.com/VertexChainLabs/VertexChain/issues/186).

---

### 3. Soroban replay and on-chain integrity

**Threat path:** A caller replays or duplicates gist-registration events, posts
gists without authorization, or causes the indexer to apply stale/conflicting
ledger data into Postgres.

| Stage | Attack | Mitigation | Owner | Code / PR |
| --- | --- | --- | --- | --- |
| Contract | Unauthorized `post_gist` from arbitrary caller | **Gap:** `post_gist` does not call `require_auth()`; any caller can register a gist on-chain | Blockchain | [`contracts/gist-registry/src/lib.rs`](contracts/gist-registry/src/lib.rs) — contrast with [`contracts/governance/src/lib.rs`](contracts/governance/src/lib.rs) (uses `require_auth`) |
| Contract | State integrity / asset movement in privileged contracts | `require_auth()` on governance, multisig, and batch-wallet admin paths | Blockchain | [`contracts/multisig/src/lib.rs`](contracts/multisig/src/lib.rs), [`contracts/batch-wallet/src/lib.rs`](contracts/batch-wallet/src/lib.rs) |
| Contract | Known vulnerability classes in WASM | `cargo-audit` in contract CI; audit pipeline for Soroban crates | Security | [`infrastructure/ci/contract-audit.yml`](infrastructure/ci/contract-audit.yml) — PR [#393](https://github.com/VertexChainLabs/VertexChain/pull/393), [#489](https://github.com/VertexChainLabs/VertexChain/pull/489) |
| Indexer | Re-processing the same ledger events | Ledger cursor persisted to `.indexer-cursor`; polls `getEventsSince(lastLedger)` | Blockchain | [`Backend/src/indexer/indexer.service.ts`](Backend/src/indexer/indexer.service.ts) |
| Indexer | Duplicate `stellar_gist_id` rows on replay | `upsertFromEvent` uses `ON CONFLICT (stellar_gist_id) DO UPDATE` | Blockchain | [`Backend/src/gists/gist.repository.ts`](Backend/src/gists/gist.repository.ts) |
| Backend | Fake on-chain registration in dev | `SorobanService` mock mode when `CONTRACT_ID_GIST_REGISTRY` is unset; must be disabled in production | Blockchain | [`Backend/src/soroban/soroban.service.ts`](Backend/src/soroban/soroban.service.ts) — PR [#105](https://github.com/VertexChainLabs/VertexChain/pull/105) |
| Network | Backend egress to arbitrary hosts | Kubernetes network policies and egress allowlist | Infrastructure | [`infrastructure/k8s/network-policies/backend-policy.yaml`](infrastructure/k8s/network-policies/backend-policy.yaml), [`infrastructure/k8s/network-policies/egress-allowlist.yaml`](infrastructure/k8s/network-policies/egress-allowlist.yaml) — PR [#506](https://github.com/VertexChainLabs/VertexChain/pull/506) |

**Residual risk / planned work**

- Add `require_auth()` (or signed-invocation checks) to `GistRegistry::post_gist` before mainnet.
- Wire `IndexerModule` into `AppModule` and add a `UNIQUE` constraint on `stellar_gist_id` so upsert dedup is enforced at the DB layer.
- Deduplicate by `tx_hash` / ledger sequence in addition to `stellar_gist_id`.
- Complete real Soroban RPC integration (mock mode bypasses chain-level replay guarantees).
- Track follow-up in Issue [#186](https://github.com/VertexChainLabs/VertexChain/issues/186).

---

### Threat review cadence

| Activity | Frequency | Owner |
| --- | --- | --- |
| Dependency / image scans (CI) | Every PR / build | Security |
| Contract `cargo-audit` | Every contract PR | Security + Blockchain |
| Compliance checks (`compliance-checks.sh`) | Weekly / release | Security |
| Threat model review (this document) | Quarterly or before mainnet | Security + Platform + Blockchain |
| Secret rotation | Per [`rotation-schedule.yml`](infrastructure/security/rotation-schedule.yml) | Infrastructure |

---

### Related documentation

- [Contributing — security reporting](CONTRIBUTING.md)
- [Infrastructure security hardening](infrastructure/docs/security-hardening.md)
- [Architecture — security overview](infrastructure/docs/ARCHITECTURE.md)
- [Security runbooks](infrastructure/docs/RUNBOOKS.md)
- [Contract README](contracts/README.md)
