#!/bin/bash
set -e

# Install JS dependencies after a merge so the workspace matches package-lock.json.
# This project has peer-dep conflicts (e.g. @capacitor-community/file-opener) that
# require --legacy-peer-deps to resolve. Use `npm ci` for reproducible installs;
# fall back to `npm install` if the lockfile is out of sync (e.g. after dependency
# updates landed in main).
if ! npm ci --no-audit --no-fund --legacy-peer-deps; then
  echo "npm ci failed, falling back to npm install"
  npm install --no-audit --no-fund --legacy-peer-deps
fi
