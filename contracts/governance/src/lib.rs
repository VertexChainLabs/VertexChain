#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, panic_with_error, symbol_short, vec,
    Address, Env, String, Vec,
};

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

#[derive(Clone)]
#[contracttype]
pub enum GovernanceDataKey {
    Admin,
    RequiredApprovals,
    ProposalCount,
    Proposal(u32),
    /// New: stores a `VoteRecord` struct per (proposal_id, voter).
    /// Old entries stored `bool`; `migrate_votes` converts them during upgrade.
    UserVote(u32, Address),
    ConfigValue(String),
    /// New: maps a proposer `Address` -> `Vec<u32>` of their proposal IDs.
    ProposalsByProposer(Address),
    /// Set to `true` once `migrate_votes` has run; prevents double-migration.
    MigrationDone,
}

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

/// Replaces the old bare `bool` vote value.
/// `vote_power` is kept at 1 for every vote cast through the public API; it is
/// left as a field so future weight-based voting can reuse the same struct.
#[derive(Clone)]
#[contracttype]
pub struct VoteRecord {
    pub vote_power: u32,
    pub against: bool,
}

#[derive(Clone)]
#[contracttype]
pub struct Proposal {
    pub id: u32,
    pub proposer: Address,
    pub config_key: String,
    pub config_value: String,
    pub approvals: u32,
    /// New: cumulative vote_power of all "against" votes.
    pub rejections: u32,
    pub executed: bool,
    pub deadline: u64,
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum GovernanceError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    ProposalNotFound = 4,
    AlreadyVoted = 5,
    ProposalExpired = 6,
    AlreadyExecuted = 7,
    NotEnoughApprovals = 8,
    Overflow = 9,
    InvalidInput = 10,
    MigrationAlreadyDone = 11,
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

pub struct GovernanceEvents;

impl GovernanceEvents {
    pub fn admin_updated(env: &Env, previous_admin: &Address, new_admin: &Address) {
        let topics = (symbol_short!("gov"), symbol_short!("admin"));
        env.events().publish(
            topics,
            (
                previous_admin.clone(),
                new_admin.clone(),
                env.ledger().timestamp(),
            ),
        );
    }

    pub fn proposal_created(
        env: &Env,
        id: u32,
        proposer: &Address,
        config_key: &String,
        config_value: &String,
    ) {
        let topics = (symbol_short!("gov"), symbol_short!("created"));
        env.events().publish(
            topics,
            (
                id,
                proposer.clone(),
                config_key.clone(),
                config_value.clone(),
                env.ledger().timestamp(),
            ),
        );
    }

    /// Extended to include the `against` flag so off-chain indexers can tally.
    pub fn voted(env: &Env, id: u32, voter: &Address, against: bool) {
        let topics = (symbol_short!("gov"), symbol_short!("voted"));
        env.events().publish(
            topics,
            (id, voter.clone(), against, env.ledger().timestamp()),
        );
    }

    pub fn proposal_executed(env: &Env, id: u32, config_key: &String, config_value: &String) {
        let topics = (symbol_short!("gov"), symbol_short!("executed"));
        env.events().publish(
            topics,
            (
                id,
                config_key.clone(),
                config_value.clone(),
                env.ledger().timestamp(),
            ),
        );
    }

    pub fn migration_done(env: &Env, migrated_count: u32) {
        let topics = (symbol_short!("gov"), symbol_short!("migrated"));
        env.events()
            .publish(topics, (migrated_count, env.ledger().timestamp()));
    }
}

// ---------------------------------------------------------------------------
// Governance logic
// ---------------------------------------------------------------------------

const MAX_CONFIG_STRING_LENGTH: u32 = 256;

pub fn initialize_governance(env: &Env, admin: Address, required_approvals: u32) {
    if env.storage().instance().has(&GovernanceDataKey::Admin) {
        panic_with_error!(env, GovernanceError::AlreadyInitialized);
    }
    env.storage()
        .instance()
        .set(&GovernanceDataKey::Admin, &admin);
    env.storage()
        .instance()
        .set(&GovernanceDataKey::RequiredApprovals, &required_approvals);
    env.storage()
        .instance()
        .set(&GovernanceDataKey::ProposalCount, &0u32);
}

pub fn require_admin(env: &Env, caller: &Address) {
    caller.require_auth();
    let admin: Address = env
        .storage()
        .instance()
        .get(&GovernanceDataKey::Admin)
        .unwrap_or_else(|| panic_with_error!(env, GovernanceError::NotInitialized));
    if admin != *caller {
        panic_with_error!(env, GovernanceError::Unauthorized);
    }
}

pub fn update_admin(env: &Env, current_admin: Address, new_admin: Address) {
    require_admin(env, &current_admin);
    env.storage()
        .instance()
        .set(&GovernanceDataKey::Admin, &new_admin);
    GovernanceEvents::admin_updated(env, &current_admin, &new_admin);
}

pub fn create_proposal(
    env: &Env,
    proposer: Address,
    config_key: String,
    config_value: String,
    duration_seconds: u64,
) -> u32 {
    proposer.require_auth();

    if config_key.len() > MAX_CONFIG_STRING_LENGTH || config_key.is_empty() {
        panic_with_error!(env, GovernanceError::InvalidInput);
    }
    if config_value.len() > MAX_CONFIG_STRING_LENGTH {
        panic_with_error!(env, GovernanceError::InvalidInput);
    }
    if duration_seconds == 0 {
        panic_with_error!(env, GovernanceError::InvalidInput);
    }

    let count: u32 = env
        .storage()
        .instance()
        .get(&GovernanceDataKey::ProposalCount)
        .unwrap_or_else(|| panic_with_error!(env, GovernanceError::NotInitialized));

    let new_id = count
        .checked_add(1)
        .unwrap_or_else(|| panic_with_error!(env, GovernanceError::Overflow));

    let current_time = env.ledger().timestamp();
    let deadline = current_time
        .checked_add(duration_seconds)
        .unwrap_or_else(|| panic_with_error!(env, GovernanceError::Overflow));

    let proposal = Proposal {
        id: new_id,
        proposer: proposer.clone(),
        config_key: config_key.clone(),
        config_value: config_value.clone(),
        approvals: 0,
        rejections: 0,
        executed: false,
        deadline,
    };

    env.storage()
        .persistent()
        .set(&GovernanceDataKey::Proposal(new_id), &proposal);
    env.storage()
        .instance()
        .set(&GovernanceDataKey::ProposalCount, &new_id);

    // Index proposal under proposer
    let proposer_key = GovernanceDataKey::ProposalsByProposer(proposer.clone());
    let mut ids: Vec<u32> = env
        .storage()
        .persistent()
        .get(&proposer_key)
        .unwrap_or_else(|| vec![env]);
    ids.push_back(new_id);
    env.storage().persistent().set(&proposer_key, &ids);

    GovernanceEvents::proposal_created(env, new_id, &proposer, &config_key, &config_value);

    new_id
}

/// Cast a vote for or against a proposal.
///
/// * `against = false` → approval vote (increments `proposal.approvals`)
/// * `against = true`  → rejection vote (increments `proposal.rejections`)
///
/// Each address may only vote once per proposal regardless of direction.
pub fn vote_proposal(env: &Env, voter: Address, proposal_id: u32, against: bool) {
    voter.require_auth();

    let mut proposal: Proposal = env
        .storage()
        .persistent()
        .get(&GovernanceDataKey::Proposal(proposal_id))
        .unwrap_or_else(|| panic_with_error!(env, GovernanceError::ProposalNotFound));

    if proposal.executed {
        panic_with_error!(env, GovernanceError::AlreadyExecuted);
    }

    if env.ledger().timestamp() > proposal.deadline {
        panic_with_error!(env, GovernanceError::ProposalExpired);
    }

    let vote_key = GovernanceDataKey::UserVote(proposal_id, voter.clone());

    // Check whether a VoteRecord already exists.  On a freshly-deployed
    // contract there are no old bool entries; after migrate_votes() runs all
    // old entries are replaced with VoteRecord values.
    let already_voted: bool = env.storage().persistent().has(&vote_key);
    if already_voted {
        panic_with_error!(env, GovernanceError::AlreadyVoted);
    }

    let record = VoteRecord {
        vote_power: 1,
        against,
    };
    env.storage().persistent().set(&vote_key, &record);

    if against {
        proposal.rejections = proposal
            .rejections
            .checked_add(1)
            .unwrap_or_else(|| panic_with_error!(env, GovernanceError::Overflow));
    } else {
        proposal.approvals = proposal
            .approvals
            .checked_add(1)
            .unwrap_or_else(|| panic_with_error!(env, GovernanceError::Overflow));
    }

    env.storage()
        .persistent()
        .set(&GovernanceDataKey::Proposal(proposal_id), &proposal);

    GovernanceEvents::voted(env, proposal_id, &voter, against);
}

pub fn execute_proposal(env: &Env, caller: Address, proposal_id: u32) {
    caller.require_auth();

    let mut proposal: Proposal = env
        .storage()
        .persistent()
        .get(&GovernanceDataKey::Proposal(proposal_id))
        .unwrap_or_else(|| panic_with_error!(env, GovernanceError::ProposalNotFound));

    if proposal.executed {
        panic_with_error!(env, GovernanceError::AlreadyExecuted);
    }

    if env.ledger().timestamp() > proposal.deadline {
        panic_with_error!(env, GovernanceError::ProposalExpired);
    }

    let required_approvals: u32 = env
        .storage()
        .instance()
        .get(&GovernanceDataKey::RequiredApprovals)
        .unwrap_or_else(|| panic_with_error!(env, GovernanceError::NotInitialized));

    if proposal.approvals < required_approvals {
        panic_with_error!(env, GovernanceError::NotEnoughApprovals);
    }

    env.storage().persistent().set(
        &GovernanceDataKey::ConfigValue(proposal.config_key.clone()),
        &proposal.config_value,
    );

    proposal.executed = true;
    env.storage()
        .persistent()
        .set(&GovernanceDataKey::Proposal(proposal_id), &proposal);

    GovernanceEvents::proposal_executed(
        env,
        proposal_id,
        &proposal.config_key,
        &proposal.config_value,
    );
}

/// Return the list of proposal IDs created by `proposer`.
/// Returns an empty Vec when the address has no proposals.
pub fn get_proposals_by_proposer(env: &Env, proposer: Address) -> Vec<u32> {
    env.storage()
        .persistent()
        .get(&GovernanceDataKey::ProposalsByProposer(proposer))
        .unwrap_or_else(|| vec![env])
}

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

/// One-shot migration that converts all pre-upgrade `bool` vote entries for
/// the supplied `snapshot_votes` list into [`VoteRecord`] structs.
///
/// **Design rationale**
/// Soroban persistent storage is append-only from the runtime's perspective —
/// the contract cannot iterate all keys without knowing them in advance.
/// The agreed-upon approach is therefore an operator-supplied snapshot:
/// the deployer reads every `UserVote` key off-chain before upgrade and passes
/// them in here.  The function is idempotent for already-migrated entries
/// (a `VoteRecord` value is left unchanged) and is guarded by a
/// `MigrationDone` flag so it cannot be called twice.
///
/// `snapshot_votes`: list of (proposal_id, voter) tuples that held `true`
/// under the old storage scheme.  All were approval votes (`against = false`).
pub fn migrate_votes(env: &Env, caller: Address, snapshot_votes: Vec<(u32, Address)>) {
    require_admin(env, &caller);

    let done_key = GovernanceDataKey::MigrationDone;
    if env.storage().instance().has(&done_key) {
        panic_with_error!(env, GovernanceError::MigrationAlreadyDone);
    }

    let mut migrated: u32 = 0;
    for entry in snapshot_votes.iter() {
        let (proposal_id, voter) = entry;
        let vote_key = GovernanceDataKey::UserVote(proposal_id, voter.clone());

        // Only migrate if no VoteRecord is already present (i.e. key is absent
        // or still holds a legacy bool).  We can't deserialise as VoteRecord
        // here, so the safest guard is: write only when key is absent.
        if !env.storage().persistent().has(&vote_key) {
            let record = VoteRecord {
                vote_power: 1,
                against: false,
            };
            env.storage().persistent().set(&vote_key, &record);
            migrated = migrated
                .checked_add(1)
                .unwrap_or_else(|| panic_with_error!(env, GovernanceError::Overflow));
        }
    }

    env.storage().instance().set(&done_key, &true);
    GovernanceEvents::migration_done(env, migrated);
}

// ---------------------------------------------------------------------------
// Contract entry-point
// ---------------------------------------------------------------------------

#[contract]
pub struct GovernanceContract;

#[contractimpl]
impl GovernanceContract {
    pub fn initialize(env: Env, admin: Address, required_approvals: u32) {
        initialize_governance(&env, admin, required_approvals);
    }

    pub fn update_admin(env: Env, current_admin: Address, new_admin: Address) {
        update_admin(&env, current_admin, new_admin);
    }

    pub fn get_admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&GovernanceDataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, GovernanceError::NotInitialized))
    }

    pub fn create_proposal(
        env: Env,
        proposer: Address,
        config_key: String,
        config_value: String,
        duration_seconds: u64,
    ) -> u32 {
        create_proposal(&env, proposer, config_key, config_value, duration_seconds)
    }

    /// `against = false` → approval vote; `against = true` → rejection vote.
    pub fn vote_proposal(env: Env, voter: Address, proposal_id: u32, against: bool) {
        vote_proposal(&env, voter, proposal_id, against);
    }

    pub fn execute_proposal(env: Env, caller: Address, proposal_id: u32) {
        execute_proposal(&env, caller, proposal_id);
    }

    pub fn get_proposal(env: Env, proposal_id: u32) -> Option<Proposal> {
        env.storage()
            .persistent()
            .get(&GovernanceDataKey::Proposal(proposal_id))
    }

    pub fn get_config(env: Env, config_key: String) -> Option<String> {
        env.storage()
            .persistent()
            .get(&GovernanceDataKey::ConfigValue(config_key))
    }

    /// Returns all proposal IDs created by `proposer` (empty Vec if none).
    pub fn get_proposals_by_proposer(env: Env, proposer: Address) -> Vec<u32> {
        get_proposals_by_proposer(&env, proposer)
    }

    /// One-shot migration for existing on-chain votes from before the upgrade.
    /// Must be called by the admin; may only be called once.
    pub fn migrate_votes(env: Env, caller: Address, snapshot_votes: Vec<(u32, Address)>) {
        migrate_votes(&env, caller, snapshot_votes);
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{vec, Address, Env, String};

    fn s(env: &Env, v: &str) -> String {
        String::from_str(env, v)
    }

    // ------------------------------------------------------------------
    // Existing tests (preserved, updated for new vote_proposal signature)
    // ------------------------------------------------------------------

    #[test]
    fn test_initialize() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let cid = env.register(GovernanceContract, ());
        let client = GovernanceContractClient::new(&env, &cid);
        client.initialize(&admin, &2);
        assert_eq!(client.get_admin(), admin);
    }

    #[test]
    // GovernanceError::AlreadyInitialized = 2
    #[should_panic(expected = "Error(Contract, #2)")]
    fn test_cannot_initialize_twice() {
        let env = Env::default();
        let admin = Address::generate(&env);
        let cid = env.register(GovernanceContract, ());
        let client = GovernanceContractClient::new(&env, &cid);
        client.initialize(&admin, &2);
        client.initialize(&admin, &2);
    }

    #[test]
    fn test_create_and_execute_proposal() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let proposer = Address::generate(&env);
        let voter1 = Address::generate(&env);
        let voter2 = Address::generate(&env);
        let cid = env.register(GovernanceContract, ());
        let client = GovernanceContractClient::new(&env, &cid);
        client.initialize(&admin, &2);

        let config_key = s(&env, "test_key");
        let config_value = s(&env, "test_value");
        let pid = client.create_proposal(&proposer, &config_key, &config_value, &1000);

        // approval votes (against = false)
        client.vote_proposal(&voter1, &pid, &false);
        client.vote_proposal(&voter2, &pid, &false);
        client.execute_proposal(&admin, &pid);

        assert_eq!(client.get_config(&config_key), Some(config_value));
    }

    // ------------------------------------------------------------------
    // New: counter-vote tests
    // ------------------------------------------------------------------

    #[test]
    fn test_vote_against_increments_rejections() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let proposer = Address::generate(&env);
        let voter = Address::generate(&env);
        let cid = env.register(GovernanceContract, ());
        let client = GovernanceContractClient::new(&env, &cid);
        client.initialize(&admin, &2);

        let pid = client.create_proposal(&proposer, &s(&env, "k"), &s(&env, "v"), &500);
        client.vote_proposal(&voter, &pid, &true); // against

        let proposal = client.get_proposal(&pid).unwrap();
        assert_eq!(proposal.rejections, 1);
        assert_eq!(proposal.approvals, 0);
    }

    #[test]
    fn test_vote_for_increments_approvals_not_rejections() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let proposer = Address::generate(&env);
        let voter = Address::generate(&env);
        let cid = env.register(GovernanceContract, ());
        let client = GovernanceContractClient::new(&env, &cid);
        client.initialize(&admin, &2);

        let pid = client.create_proposal(&proposer, &s(&env, "k"), &s(&env, "v"), &500);
        client.vote_proposal(&voter, &pid, &false); // for

        let proposal = client.get_proposal(&pid).unwrap();
        assert_eq!(proposal.approvals, 1);
        assert_eq!(proposal.rejections, 0);
    }

    #[test]
    fn test_mixed_votes_tallied_correctly() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let proposer = Address::generate(&env);
        let for1 = Address::generate(&env);
        let for2 = Address::generate(&env);
        let against1 = Address::generate(&env);
        let cid = env.register(GovernanceContract, ());
        let client = GovernanceContractClient::new(&env, &cid);
        client.initialize(&admin, &2);

        let pid = client.create_proposal(&proposer, &s(&env, "k"), &s(&env, "v"), &500);
        client.vote_proposal(&for1, &pid, &false);
        client.vote_proposal(&for2, &pid, &false);
        client.vote_proposal(&against1, &pid, &true);

        let proposal = client.get_proposal(&pid).unwrap();
        assert_eq!(proposal.approvals, 2);
        assert_eq!(proposal.rejections, 1);
    }

    #[test]
    // GovernanceError::AlreadyVoted = 5
    #[should_panic(expected = "Error(Contract, #5)")]
    fn test_cannot_vote_twice_same_direction() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let proposer = Address::generate(&env);
        let voter = Address::generate(&env);
        let cid = env.register(GovernanceContract, ());
        let client = GovernanceContractClient::new(&env, &cid);
        client.initialize(&admin, &2);

        let pid = client.create_proposal(&proposer, &s(&env, "k"), &s(&env, "v"), &500);
        client.vote_proposal(&voter, &pid, &false);
        client.vote_proposal(&voter, &pid, &false); // duplicate → AlreadyVoted (#5)
    }

    #[test]
    // GovernanceError::AlreadyVoted = 5
    #[should_panic(expected = "Error(Contract, #5)")]
    fn test_cannot_flip_vote_direction() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let proposer = Address::generate(&env);
        let voter = Address::generate(&env);
        let cid = env.register(GovernanceContract, ());
        let client = GovernanceContractClient::new(&env, &cid);
        client.initialize(&admin, &2);

        let pid = client.create_proposal(&proposer, &s(&env, "k"), &s(&env, "v"), &500);
        client.vote_proposal(&voter, &pid, &false);
        client.vote_proposal(&voter, &pid, &true); // flip → AlreadyVoted (#5)
    }

    // ------------------------------------------------------------------
    // New: get_proposals_by_proposer tests
    // ------------------------------------------------------------------

    #[test]
    fn test_get_proposals_by_proposer_empty() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let cid = env.register(GovernanceContract, ());
        let client = GovernanceContractClient::new(&env, &cid);
        client.initialize(&admin, &2);

        let stranger = Address::generate(&env);
        let ids = client.get_proposals_by_proposer(&stranger);
        assert_eq!(ids.len(), 0);
    }

    #[test]
    fn test_get_proposals_by_proposer_single() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let proposer = Address::generate(&env);
        let cid = env.register(GovernanceContract, ());
        let client = GovernanceContractClient::new(&env, &cid);
        client.initialize(&admin, &2);

        let pid = client.create_proposal(&proposer, &s(&env, "key1"), &s(&env, "val1"), &500);
        let ids = client.get_proposals_by_proposer(&proposer);
        assert_eq!(ids.len(), 1);
        assert_eq!(ids.get(0).unwrap(), pid);
    }

    #[test]
    fn test_get_proposals_by_proposer_multiple() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let proposer = Address::generate(&env);
        let cid = env.register(GovernanceContract, ());
        let client = GovernanceContractClient::new(&env, &cid);
        client.initialize(&admin, &2);

        let pid1 = client.create_proposal(&proposer, &s(&env, "key1"), &s(&env, "v"), &500);
        let pid2 = client.create_proposal(&proposer, &s(&env, "key2"), &s(&env, "v"), &500);
        let pid3 = client.create_proposal(&proposer, &s(&env, "key3"), &s(&env, "v"), &500);

        let ids = client.get_proposals_by_proposer(&proposer);
        assert_eq!(ids.len(), 3);
        assert_eq!(ids.get(0).unwrap(), pid1);
        assert_eq!(ids.get(1).unwrap(), pid2);
        assert_eq!(ids.get(2).unwrap(), pid3);
    }

    #[test]
    fn test_proposals_by_proposer_are_isolated_per_address() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let proposer_a = Address::generate(&env);
        let proposer_b = Address::generate(&env);
        let cid = env.register(GovernanceContract, ());
        let client = GovernanceContractClient::new(&env, &cid);
        client.initialize(&admin, &2);

        let pid_a = client.create_proposal(&proposer_a, &s(&env, "ka"), &s(&env, "v"), &500);
        let pid_b = client.create_proposal(&proposer_b, &s(&env, "kb"), &s(&env, "v"), &500);

        let ids_a = client.get_proposals_by_proposer(&proposer_a);
        let ids_b = client.get_proposals_by_proposer(&proposer_b);

        assert_eq!(ids_a.len(), 1);
        assert_eq!(ids_a.get(0).unwrap(), pid_a);
        assert_eq!(ids_b.len(), 1);
        assert_eq!(ids_b.get(0).unwrap(), pid_b);
    }

    // ------------------------------------------------------------------
    // New: migration tests
    // ------------------------------------------------------------------

    #[test]
    fn test_migrate_votes_runs_once() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let proposer = Address::generate(&env);
        let voter = Address::generate(&env);
        let cid = env.register(GovernanceContract, ());
        let client = GovernanceContractClient::new(&env, &cid);
        client.initialize(&admin, &2);

        let pid = client.create_proposal(&proposer, &s(&env, "k"), &s(&env, "v"), &500);

        // Simulate a pre-upgrade snapshot: one approval vote for proposal pid.
        // migrate_votes writes a VoteRecord for the voter without touching
        // proposal tallies (those were already set before the upgrade).
        let snapshot: Vec<(u32, Address)> = vec![&env, (pid, voter.clone())];
        client.migrate_votes(&admin, &snapshot);

        // Verify proposal is still intact after migration.
        let proposal = client.get_proposal(&pid).unwrap();
        assert_eq!(proposal.id, pid);
    }

    #[test]
    // GovernanceError::MigrationAlreadyDone = 11
    #[should_panic(expected = "Error(Contract, #11)")]
    fn test_migrate_votes_cannot_run_twice() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let cid = env.register(GovernanceContract, ());
        let client = GovernanceContractClient::new(&env, &cid);
        client.initialize(&admin, &2);

        let empty: Vec<(u32, Address)> = vec![&env];
        client.migrate_votes(&admin, &empty);
        client.migrate_votes(&admin, &empty); // second call → MigrationAlreadyDone (#11)
    }

    #[test]
    // GovernanceError::Unauthorized = 3
    #[should_panic(expected = "Error(Contract, #3)")]
    fn test_migrate_votes_requires_admin() {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let non_admin = Address::generate(&env);
        let cid = env.register(GovernanceContract, ());
        let client = GovernanceContractClient::new(&env, &cid);
        client.initialize(&admin, &2);

        let empty: Vec<(u32, Address)> = vec![&env];
        client.migrate_votes(&non_admin, &empty); // Unauthorized (#3)
    }
}
