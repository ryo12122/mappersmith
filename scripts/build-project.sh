#!/bin/bash
set -euv

sh -c "NODE_ENV=production yarn build"
cp -r LICENSE README.md package.json typings lib/
cp examples/basic.js lib/example.js
