#!/usr/bin/env node
/**
 * APIprox Clean Script
 *
 * Removes build artifacts and dependencies to reclaim disk space.
 * Usage:
 *   npm run clean               — removes all artifacts (Rust target + all node_modules/dist)
 *   npm run clean:rust          — removes only the Rust target dir (biggest offender)
 *
 * Flags:
 *   --keep-vendor               — skip cleaning vendor/APInox artifacts
 *   --keep-node-modules         — keep node_modules (only remove dist/target)
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const root       = path.join(__dirname, '..');

const args           = process.argv.slice(2);
const keepVendor     = args.includes('--keep-vendor');
const keepNodeMods   = args.includes('--keep-node-modules');

// ── Directories to remove ────────────────────────────────────────────────
const targets = [
  // Rust build output — by far the biggest (can exceed 10 GB)
  path.join(root, 'src-tauri', 'target'),

  // Webview build output
  path.join(root, 'src-tauri', 'webview', 'dist'),
];

if (!keepNodeMods) {
  targets.push(
    // Webview node_modules
    path.join(root, 'src-tauri', 'webview', 'node_modules'),
  );
}

if (!keepVendor) {
  targets.push(
    // APInox submodule Rust target
    path.join(root, 'vendor', 'APInox', 'src-tauri', 'target'),

    // APInox webview node_modules + dist
    path.join(root, 'vendor', 'APInox', 'src-tauri', 'webview', 'dist'),

    // request-editor package
    path.join(root, 'vendor', 'APInox', 'packages', 'request-editor', 'dist'),
  );

  if (!keepNodeMods) {
    targets.push(
      path.join(root, 'vendor', 'APInox', 'src-tauri', 'webview', 'node_modules'),
      path.join(root, 'vendor', 'APInox', 'packages', 'request-editor', 'node_modules'),
      path.join(root, 'vendor', 'APInox', 'packages', 'wsdl-parser', 'node_modules'),
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 ** 2)  return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3)  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function dirSize(dir) {
  let total = 0;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) total += dirSize(full);
      else total += fs.statSync(full).size;
    }
  } catch { /* ignore permission errors */ }
  return total;
}

function removeDir(dir) {
  const rel = path.relative(root, dir);
  if (!fs.existsSync(dir)) {
    console.log(`  skip   ${rel}  (not found)`);
    return 0;
  }
  const size = dirSize(dir);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`  removed ${rel}  (${formatBytes(size)})`);
  return size;
}

function removeFile(file, label) {
  if (!fs.existsSync(file)) {
    console.log(`  skip   ${label}  (not found)`);
    return 0;
  }
  const size = fs.statSync(file).size;
  fs.rmSync(file, { force: true });
  console.log(`  removed ${label}  (${formatBytes(size)})`);
  return size;
}

// ── Main ─────────────────────────────────────────────────────────────────
console.log('\nAPIprox — cleaning build artifacts\n');
if (keepVendor)   console.log('  (--keep-vendor: skipping vendor artifacts)');
if (keepNodeMods) console.log('  (--keep-node-modules: keeping node_modules)');
console.log();

let totalFreed = 0;
for (const dir of targets) {
  totalFreed += removeDir(dir);
}

// ── Stale Cargo global lock files ────────────────────────────────────────
const cargoHome = process.env.CARGO_HOME ?? path.join(os.homedir(), '.cargo');
console.log('\n  [Cargo global cache]');
for (const lockFile of ['.package-cache', '.package-cache-mutate']) {
  totalFreed += removeFile(path.join(cargoHome, lockFile), `~/.cargo/${lockFile}`);
}

console.log(`\nDone. Freed ~${formatBytes(totalFreed)} of disk space.`);
console.log('Run "npm run tauri:update" to restore dependencies before next build.\n');
