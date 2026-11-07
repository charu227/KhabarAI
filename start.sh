#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if [ ! -f .env ]; then echo "Missing .env. Copy .env.example to .env and set JWT_SECRET."; exit 1; fi
[ -d node_modules ] || npm install
npm start
