import configuration from './configuration';

const ENV_KEYS = [
  'PORT',
  'NODE_ENV',
  'DATABASE_HOST',
  'DATABASE_PORT',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
  'DATABASE_NAME',
  'SOROBAN_RPC_URL',
  'STELLAR_NETWORK_PASSPHRASE',
  'CONTRACT_ID_GIST_REGISTRY',
  'STELLAR_SECRET_KEY',
  'PINATA_API_KEY',
  'PINATA_SECRET_KEY',
];

describe('configuration', () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {};
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key] as string;
    }
  });

  describe('defaults', () => {
    it('defaults the port to 3000 as a number', () => {
      const config = configuration();

      expect(config.port).toBe(3000);
      expect(typeof config.port).toBe('number');
    });

    it('defaults nodeEnv to development', () => {
      expect(configuration().nodeEnv).toBe('development');
    });

    it('defaults the database to the local gist settings', () => {
      expect(configuration().database).toEqual({
        host: 'localhost',
        port: 5432,
        user: 'gist',
        password: 'gist',
        name: 'gist',
      });
    });

    it('defaults the soroban block to the public testnet with empty credentials', () => {
      expect(configuration().soroban).toEqual({
        rpcUrl: 'https://soroban-testnet.stellar.org',
        networkPassphrase: 'Test SDF Network ; September 2015',
        contractIdGistRegistry: '',
        secretKey: '',
      });
    });

    it('defaults the ipfs block to empty strings', () => {
      expect(configuration().ipfs).toEqual({
        pinataApiKey: '',
        pinataSecretKey: '',
      });
    });
  });

  describe('environment overrides', () => {
    it('reads PORT as an integer', () => {
      process.env.PORT = '4000';

      expect(configuration().port).toBe(4000);
    });

    it('reads NODE_ENV', () => {
      process.env.NODE_ENV = 'production';

      expect(configuration().nodeEnv).toBe('production');
    });

    it('reads the database settings', () => {
      process.env.DATABASE_HOST = 'db.internal';
      process.env.DATABASE_PORT = '6543';
      process.env.DATABASE_USER = 'app';
      process.env.DATABASE_PASSWORD = 'secret';
      process.env.DATABASE_NAME = 'vertex';

      expect(configuration().database).toEqual({
        host: 'db.internal',
        port: 6543,
        user: 'app',
        password: 'secret',
        name: 'vertex',
      });
    });

    it('reads the soroban settings', () => {
      process.env.SOROBAN_RPC_URL = 'https://rpc.example.com/soroban';
      process.env.STELLAR_NETWORK_PASSPHRASE = 'Public Global Stellar Network ; September 2015';
      process.env.CONTRACT_ID_GIST_REGISTRY = 'CAAAAA';
      process.env.STELLAR_SECRET_KEY = 'SCAAAA';

      expect(configuration().soroban).toEqual({
        rpcUrl: 'https://rpc.example.com/soroban',
        networkPassphrase: 'Public Global Stellar Network ; September 2015',
        contractIdGistRegistry: 'CAAAAA',
        secretKey: 'SCAAAA',
      });
    });

    it('reads the ipfs settings', () => {
      process.env.PINATA_API_KEY = 'key';
      process.env.PINATA_SECRET_KEY = 'value';

      expect(configuration().ipfs).toEqual({
        pinataApiKey: 'key',
        pinataSecretKey: 'value',
      });
    });
  });

  describe('type coercion', () => {
    it('coerces an empty PORT back to NaN instead of the default', () => {
      process.env.PORT = '';

      expect(Number.isNaN(configuration().port)).toBe(true);
    });

    it('coerces a non-numeric DATABASE_PORT to NaN', () => {
      process.env.DATABASE_PORT = 'not-a-port';

      expect(Number.isNaN(configuration().database.port)).toBe(true);
    });

    it('truncates a fractional PORT', () => {
      process.env.PORT = '4000.9';

      expect(configuration().port).toBe(4000);
    });
  });

  describe('contract', () => {
    it('returns a fresh object on every call', () => {
      const first = configuration();
      const second = configuration();

      expect(first).not.toBe(second);
      expect(first).toEqual(second);
    });
  });
});
