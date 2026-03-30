#!/usr/bin/env node
/**
 * APIprox Version Management
 *
 * Single script replacing increment-build.js, sync-version.js, bump.js,
 * and tauri-build.js. The build number lives inside this file as BUILD_NO.
 *
 * Commands:
 *   node scripts/version.js increment              — bump BUILD_NO in this file
 *   node scripts/version.js sync [x.y.z]          — write version to all config files
 *   node scripts/version.js bump <major|minor|patch> ["msg"] — bump + git commit + tag
 *   node scripts/version.js build [tauri-args...]  — increment + sync + npm install + tauri build
 */

// ─── BUILD NUMBER (auto-managed — do not edit manually) ───────────────────
const BUILD_NO = 63;
// ─────────────────────────────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';
import { execSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const root       = path.join(__dirname, '..');

const configFiles = {
    rootPackage:    path.join(root, 'package.json'),
    webviewPackage: path.join(root, 'src-tauri', 'webview', 'package.json'),
    cargo:          path.join(root, 'src-tauri', 'Cargo.toml'),
    tauriConfig:    path.join(root, 'src-tauri', 'tauri.conf.json'),
};

function run(cmd, opts = {}) {
    console.log(`\n> ${cmd}`);
    execSync(cmd, { stdio: 'inherit', cwd: root, ...opts });
}

// ── increment ──────────────────────────────────────────────────────────────
// Reads BUILD_NO from this file, increments it, and writes it back.
// Must be invoked as a separate process so the next command sees the new value.
function increment() {
    const self = fs.readFileSync(__filename, 'utf8');
    const next = BUILD_NO + 1;
    const updated = self.replace(
        /^(const BUILD_NO = )\d+(;)$/m,
        `$1${next}$2`
    );
    if (updated === self) {
        console.error('❌ Could not locate BUILD_NO line in version.js');
        process.exit(1);
    }
    fs.writeFileSync(__filename, updated, 'utf8');
    console.log(`✅ Build number incremented to: ${next}`);
}

// ── sync ───────────────────────────────────────────────────────────────────
// Composes major.minor.BUILD_NO and writes it to all four config files.
// When called as a fresh Node.js process (after increment), BUILD_NO will
// already hold the incremented value.
function sync(forcedVersion) {
    let targetVersion = forcedVersion;

    if (!targetVersion) {
        const rootPkg = JSON.parse(fs.readFileSync(configFiles.rootPackage, 'utf8'));
        const parts = rootPkg.version.split('.');
        if (parts.length < 2) {
            console.error('❌ Version in package.json must be at least major.minor');
            process.exit(1);
        }
        targetVersion = `${parts[0]}.${parts[1]}.${BUILD_NO}`;
    }

    const vParts = targetVersion.split('.');
    if (vParts.length !== 3) {
        console.error('❌ Version must be major.minor.patch');
        process.exit(1);
    }

    console.log(`\n🔄 Syncing all versions to: ${targetVersion}\n`);

    const rootPkg = JSON.parse(fs.readFileSync(configFiles.rootPackage, 'utf8'));
    rootPkg.version = targetVersion;
    fs.writeFileSync(configFiles.rootPackage, JSON.stringify(rootPkg, null, 2) + '\n');
    console.log(`✓ package.json → ${targetVersion}`);

    const webviewPkg = JSON.parse(fs.readFileSync(configFiles.webviewPackage, 'utf8'));
    webviewPkg.version = targetVersion;
    fs.writeFileSync(configFiles.webviewPackage, JSON.stringify(webviewPkg, null, 2) + '\n');
    console.log(`✓ src-tauri/webview/package.json → ${targetVersion}`);

    let cargo = fs.readFileSync(configFiles.cargo, 'utf8');
    cargo = cargo.replace(/^version = ".+"$/m, `version = "${targetVersion}"`);
    fs.writeFileSync(configFiles.cargo, cargo);
    console.log(`✓ src-tauri/Cargo.toml → ${targetVersion}`);

    const tauriConf = JSON.parse(fs.readFileSync(configFiles.tauriConfig, 'utf8'));
    tauriConf.version = targetVersion;
    fs.writeFileSync(configFiles.tauriConfig, JSON.stringify(tauriConf, null, 2) + '\n');
    console.log(`✓ src-tauri/tauri.conf.json → ${targetVersion}`);

    console.log('\n✅ Version sync complete.\n');
}

// ── bump ───────────────────────────────────────────────────────────────────
function bump(type, message) {
    if (!['major', 'minor', 'patch'].includes(type)) {
        console.error('Usage: node scripts/version.js bump <major|minor|patch> [commit_message]');
        process.exit(1);
    }

    if (type === 'patch') {
        // patch: increment BUILD_NO then sync in a fresh process each time
        run('node scripts/version.js increment');
        run('node scripts/version.js sync');
    } else {
        // major/minor: let npm handle the arithmetic, then reset BUILD_NO to 1
        run(`npm version ${type} --no-git-tag-version`);

        const self = fs.readFileSync(__filename, 'utf8');
        const updated = self.replace(/^(const BUILD_NO = )\d+(;)$/m, '$11$2');
        if (updated === self) {
            console.error('❌ Could not locate BUILD_NO line in version.js');
            process.exit(1);
        }
        fs.writeFileSync(__filename, updated, 'utf8');
        console.log('ℹ️  BUILD_NO reset to 1');

        run('node scripts/version.js sync');
    }

    const pkg = JSON.parse(fs.readFileSync(configFiles.rootPackage, 'utf8'));
    const ver = pkg.version;

    run('git add .');
    const msg = message ? `v${ver}: ${message}` : `Bump version to ${ver}`;
    run(`git commit -m "${msg}"`);
    run(`git tag v${ver}`);

    console.log(`\n✅ Bumped to v${ver}\n`);
}

// ── build ──────────────────────────────────────────────────────────────────
function build(extraArgs) {
    run('node scripts/version.js increment');
    run('node scripts/version.js sync');
    run('npm install', { cwd: path.join(root, 'src-tauri', 'webview') });

    console.log(`\n> npx tauri build ${extraArgs.join(' ')}`);
    const result = spawnSync('npx', ['tauri', 'build', ...extraArgs], {
        stdio: 'inherit',
        cwd:   root,
        shell: true,
    });
    process.exit(result.status ?? 1);
}

// ── dispatch ───────────────────────────────────────────────────────────────
const [,, cmd, ...args] = process.argv;

switch (cmd) {
    case 'increment': increment();                          break;
    case 'sync':      sync(args[0]);                       break;
    case 'bump':      bump(args[0], args.slice(1).join(' ')); break;
    case 'build':     build(args);                         break;
    default:
        console.error(`Unknown command: ${cmd}`);
        console.error('Commands: increment | sync [x.y.z] | bump <major|minor|patch> [msg] | build [tauri-args...]');
        process.exit(1);
}
