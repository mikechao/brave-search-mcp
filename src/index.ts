#!/usr/bin/env node

import process from 'node:process';
import { BraveMcpServer } from './server.js';

// Check for API key
const BRAVE_API_KEY = process.env.BRAVE_API_KEY;
if (!BRAVE_API_KEY) {
  console.error('Error: BRAVE_API_KEY environment variable is required');
  process.exit(1);
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY environment variable is required');
  process.exit(1);
}

const braveMcpServer = new BraveMcpServer(BRAVE_API_KEY);
braveMcpServer.start().catch((error) => {
  console.error('Error starting server:', error);
  process.exit(1);
});
