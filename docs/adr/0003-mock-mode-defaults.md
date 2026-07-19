# ADR 0003: Mock-Mode Defaults for Development and Testing

* Status: Accepted
* Deciders: VertexChain Core Team
* Date: 2026-07-17

## Context and Problem Statement

VertexChain integrates with external services:
1. **IPFS (via Pinata)** for uploading and pinning gist content JSON structures.
2. **Stellar/Soroban RPC and Network** for smart contract execution and transaction submissions.

Forcing every developer to register Pinata API keys and run local Stellar validators or configure testnet private keys upon checkout creates a massive friction barrier during onboarding and local testing. We need a default behavior that allows the system to boot and operate locally without these credentials.

## Decision Drivers

* **Developer Experience (DX)**: Zero-config or low-config local startup (run `npm run dev` and have it work).
* **Automated Testing**: CI/CD pipelines should run unit and integration tests without external network dependencies.
* **Security**: Ensure mock mode is never accidentally activated in production.

## Considered Options

1. **Fail-Fast (Strict Mode)**: Application fails to start if `PINATA_API_KEY`, `PINATA_SECRET_KEY`, or Stellar credentials are missing.
2. **Mock-Mode Defaults (Permissive Mode)**: Detect missing keys on boot and fallback to mock behavior (e.g. generating mock CIDs and mock transaction hashes) in non-production environments.

## Decision Outcome

Chosen option: **Mock-Mode Defaults (Permissive Mode)**, because:
* **Frictionless Onboarding**: Developers can clone the repository, run `npm install`, start docker containers, and run the backend immediately without having to configure third-party API accounts.
* **Robust Test Coverage**: Mock behavior permits running automated test suites (Jest/E2E) without calling rate-limited or paid APIs.
* **Graceful Degradation**: The IPFS Service detects missing keys and emits a clear system warning log: `IPFS running in DEV MODE — mock CIDs will be generated`. It then simulates pinning by returning hashes generated locally via `sha256` hashing.

### Positive Consequences

* Rapid onboarding for new contributors.
* Reliable, self-contained unit and E2E testing.
* Clear log indicators (`warn` level) denoting mock states.

### Negative Consequences

* Risk of misconfiguration in production leading to mock behavior.
* Divergence between development (using local mocks) and production (using real Stellar network and Pinata endpoints) which can hide integration bugs.

## Pros and Cons of the Options

### Fail-Fast (Strict Mode)

* Good: Guarantees that if the app runs, it is fully connected to all external services; zero chance of mocks in production.
* Bad: Blocks local dev workflow, breaks CI/CD unless fake keys are provided, requires credential setups for simple bug-fixing.

### Mock-Mode Defaults (Permissive Mode)

* Good: Smooth DX, local operations work immediately, tests run isolated from the web.
* Bad: Requires explicit checks (like checking `NODE_ENV === 'production'`) to prevent mocks in production.
