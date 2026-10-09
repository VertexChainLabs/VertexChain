import configuration from './configuration';

describe('configuration()', () => {
  const origEnv = process.env;

  beforeEach(() => {
    // Work on a clean copy so tests don't pollute each other
    process.env = { ...origEnv };
    // Ensure all config keys are absent unless the test sets them explicitly
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    delete process.env.DATABASE_HOST;
    delete process.env.DATABASE_PORT;
    delete process.env.DATABASE_USER;
    delete process.env.DATABASE_PASSWORD;
    delete process.env.DATABASE_NAME;
    delete process.env.SOROBAN_RPC_URL;
    delete process.env.STELLAR_NETWORK_PASSPHRASE;
    delete process.env.CONTRACT_ID_GIST_REGISTRY;
    delete process.env.STELLAR_SECRET_KEY;
    delete process.env.PINATA_API_KEY;
    delete process.env.PINATA_SECRET_KEY;
  });

  afterAll(() => {
    process.env = origEnv;
  });

  // ─── Defaults ─────────────────────────────────────────────────────────────

  it('defaults PORT to 3000', () => {
    expect(configuration().port).toBe(3000);
  });

  it('defaults NODE_ENV to "development"', () => {
    expect(configuration().nodeEnv).toBe('development');
  });

  it('defaults DATABASE_HOST to "localhost"', () => {
    expect(configuration().database.host).toBe('localhost');
  });

  it('defaults DATABASE_PORT to 5432', () => {
    expect(configuration().database.port).toBe(5432);
  });

  it('defaults DATABASE_USER to "gist"', () => {
    expect(configuration().database.user).toBe('gist');
  });

  it('defaults DATABASE_PASSWORD to "gist"', () => {
    expect(configuration().database.password).toBe('gist');
  });

  it('defaults DATABASE_NAME to "gist"', () => {
    expect(configuration().database.name).toBe('gist');
  });

  it('defaults SOROBAN_RPC_URL to testnet URL', () => {
    expect(configuration().soroban.rpcUrl).toBe('https://soroban-testnet.stellar.org');
  });

  it('defaults STELLAR_NETWORK_PASSPHRASE to testnet passphrase', () => {
    expect(configuration().soroban.networkPassphrase).toBe('Test SDF Network ; September 2015');
  });

  it('defaults CONTRACT_ID_GIST_REGISTRY to empty string', () => {
    expect(configuration().soroban.contractIdGistRegistry).toBe('');
  });

  // ─── Integer coercion ─────────────────────────────────────────────────────

  it('coerces PORT from env string to number', () => {
    process.env.PORT = '8080';
    expect(configuration().port).toBe(8080);
    expect(typeof configuration().port).toBe('number');
  });

  it('coerces DATABASE_PORT from env string to number', () => {
    process.env.DATABASE_PORT = '5433';
    expect(configuration().database.port).toBe(5433);
    expect(typeof configuration().database.port).toBe('number');
  });

  it('returns NaN for an invalid DATABASE_PORT (non-numeric string)', () => {
    process.env.DATABASE_PORT = 'not-a-number';
    expect(isNaN(configuration().database.port)).toBe(true);
  });

  // ─── Env overrides ────────────────────────────────────────────────────────

  it('respects SOROBAN_RPC_URL override', () => {
    process.env.SOROBAN_RPC_URL = 'https://custom-rpc.example.com';
    expect(configuration().soroban.rpcUrl).toBe('https://custom-rpc.example.com');
  });

  it('respects STELLAR_NETWORK_PASSPHRASE override', () => {
    process.env.STELLAR_NETWORK_PASSPHRASE = 'Public Global Stellar Network ; September 2015';
    expect(configuration().soroban.networkPassphrase).toBe(
      'Public Global Stellar Network ; September 2015',
    );
  });

  it('respects CONTRACT_ID_GIST_REGISTRY override', () => {
    process.env.CONTRACT_ID_GIST_REGISTRY = 'CAABC123';
    expect(configuration().soroban.contractIdGistRegistry).toBe('CAABC123');
  });

  it('respects NODE_ENV override', () => {
    process.env.NODE_ENV = 'production';
    expect(configuration().nodeEnv).toBe('production');
  });

  it('respects DATABASE_HOST override', () => {
    process.env.DATABASE_HOST = 'db.example.com';
    expect(configuration().database.host).toBe('db.example.com');
  });
});
