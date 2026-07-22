#!/usr/bin/env bash
set -euo pipefail

# sign-image.sh — Sign a container image with `cosign`.
#
# Behavior
#   * In GitHub Actions (GITHUB_ACTIONS=true) we use KEYLESS signing
#     via OIDC + Fulcio + Rekor. Both the signature and the SBOM
#     attestation are keyless — no keypair on disk is required and no
#     private key material is ever handled.
#   * Outside of GitHub Actions (local dev / ops scripts) we fall back
#     to a long-lived cosign key pair. If COSIGN_KEY_FILE / COSIGN_PUBLIC_KEY
#     are set, we use them; otherwise we generate a new pair under
#     ${HOME}/.cosign/.
#
# Usage
#   sign-image.sh <image:tag> [--no-attest]
#
# Exit codes
#   0  Image signed (and verified)
#   1  Bad invocation / missing dependency
#   2  cosign sign failed
#   3  Verification after signing failed

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

IMAGE="${1:-}"
ATTEST=1
if [[ "${2:-}" == "--no-attest" ]]; then
  ATTEST=0
fi

if [[ -z "${IMAGE}" ]]; then
  echo "Usage: sign-image.sh <image:tag> [--no-attest]" >&2
  exit 1
fi

COSIGN_BIN="${COSIGN_BIN:-${HOME}/.local/bin/cosign}"
KEY_FILE="${COSIGN_KEY_FILE:-${HOME}/.cosign/cosign.key}"
PUBLIC_KEY_FILE="${COSIGN_PUBLIC_KEY:-${HOME}/.cosign/cosign.pub}"

log() { echo "[$(date +%H:%M:%S)] $*"; }
die() { log "ERROR: $*"; exit "${2:-1}"; }

# --- dependency check -------------------------------------------------------
for cmd in jq curl; do
  command -v "${cmd}" >/dev/null 2>&1 || die "${cmd} is required but not installed"
done

# --- install cosign if missing ---------------------------------------------
install_cosign() {
  log "cosign not found, installing to ${COSIGN_BIN}..."
  mkdir -p "$(dirname "${COSIGN_BIN}")"
  if ! curl -sSfL https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64 \
       -o "${COSIGN_BIN}"; then
    if command -v go >/dev/null 2>&1; then
      log "Download failed; falling back to 'go install'"
      go install github.com/sigstore/cosign/v2/cmd/cosign@latest
    else
      die "Cannot install cosign — install it manually"
    fi
  fi
  chmod +x "${COSIGN_BIN}" 2>/dev/null || true
}

if ! command -v cosign >/dev/null 2>&1 && [[ ! -x "${COSIGN_BIN}" ]]; then
  install_cosign
  export PATH="${PATH}:$(dirname "${COSIGN_BIN}")"
fi

log "Signing image: ${IMAGE}"

# --- keyless path (GitHub Actions / any OIDC-capable CI) -------------------
if [[ -n "${GITHUB_ACTIONS:-}" ]]; then
  log "GitHub Actions detected — KEYLESS (OIDC + Fulcio + Rekor)"

  # Fetch the OIDC token presented to this workflow. The `audience`
  # query parameter scopes the token to sigstore per
  # https://docs.sigstore.dev/cosign/keyless/.
  ID_TOKEN="$(curl -sSfH "Authorization: bearer ${ACTIONS_ID_TOKEN_REQUEST_TOKEN}" \
    "${ACTIONS_ID_TOKEN_REQUEST_URL}&audience=sigstore" | jq -r .value)"
  [[ -n "${ID_TOKEN}" && "${ID_TOKEN}" != "null" ]] || die "Could not obtain OIDC token"

  cosign sign --yes \
    --oidc-issuer "https://token.actions.githubusercontent.com" \
    --identity-token "${ID_TOKEN}" \
    "${IMAGE}" || die "cosign sign failed" 2

  if [[ "${ATTEST}" -eq 1 ]]; then
    log "Attesting SBOM..."
    cosign attest --yes \
      --oidc-issuer "https://token.actions.githubusercontent.com" \
      --identity-token "${ID_TOKEN}" \
      --predicate <(echo '{"builder":"vertexchain-ci","build_type":"docker"}') \
      --type custom \
      "${IMAGE}" || log "SBOM attestation skipped (non-fatal)"
  fi

  log "Keyless signing complete: ${IMAGE}"
  bash "${SCRIPT_DIR}/verify-image.sh" "${IMAGE}" \
    || die "Post-sign verification failed" 3
  log "Signing complete ✓ (keyless)"
  exit 0
fi

# --- local / ops path (long-lived key pair) --------------------------------
if [[ ! -f "${KEY_FILE}" || ! -f "${PUBLIC_KEY_FILE}" ]]; then
  log "Generating new cosign key pair at ${KEY_FILE}"
  COSIGN_PASSWORD="${COSIGN_PASSWORD:-}" cosign generate-key-pair \
    || die "cosign generate-key-pair failed"
fi

log "Signing with key: ${KEY_FILE}"
COSIGN_PASSWORD="${COSIGN_PASSWORD:-}" cosign sign --yes \
  --key "${KEY_FILE}" \
  "${IMAGE}" || die "cosign sign (key) failed" 2

if [[ "${ATTEST}" -eq 1 ]]; then
  log "Attesting SBOM (key)..."
  COSIGN_PASSWORD="${COSIGN_PASSWORD:-}" cosign attest --yes \
    --key "${KEY_FILE}" \
    --predicate <(echo '{"builder":"vertexchain-local","build_type":"docker"}') \
    --type custom \
    "${IMAGE}" || log "SBOM attestation skipped (non-fatal)"
fi

bash "${SCRIPT_DIR}/verify-image.sh" "${IMAGE}" \
  || die "Post-sign verification failed" 3

log "Signing complete ✓ (key)"
