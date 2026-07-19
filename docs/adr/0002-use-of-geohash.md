# ADR 0002: Use of Geohash for Coarse Location Cell Partitioning

* Status: Accepted
* Deciders: VertexChain Core Team
* Date: 2026-07-17

## Context and Problem Statement

VertexChain is a geospatial social platform. However, storing precise geographic coordinates (latitude and longitude) on a public, immutable ledger like Stellar raises serious user privacy concerns (e.g., location tracking, doxxing). Additionally, direct indexing of precise floating-point coordinates is inefficient for rough proximity lookups and regional aggregation on-chain. We need a way to represent geographical regions coarsely to preserve privacy while maintaining quick lookup capabilities.

## Decision Drivers

* **Privacy**: Prevent exact location tracking from on-chain public history.
* **Query Performance**: Facilitate fast and efficient grouping/filtering by spatial regions.
* **Storage Cost**: Minimize the storage footprint of location data in on-chain smart contracts.

## Considered Options

1. **Precise Coordinates**: Storing full latitude and longitude coordinates directly on-chain.
2. **H3 Spatial Index**: Uber's hexagonal hierarchical spatial index.
3. **Geohash**: A hierarchical spatial data structure which subdivides space into buckets of grid shape (Base32 representation).

## Decision Outcome

Chosen option: **Geohash (specifically Precision 7)**, because:
* **Privacy Masking**: A Precision 7 geohash defines a grid cell of approximately 153 meters x 153 meters. This hides the user's exact coordinate while verifying they are in the immediate vicinity.
* **String-Based and Deterministic**: Geohashes are flat strings containing alphanumeric characters (Base32), making them highly compatible with standard databases (B-tree indexing) and Soroban contract storage types (`String` or `Symbol`).
* **Easy Prefix Lookups**: Coarser areas can be queried simply by doing prefix matches on the string (e.g., querying `u15ek` matches all children inside it), which simplifies querying logic.
* **Low Implementation Overhead**: Implementing a basic Geohash encoder/decoder is simple and lightweight, requiring no heavy native libraries in either the NestJS backend or Rust contracts.

### Positive Consequences

* On-chain records only link gists to coarse `location_cell` strings.
* Standard B-tree indexing on `location_cell` in Postgres provides fast local queries.
* Reduced risk of database/smart contract leakage exposing raw coordinates of user residences.

### Negative Consequences

* Grid cell distortion near the poles and boundary-discontinuity issues (points close to each other but across a grid border will have different geohashes).
* High-precision queries (e.g., exact meters) cannot be resolved via geohash alone; they must use a fallback to off-chain PostGIS spatial calculations.

## Pros and Cons of the Options

### Precise Coordinates

* Good: Simplest representation, highly accurate.
* Bad: Zero privacy on-chain, expensive to index in standard non-spatial indexes.

### H3 Spatial Index

* Good: Hexagonal cells have uniform distance to all neighbors, resolving edge boundary issues.
* Bad: Requires complex libraries (C/Rust/JS bindings) which are heavy to integrate and run on-chain/in-backend.

### Geohash

* Good: String-based, simple encoder/decoder implementation, cheap storage, hierarchical prefix matching.
* Bad: Rectangular grid distortion, boundary edge issues.
