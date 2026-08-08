#!/bin/bash
cd "$(dirname "$0")"
nohup node serve.mjs </dev/null > /tmp/sioneloflow-dev.log 2>&1 &
echo $! > /tmp/sioneloflow-dev.pid
