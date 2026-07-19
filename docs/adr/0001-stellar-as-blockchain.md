# ADR 0001: Choice of Stellar/Soroban as the Blockchain Network

* Status: Accepted
* Deciders: VertexChain Core Team
* Date: 2026-07-17

## Context and Problem Statement

VertexChain requires a decentralized ledger to manage the registration, ownership, and tokenization of geospatial social posts ("gists"). The blockchain layer must support:
1. Ownership registry and secure, decentralized transfers of posts.
2. Low transaction latency and minimal gas fees to support social media interactions.
3. Smart contract execution for minting utility assets/tokens (Gist tokens).
4. Developer-friendly and memory-safe contract execution environments.

## Decision Drivers

* **Transaction Cost**: Social applications require highly economical transaction costs.
* **Latency**: Fast ledger confirmation times are critical for user experience.
* **Security & Safety**: Smart contracts must be written in a type-safe, memory-safe language to prevent exploits.
* **Asset Issuance**: Built-in mechanisms to easily represent tokens or standard assets.

## Considered Options

1. **Ethereum / EVM Layer 2 (e.g., Arbitrum or Optimism)**
2. **Solana**
3. **Stellar (with Soroban Smart Contracts)**

## Decision Outcome

Chosen option: **Stellar (with Soroban)**, because:
* **Low & Predictable Fees**: Transaction fees on Stellar are sub-penny (fractions of a cent), making micro-transactions for social posts viable.
* **Rust-Based Execution Engine**: Soroban uses WebAssembly (WASM) and Rust, providing robust compile-time guarantees, memory safety, and preventing common vulnerabilities associated with Solidity (e.g., reentrancy).
* **Stellar Asset Contract (SAC)**: Stellar provides built-in support for asset issuance, allowing seamless integration of the Gist Token without complex, custom ERC-20 boilerplate.
* **Speed**: Consensus is reached in 3-5 seconds, matching the latency requirements of a modern web application.

### Positive Consequences

* Secure smart contract execution using Rust.
* Predictable, ultra-low gas costs for users minting or transferring gists.
* Simplified asset integration utilizing Stellar's native token standards.

### Negative Consequences

* Smaller developer ecosystem compared to Ethereum/EVM.
* Require specialized client-side integration tools (Freighter wallet, Stellar SDK).

## Pros and Cons of the Options

### Ethereum / EVM Layer 2

* Good: Large ecosystem, mature tooling, abundance of libraries.
* Bad: Variable gas fees, complex bridging mechanics, and Solidity's historical susceptibility to security bugs.

### Solana

* Good: Extremely fast throughput, very low fees.
* Bad: High infrastructure requirements to run nodes, complex programming model, history of network congestion.

### Stellar (Soroban)

* Good: Fast settlement, low fees, native asset optimization, Rust safety.
* Bad: Ecosystem is still growing; smaller developer and validator community.
