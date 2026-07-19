# ADR 0006: Hybrid On-Chain / Off-Chain Data Storage Strategy

* Status: Accepted
* Deciders: VertexChain Core Team
* Date: 2026-07-17

## Context and Problem Statement

A geospatial social post ("gist") contains multiple fields: title, description, images/media, owner ID, precise coordinate locations, and timestamps.
Storing all this data directly on a blockchain like Stellar is:
1. **Cost Prohibitive**: Blockchain storage is extremely expensive and transaction fees scale with payload size.
2. **Performance Limiting**: Large smart contract states slow down execution and exceed contract memory bounds.
3. **Privacy Infringing**: Mutating or deleting post contents is impossible once committed to a public ledger, violating data regulations (like GDPR's Right to be Forgotten).

We need a design that provides decentralized ownership validation and verification of post integrity without storing bulk data on-chain.

## Decision Drivers

* **Blockchain Scalability**: Keep on-chain state minimal.
* **Content Integrity**: Ensure users can verify that off-chain content has not been tampered with.
* **Compliance**: Support compliance standards for user data deletion or masking.

## Considered Options

1. **Fully On-Chain Storage**: Store entire JSON payload and coordinate arrays in the Soroban smart contract.
2. **Fully Off-Chain Storage**: Use a traditional PostgreSQL database and use blockchain solely for token balances.
3. **Hybrid On-Chain / Off-Chain Model**: Store a cryptographic hash (CID) and a masked coordinate (geohash) on-chain, and store raw contents in decentralized IPFS storage and Postgres cache off-chain.

## Decision Outcome

Chosen option: **Hybrid On-Chain / Off-Chain Model**, because:
* **IPFS Content-Addressing**: Raw post metadata and files are pinned to IPFS (via Pinata) yielding a cryptographic CID. The CID acts as the permanent pointer.
* **On-Chain Verification**: The Soroban `gist_registry` contract records only the `content_hash` (IPFS CID) and the masked `location_cell` (coarse geohash). This guarantees the creator's signature and prevents tampering, while keeping state tiny.
* **Performance Querying**: The NestJS backend caches the JSON content and stores precise coordinate geometries in a local PostgreSQL database with PostGIS spatial indices, ensuring high-speed feed delivery.

### Positive Consequences

* Optimal transaction throughput and ultra-low fee consumption.
* Decentralized and immutable proof of content integrity.
* Flexible data querying (radius filtering, paginated feeds) via the Postgres cache layer.

### Negative Consequences

* Relies on the availability of the IPFS gateway/network.
* If a post is deleted from Postgres/IPFS, the on-chain registry will still point to the orphaned CID (though the content itself is no longer accessible).

## Pros and Cons of the Options

### Fully On-Chain Storage

* Good: absolute data immutability, no external service dependency.
* Bad: astronomical gas/ledger fees, scaling bottlenecks, no privacy.

### Fully Off-Chain Storage

* Good: simple, familiar web architecture.
* Bad: loss of decentralized ownership proofs, vulnerability to single point of failure/database tempering.

### Hybrid Model

* Good: balance of security, efficiency, speed, cost, and basic user privacy.
* Bad: requires syncing database records with IPFS and smart contract events.
