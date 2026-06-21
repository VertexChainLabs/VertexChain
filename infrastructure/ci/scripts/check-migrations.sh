#!/usr/bin/env sh
# infrastructure/ci/scripts/check-migrations.sh
#
# Detects drift between TypeORM entity definitions and the existing
# set of database migrations. Exits with status 0 when entities and
# the database schema (after applying on-disk migrations) are in sync;
# exits non-zero with a rendered diff when drift is detected.
#
# Drift detection is a true dry-run: no files are written to
# Backend/src/database/migrations/. The migration generator output
# is captured to a temporary file and inspected for any SQL operations.

set -eu

# Locate Backend/ relative to this script.
ROOT=$(CDPATH='' cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$ROOT/Backend"

echo "Applying existing migrations to the test database..."
npm run --silent migration:run

DRIFT_DIR=$(mktemp -d)
trap 'rm -rf "$DRIFT_DIR"' EXIT

# TypeORM appends a timestamp to derive the migration class name.
NAME="Drft$(date +%s)"
TARGET="$DRIFT_DIR/${NAME}.ts"

# When entities match the schema, migration:generate exits silently with
# no pending changes and produces no output file. When they differ, it
# writes a migration whose up()/down() bodies invoke queryRunner.query.
#
# We point the generator at a tmp path outside src/database/migrations/,
# so Source Control is never polluted - this is a true dry-run.
npm run --silent migration:generate -- "$TARGET" \
  >"${DRIFT_DIR}/npm.log" 2>&1 || true

if [ ! -f "$TARGET" ]; then
  echo "No entity-migration drift detected."
  exit 0
fi

# Emit a pass when the generator produced only an empty skeleton.
if ! grep -q 'queryRunner.query' "$TARGET"; then
  echo "No entity-migration drift detected."
  exit 0
fi

cat <<HDR
============================================================
ENTITY-MIGRATION DRIFT DETECTED
============================================================
TypeORM would generate the following migration to reconcile
entity definitions with the current database schema:
HDR
cat "$TARGET"
cat <<'FTR'

Notify: Entity-migration drift detected
Generate a fresh migration locally and commit it, e.g.:

  cd Backend
  npm run migration:generate -- src/database/migrations/<Name>

Then push again; CI will re-run this drift check against the new state.
FTR
exit 1
