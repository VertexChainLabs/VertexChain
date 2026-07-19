# ADR 0004: Allowed PostgreSQL Extensions

* Status: Accepted
* Deciders: VertexChain Core Team
* Date: 2026-07-17

## Context and Problem Statement

PostgreSQL supports a wide range of extensions that expand its capabilities. However, enabling arbitrary extensions without guidelines causes:
1. **Security Vulnerabilities**: Some extensions require superuser privileges or run unverified binary/procedural code.
2. **Infrastructure Bloat & Portability Issues**: Managed database services (e.g., AWS RDS, GCP Cloud SQL) only support a restricted set of extensions. Using non-supported extensions blocks cloud migrations.
3. **Resource Leakage & Performance Degradation**: Unmanaged extensions can impact database memory and lock behavior.

We need to define a strict allowlist of authorized PostgreSQL extensions for VertexChain.

## Decision Drivers

* **Portability**: Database must run easily in Docker, standard Kubernetes PostgreSQL operators, and managed cloud databases (RDS/Cloud SQL).
* **Security**: Minimize database attack vectors.
* **Functionality**: Provide required utilities for UUID generation, query telemetry, and spatial operations.

## Considered Options

1. **Ad-Hoc / Dynamic Loading**: Let migrations enable any PostgreSQL extensions as required.
2. **Strict Allowed Extension List**: Standardize on a fixed set of extensions in SQL initialization and TypeORM migrations.

## Decision Outcome

Chosen option: **Strict Allowed Extension List**, because it ensures environment parity and cloud compatibility. The allowed list is restricted to:
* `postgis` & `postgis_topology`: Necessary for spatial types and geometry queries.
* `uuid-ossp`: For generating secure, randomized UUIDs (`gen_random_uuid()` or `uuid_generate_v4()`).
* `pg_stat_statements`: For monitoring database queries and query execution plan performance.

No other extensions are permitted in migrations or database boots.

### Positive Consequences

* Easy deployment to cloud infrastructure since these four extensions are universally supported by all major cloud SQL providers.
* Database initialization scripts remain clean and repeatable.

### Negative Consequences

* Developers must author an ADR if they need to introduce new extensions (e.g., pg_trgm, timescaledb).

## Pros and Cons of the Options

### Ad-Hoc / Dynamic Loading

* Good: Extreme flexibility; developer can enable extensions on a whim.
* Bad: Leads to deployment failures if an extension isn't installed/supported in the staging/production PostgreSQL server.

### Strict Allowed Extension List

* Good: Predictable migrations, guaranteed compatibility, robust security posture.
* Bad: Minor overhead of review if new extensions are required.
