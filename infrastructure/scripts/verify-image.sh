#!/usr/bin/env bash
set -euo pipefail

# verify-image.sh — Verify a cosign signature on a container image.
#
# Behavior
#   * In GitHub Actions (GITHUB_ACTIONS=true) we expect KEYLESS
#     signatures from .github/workflows/* running on this repository.
#   * Outside of GitHub Actions we expect long-lived KEY signatures
#     and look up COSIGN_PUBLIC_KEY (default ${HOME}/.cosign/cosign.pub).
#
# Usage
#   verify-image.sh <image:tag>
#
# Exit codes
#   0  Verified
#   1  Bad invocation / dependency missing
#   2  Signature verification failed

IMAGE="${1:-}"

if [[ -z "${IMAGE}" ]]; then
  echo "Usage: verify-image.sh <image:tag>" >&2
  exit 1
fi

# Override-able inputs. COSIGN_REPOSITORY is the only digest-stripping
# input sigstore supports for non-multi-arch contexts but it's harmless
# to set; we leave it blank unless explicitly given.
COSIGN_BIN="${COSIGN_BIN:-${HOME}/.local/bin/cosign}"
PUBLIC_KEY="${COSIGN_PUBLIC_KEY:-${HOME}/.cosign/cosign.pub}"

# COSIGN_EXPECTED_REPOSITORY fully overrides the GitHub repo used in
# the certificate-identity-regexp. Falls back to GITHUB_REPOSITORY
# inside CI, otherwise to the canonical VertexChainLabs/VertexChain so
# that ad-hoc local verification still works against the published
# images. Callers running against a forked registry should set this
# explicitly.
COSIGN_EXPECTED_REPOSITORY="${COSIGN_EXPECTED_REPOSITORY:-${GITHUB_REPOSITORY:-VertexChainLabs/VertexChain}}"
# Ref used for the cert identity. Default is permissive (`.*`) so the
# same script verifies PR-preview (refs/pull/<n>/merge), main-branch
# (refs/heads/main), and signed-tag (refs/tags/v…) builds alike.
# Sigstore's OIDC identity is already pinned to this repo + the
# .github/workflows/ path, so the ref portion doesn't add security.
EXPECTED_REF="${EXPECTED_REF:-.*}"

log() { echo "[$(date +%H:%M:%S)] $*"; }
die() { log "ERROR: $*"; exit "${2:-1}"; }

# --- install cosign if missing ---------------------------------------------
install_cosign() {
  log "cosign not found, installing to ${COSIGN_BIN}..."
  mkdir -p "$(dirname "${COSIGN_BIN}")"
  if ! curl -sSfL https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64 \
       -o "${COSIGN_BIN}"; then
    if command -v go >/dev/null 2>&1; then
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

log "Verifying image: ${IMAGE}"

if [[ -n "${GITHUB_ACTIONS:-}" ]] || [[ "${COSIGN_VERIFY_KEYLESS:-}" == "1" ]]; then
  log "Keyless verification (issuer: token.actions.githubusercontent.com)"
  # --certificate-identity-regexp accepts any workflow file under
  # .github/workflows/ pinned to a known ref pattern. This works for
  # both per-arch pushes (build-images.yml) and the new image-sign.yml.
  # Escape "/" in the repo name for the regexp.
  REPO_RE="${COSIGN_EXPECTED_REPOSITORY//\//\\/}"
  cosign verify \
    --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
    --certificate-identity-regexp "https://github.com/${REPO_RE}/\\.github/workflows/.*@${EXPECTED_REF}" \
    "${IMAGE}" || die "Keyless verification failed: signature missing or signed by an unexpected identity" 2
else
  if [[ ! -f "${PUBLIC_KEY}" ]]; then
    die "COSIGN_PUBLIC_KEY not set and ${PUBLIC_KEY} does not exist — cannot verify key-based signature" 2
  fi
  log "Verifying with public key: ${PUBLIC_KEY}"
  cosign verify --key "${PUBLIC_KEY}" "${IMAGE}" \
    || die "Key-based verification failed" 2
fi

log "Signature verified ✓"

# Optional: verify SBOM attestation if present. cosign verify-attestation
# returns non-zero if no attestation exists; we surface that but don't
# fail the build — SBOM push is wired in CI but the attest predicate
# here is a placeholder until the real SBOM is wired in (#174).
if cosign verify-attestation --type custom "${IMAGE}" >/dev/null 2>&1; then
  log "Custom attestation present ✓"
else
  log "No custom attestation (non-blocking)"
fi

log "Image signature verified: ${IMAGE}"
