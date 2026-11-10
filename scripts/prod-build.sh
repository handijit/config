#!/bin/sh
set -e

# A leftover from an earlier build must never reach the tarball.
rm -rf build
rollup -c
# Each entry imports only what the manifest promises, and every exported path exists.
node ./scripts/verify-build.mjs
