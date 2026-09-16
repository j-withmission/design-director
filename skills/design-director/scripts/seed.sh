#!/usr/bin/env bash
# Print a random alphanumeric seed string for design direction.
# Usage: seed.sh [length]   (default 64)
#
# The entropy comes from /dev/urandom, not the model. That is the whole point:
# a model asked to "pick something random" picks the most probable thing that
# sounds random, and every run lands in the same place.
set -eu
# No pipefail: head closes the pipe early by design, and tr's SIGPIPE exit
# would otherwise fail the script.
len="${1:-64}"
LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom 2>/dev/null | head -c "$len"
echo
