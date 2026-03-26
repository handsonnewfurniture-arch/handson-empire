#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════════════════
// HANDSON EMPIRE - COMBINED LAUNCHER
// Starts API server + runs enhanced scraper every 2 hours
// ══════════════════════════════════════════════════════════════════════════════

require('dotenv').config();
const { spawn } = require('child_process');
const { runAllScrapers } = require('./scraper-enhanced.js');

// Configuration
const SCRAPE_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
const SERVER_PORT = process.env.PORT || 3000;

console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║         🚀 HANDSON EMPIRE - FULL SYSTEM LAUNCHER v1.0                    ║
╠══════════════════════════════════════════════════════════════════════════╣
║  API Server:     http://localhost:${SERVER_PORT}                               ║
║  Admin Panel:    http://localhost:${SERVER_PORT}/admin.html                    ║
║  Scraper:        Every 2 hours (45+ sources)                             ║
║  Deduplication:  Enabled                                                 ║
╚══════════════════════════════════════════════════════════════════════════╝
`);

// Start the API server as a child process
console.log('🌐 Starting API server...');
const server = spawn('node', ['server.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: { ...process.env }
});

server.on('error', (err) => {
  console.error('❌ Server failed to start:', err.message);
});

// Give server time to start, then run initial scrape
setTimeout(async () => {
  console.log('\n🕷️ Running initial scrape...\n');
  try {
    await runAllScrapers();
    console.log('\n✅ Initial scrape complete!\n');
  } catch (err) {
    console.error('❌ Initial scrape error:', err.message);
  }

  // Schedule recurring scrapes every 2 hours
  console.log(`⏰ Next scrape scheduled in 2 hours (${new Date(Date.now() + SCRAPE_INTERVAL).toLocaleTimeString()})\n`);

  setInterval(async () => {
    console.log(`\n🕷️ [${new Date().toLocaleTimeString()}] Running scheduled scrape...\n`);
    try {
      await runAllScrapers();
      console.log(`\n✅ Scrape complete! Next run at ${new Date(Date.now() + SCRAPE_INTERVAL).toLocaleTimeString()}\n`);
    } catch (err) {
      console.error('❌ Scrape error:', err.message);
    }
  }, SCRAPE_INTERVAL);

}, 3000); // Wait 3 seconds for server to start

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  server.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down...');
  server.kill();
  process.exit(0);
});
