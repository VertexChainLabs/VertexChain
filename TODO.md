# TODO - Stellar wallet auth + JWT protection

- [ ] Inspect existing DTOs, tests, and Soroban service to determine current author handling and any existing message/signature utilities.
- [ ] Update `Backend/package.json` to add required auth dependencies.
- [ ] Implement `AuthModule` (service/controller/strategy) with:
  - [ ] Stellar signature verification (real cryptographic verification)
  - [ ] JWT issuance + validation
  - [ ] Access + refresh token support
- [ ] Implement `AuthGuard` and public-route bypass (health + auth endpoints + read-only gist endpoints).
- [ ] Update gists POST flow:
  - [ ] Remove/ignore client-provided author
  - [ ] Bind gist author to authenticated wallet
- [ ] Wire `AuthModule` into `AppModule` and apply guard globally with exclusions.
- [ ] Update and extend E2E tests for authenticated/unauthenticated behavior.
- [ ] Run unit + e2e tests and fix any lint/type errors.

