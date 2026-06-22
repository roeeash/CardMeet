#!/bin/bash
echo "Building TypeScript..."
npm run build || { echo "Build failed!"; exit 1; }
echo "Starting server..."
node dist/index.js
