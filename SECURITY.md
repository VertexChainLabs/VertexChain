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

Use GitHub private vulnerability reporting when it is available for this
repository. If private reporting is not available, contact the maintainers
privately and include enough detail to reproduce and assess the issue.

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
