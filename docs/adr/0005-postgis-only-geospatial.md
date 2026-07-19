# ADR 0005: Use PostGIS as the Exclusive Geospatial Query Engine

* Status: Accepted
* Deciders: VertexChain Core Team
* Date: 2026-07-17

## Context and Problem Statement

VertexChain relies on spatial functionality: users can view gists on a map, search for posts in a given radius, and retrieve feeds based on location coordinates. Managing spatial data requires indexing geographical shapes (points) and calculating distances (e.g. ST_DWithin). We must choose a database platform that offers precise, optimized spatial querying.

## Decision Drivers

* **Single Source of Truth**: Minimize database sync issues (avoid syncing Postgres data with a separate spatial search engine).
* **Precision and correctness**: Calculations must handle coordinate geometry correctly (SRID 4326 / WGS84 geography standard).
* **Infrastructure Complexity**: Keep the stack simple and maintainable.

## Considered Options

1. **Hybrid Database Architecture (e.g., Postgres + Elasticsearch/MongoDB)**
2. **PostgreSQL + PostGIS Only**
3. **Application-Level Filtering**: Retrieve raw data and perform distance filtering in Node.js.

## Decision Outcome

Chosen option: **PostgreSQL + PostGIS Only**, because:
* **Rich Spatial Features**: PostGIS is the gold standard for geospatial SQL. It offers advanced operations (`ST_DWithin`, `ST_Distance`, `ST_Contains`) and supports `geography` types with spatial indexing (GiST).
* **No Synchronization Overhead**: Storing attributes and coordinates in the same relation prevents data inconsistency bugs.
* **Performance**: GiST index on the `location` column yields extremely fast radius and bounding box searches without needing Elasticsearch.
* **Standardized Spatial Projections**: Built-in support for SRID 4326 ensures accurate ellipsoidal calculations.

### Positive Consequences

* Simplified data modeling and backend codebase.
* Single backup/restore policy covers both spatial data and relational attributes.
* Fast, native performance of geospatial indexing.

### Negative Consequences

* Higher memory consumption in PostgreSQL due to spatial indexing and query processing.
* Higher CPU usage on the database cluster under heavy geo-query loads.

## Pros and Cons of the Options

### Hybrid Database Architecture (Postgres + Elasticsearch)

* Good: Highly scalable search capability, fuzzy text matching.
* Bad: Complex synchronization pipeline (e.g., Logstash or CDC), potential delay/drift in coordinates, additional servers to run.

### PostgreSQL + PostGIS Only

* Good: Consistent, standard compliance, single source of truth, powerful spatial indexing out-of-the-box.
* Bad: Places heavy query load directly on the relational database.

### Application-Level Filtering

* Good: No database extensions needed.
* Bad: Horrible performance; requires transferring large volumes of coordinates to Node.js, parsing, and filtering manually.
