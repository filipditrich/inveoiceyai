#!/usr/bin/env sh
# run eslint --fix per workspace package; fails the commit on lint errors
set -eu

bun scripts/lint-staged-eslint.mjs "$@"
