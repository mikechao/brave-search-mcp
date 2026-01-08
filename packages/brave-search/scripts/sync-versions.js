#!/usr/bin/env node

/**
 * This script synchronizes version numbers between package.json and deno.json
 * It reads the version from package.json and updates it in deno.json
 */

const fs = require('fs');
const path = require('path');

// Paths to the configuration files
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const denoJsonPath = path.join(__dirname, '..', 'deno.json');

try {
  // Read the version from package.json
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const version = packageJson.version;
  
  if (!version) {
    console.error('No version found in package.json');
    process.exit(1);
  }
  
  console.log(`Found version ${version} in package.json`);
  
  // Read the deno.json file
  const denoJson = JSON.parse(fs.readFileSync(denoJsonPath, 'utf8'));
  
  // Update the version
  denoJson.version = version;
  
  // Write the updated deno.json file
  fs.writeFileSync(denoJsonPath, JSON.stringify(denoJson, null, 2) + '\n');
  
  console.log(`Updated deno.json version to ${version}`);
} catch (error) {
  console.error('Error syncing versions:', error.message);
  process.exit(1);
}