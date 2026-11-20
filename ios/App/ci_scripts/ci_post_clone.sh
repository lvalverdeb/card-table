#!/bin/sh
# Xcode Cloud runs this right after cloning the repository, before resolving packages.
# The iOS project's Swift packages live in node_modules (Capacitor), which is not committed,
# so install the dependencies and copy the page into the native project first.
set -e
cd "$CI_PRIMARY_REPOSITORY_PATH"
if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js not found in the image; installing with Homebrew"
  brew install node
fi
node --version
npm ci
npm run sync
