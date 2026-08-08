#!/bin/bash
# Launch SioneloFlow preview server detached
cd "$(dirname "$0")"
exec node serve.mjs
