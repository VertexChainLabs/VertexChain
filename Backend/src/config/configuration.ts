export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  // Issue #2: do NOT default credentials. They must be provided via env.
  // Failing loud here prevents secret leakage via a hardcoded fallback.
  database: {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    name: process.env.DATABASE_NAME,
  },

  // Issue #16: per-IP rate limiting differentiation.
  // THROTTLE_TTL_MS / THROTTLE_LIMIT are consumed by AppModule's
  // ThrottlerModule.forRootAsync — keep keys flat (process.env flood).
  throttle: {
    ttlMs: parseInt(process.env.THROTTLE_TTL_MS ?? '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '10', 10),
  },

  soroban: {
    rpcUrl: process.env.SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org',
    networkPassphrase:
      process.env.STELLAR_NETWORK_PASSPHRASE ?? 'Test SDF Network ; September 2015',
    contractIdGistRegistry: process.env.CONTRACT_ID_GIST_REGISTRY ?? '',
    secretKey: process.env.STELLAR_SECRET_KEY ?? '',
  },

  ipfs: {
    pinataApiKey: process.env.PINATA_API_KEY ?? '',
    pinataSecretKey: process.env.PINATA_SECRET_KEY ?? '',
  },
});
