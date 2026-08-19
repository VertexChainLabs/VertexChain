# VertexChain Contracts

On-chain infrastructure for **VertexChain** — a location-aware gist platform built on the **Stellar / Soroban** blockchain.

The contracts handle registering gists as verifiable blockchain records, organizing them by geographic location, and supplying metadata for off-chain indexers.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Rust |
| Smart Contract Framework | [Soroban SDK](https://developers.stellar.org/docs/build/smart-contracts/overview) |
| Build Tools | `cargo`, `stellar-cli` |
| Target | `wasm32-unknown-unknown` |
| License | MIT |

---

## Project Structure

```
contracts/
├── gist-registry/       # Gist registry contract
├── multisig/            # Multi-signature wallet contract
├── governance/          # Governance and proposal contract
├── batch-wallet/        # Batch wallet creation/recovery contract
├── Cargo.toml           # Workspace configuration
└── README.md
```

This is a Cargo workspace with separate packages for each contract, allowing for independent development and deployment.

---

## Available Contracts

### GistRegistry (MVP)

Location-aware gist registry for storing and retrieving gists by geographic cells.

**Data Model:**
| Field | Type | Description |
|---|---|---|
| `gist_id` | `u64` | Auto-incremented identifier |
| `author` | `Option<Address>` | Optional author address |
| `location_cell` | `String` | Coarse geographic cell (e.g. H3 or geohash) |
| `content_hash` | `String` | Content hash pointer (e.g. IPFS CID) |
| `created_at` | `u64` | Ledger timestamp at creation |

**Methods:**
- `post_gist(author, location_cell, content_hash)` - Register a new gist. Anonymous posting (`author = None`) requires no auth; a non-anonymous post (`Some(address)`) requires that address to authorize the invocation (`require_auth`), so gist attribution cannot be forged.
- `get_gist(gist_id)` - Retrieve a gist record by id
- `list_gists_by_cell(location_cell, cursor, limit)` - Paginated list of gists within a location cell

### Multisig

Multi-signature wallet contract for requiring multiple approvals before transactions can be executed.

**Features:**
- Configurable signers and threshold
- Transaction submission and approval tracking
- High-value transaction thresholds
- Event emission for all operations

**Methods:**
- `initialize(admin)` - Initialize the multisig contract
- `set_signers(caller, signers, threshold)` - Configure signers and approval threshold
- `submit_transaction(caller, to, amount, payload, asset)` - Submit a transaction for approval
- `approve_transaction(caller, tx_id)` - Approve a pending transaction
- `execute_transaction(caller, tx_id)` - Execute an approved transaction

### Governance

Governance contract for proposing and voting on configuration changes.

**Features:**
- Proposal creation with configurable duration
- Voting mechanism with approval thresholds
- Typed parameter governance: an executed proposal changes the `required_approvals` threshold the contract actually reads
- Admin and executor allow-list management

**Methods:**
- `initialize(admin, required_approvals)` - Initialize governance
- `create_proposal(proposer, config_key, config_value, duration_seconds)` - Create a proposal
- `vote_proposal(voter, proposal_id, against)` - Vote on a proposal (`against = false` approves, `true` rejects)
- `execute_proposal(caller, proposal_id)` - Execute an approved proposal
- `get_config(config_key)` - Retrieve the value of a governable parameter

**Governable config keys**

`execute_proposal` only applies proposals whose `config_key` maps to a typed,
explicitly-governable parameter. Currently there is one:

| `config_key` | Parsed value | Validation | Effect |
|---|---|---|---|
| `required_approvals` | decimal `u32` string | `1..=1_000_000` (rejects empty, non-numeric, `0`, and out-of-range) | Updates the `RequiredApprovals` threshold read by the next `execute_proposal` |

Any other key — including `admin` and `executor_allowlist`, which are managed
through their dedicated admin-only setters (`update_admin` /
`set_executor_allowlist`) — is rejected with `GovernanceError::InvalidInput`
instead of being persisted as dead storage. `get_config` returns the current
value for `required_approvals` and `None` for every other key.

### BatchWallet

Batch wallet creation and recovery contract for efficient wallet management.

**Features:**
- Batch wallet creation with duplicate detection
- Batch wallet recovery operations
- Event emission for batch operations
- Admin-controlled operations

**Methods:**
- `initialize(admin)` - Initialize the batch wallet contract
- `batch_create_wallets(caller, requests)` - Create multiple wallets in a single transaction
- `batch_recover_wallets(caller, requests)` - Recover multiple wallets in a single transaction
- `get_wallet(owner)` - Retrieve wallet information

---

## Getting Started

### Requirements

- Rust (≥ 1.70) — [install via rustup](https://rustup.rs)
- `wasm32-unknown-unknown` target
- `stellar-cli` — [install guide](https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup)

### Install Rust target

```bash
rustup target add wasm32-unknown-unknown
```

### Install Stellar CLI

```bash
cargo install --locked stellar-cli --features opt
```

### Build all contracts

```bash
cargo build --target wasm32-unknown-unknown --release
```

### Build specific contract

```bash
cd gist-registry
cargo build --target wasm32-unknown-unknown --release
```

### Test all contracts

```bash
cargo test
```

### Test specific contract

```bash
cd gist-registry
cargo test
```

### Deploy specific contract (local testnet)

```bash
cd gist-registry
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/gist_registry.wasm \
  --network testnet \
  --source <your-identity>
```

---

## Contribution Guidelines

- Modifications to contract interfaces require prior discussion via a linked issue and design documentation.
- Public functions should remain compact and well-documented.
- New functionality must be accompanied by test coverage.
- When adding new contracts, create a new package in the workspace.

---

## License

[MIT](../LICENSE)
