#!/bin/sh
which npm || echo "npm not found, installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs
npm install
npm start
