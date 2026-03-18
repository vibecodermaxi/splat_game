#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

SRC_IDL="$PROJECT_ROOT/target/idl/pixel_predict.json"

if [ ! -f "$SRC_IDL" ]; then
  echo "ERROR: IDL not found at $SRC_IDL"
  echo "Run 'anchor build' first to generate the IDL."
  exit 1
fi

DEST_APP="$PROJECT_ROOT/app/src/lib/idl.json"
DEST_ORACLE="$PROJECT_ROOT/oracle/src/idl.json"

cp "$SRC_IDL" "$DEST_APP"
cp "$SRC_IDL" "$DEST_ORACLE"

echo "IDL copied successfully:"
echo "  -> $DEST_APP"
echo "  -> $DEST_ORACLE"
