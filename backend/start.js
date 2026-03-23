#!/usr/bin/env node
// Smart start script - runs server or scraper based on ENTRY_SCRIPT env var
console.log('====== START.JS RUNNING ======');
console.log('ENTRY_SCRIPT env:', process.env.ENTRY_SCRIPT);
const script = process.env.ENTRY_SCRIPT || 'server.js';
console.log(`Starting: ${script}`);
require(`./${script}`);
