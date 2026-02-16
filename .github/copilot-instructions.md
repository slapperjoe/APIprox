# APIprox Development Guide

## Project Overview

APIprox is a desktop HTTP/HTTPS proxy and mock server for API testing, built with Tauri 2 (Rust), React, and TypeScript. It intercepts, inspects, and mocks HTTP/HTTPS traffic with support for HTTPS certificate generation, traffic recording, mock rules, replace rules (XPath/regex-based), and breakpoints.

### Architecture

**Three-Part Structure:**

1. **Tauri App (`src-tauri/`)**: Rust desktop shell that manages the sidecar process lifecycle and provides window chrome
2. **Webview Frontend (`src-tauri/webview/`)**: React/TypeScript UI built with Vite
3. **Sidecar Backend (`sidecar/`)**: Node.js Express server bundled as standalone binary, handles all proxy/mock/certificate logic

**Why Sidecar?** The Node.js backend runs as a separate process from the Rust Tauri app. This allows the Rust layer to remain simple while leveraging Node's rich HTTP proxy ecosystem (`http-proxy`, `express`, `node-forge` for certificates).

**Communication Flow:**
- Tauri app spawns sidecar binary on startup
- Sidecar selects random port and outputs `SIDECAR_PORT:XXXX` to stdout
- Rust captures port and emits `sidecar-port` event to webview
- Webview communicates with sidecar via REST API (`http://localhost:<port>`)

**Shared Types:** The `shared/` directory contains TypeScript interfaces used by both webview and sidecar (models for mock rules, breakpoints, traffic events, etc.).

## Build & Run Commands

### Development
```bash
npm run tauri:dev
```
- Builds sidecar binary, installs webview dependencies, starts Tauri in dev mode
- Webview runs with Vite HMR
- Rust compiles in debug mode

### Production Build
```bash
npm run tauri:build
```
- Builds sidecar, webview production bundle, and creates platform-specific installers
- Outputs to `src-tauri/target/release/bundle/`

### Build Sidecar Only
```bash
npm run build:sidecar
```
- Compiles TypeScript sidecar code to `sidecar/dist/`
- Does not create standalone binary (use `prepare:sidecar` for that)

### Prepare Sidecar Binary
```bash
npm run prepare:sidecar
```
- Installs sidecar deps, bundles with `ncc`, creates binaries with `pkg`
- Outputs platform binaries to `sidecar-bundle/` directory
- Used by dev and build workflows

## Key Conventions

### Sidecar Binary Paths

**Dev Mode:** `<project-root>/sidecar-bundle/sidecar-<platform>`
**Production:** `<resource-dir>/sidecar-bundle/sidecar-<platform>`

Platform binaries:
- Windows: `sidecar-x86_64-pc-windows-msvc.exe`
- macOS: `sidecar-x86_64-apple-darwin`
- Linux: `sidecar-x86_64-unknown-linux-gnu`

The Rust code in `src-tauri/src/lib.rs` determines paths based on `cfg!(debug_assertions)`.

### State Persistence

**Sidecar stores configuration in:** `~/.apiprox/`
- `mock-rules.json` - Mock rule definitions
- `breakpoint-rules.json` - Breakpoint configurations  
- `file-watches.json` - File watcher configurations

**Tauri stores app preferences via:** `tauri-plugin-store` (handled by Tauri, stored in app data dir)

### Communication Between Webview and Sidecar

**Pattern:** Webview makes HTTP requests to sidecar REST API

**Bridge Utility:** `src-tauri/webview/src/utils/bridge.ts` wraps sidecar API calls and handles:
- Port discovery (listens for `sidecar-port` event from Tauri)
- Base URL construction
- Request helpers for common endpoints

**Sidecar API Endpoints:** Defined in `sidecar/src/index.ts`:
- `GET /health` - Health check
- `POST /proxy/start` - Start proxy server
- `POST /proxy/stop` - Stop proxy server
- `GET /proxy/rules` - Get replace rules
- `POST /proxy/rules` - Create/update replace rules
- `GET /mock/rules` - Get mock rules
- `POST /mock/rules` - Create/update mock rules
- Similar patterns for breakpoints, file watchers, traffic logs

### TypeScript Shared Models

All shared types are in `shared/src/models.ts`. Import from `@apiprox/shared` in sidecar or directly in webview.

**Key Models:**
- `MockRule` - Mock response configuration with conditions
- `ReplaceRule` - XPath/regex text replacement rule
- `BreakpointRule` - Traffic pause configuration
- `FileWatch` - File system watch configuration
- `ProxyEvent` / `WatcherEvent` - Traffic log entries

### Proxy Services Architecture

**ProxyService (`sidecar/src/services/ProxyService.ts`):**
- Main HTTP/HTTPS proxy using `http-proxy` library
- Handles CONNECT tunneling for HTTPS
- Applies replace rules via `ReplacerService`
- Forwards to target URL or mock service
- Emits traffic events

**MockService (`sidecar/src/services/MockService.ts`):**
- Matches requests against `MockRule` conditions
- Returns configured responses (status, body, headers, delay)
- Falls through to proxy if `passthroughEnabled` and no match

**ReplacerService (`sidecar/src/services/ReplacerService.ts`):**
- Applies `ReplaceRule` transformations to request/response bodies
- Uses `xpath` library for XML element targeting
- Supports regex and plain text replacement

**BreakpointService (`sidecar/src/services/BreakpointService.ts`):**
- Pauses traffic matching `BreakpointRule` conditions
- Holds requests/responses in memory until user resumes or modifies

**FileWatcherService (`sidecar/src/services/FileWatcherService.ts`):**
- Watches file system paths for changes
- Pairs request/response files by naming convention
- Emits file change events to webview

### Certificate Management

**Self-Signed CA Generation:** `sidecar/src/utils/certUtils.ts` uses `node-forge` to create root CA and sign certificates on-the-fly for intercepted domains.

**Trust Installation:**
- Windows: Uses `certutil -addstore "Root" cert.pem`
- macOS: Uses `security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain cert.pem`
- Linux: Copies to `/usr/local/share/ca-certificates/` and runs `update-ca-certificates`

Certificates stored in `~/.apiprox/` directory.

### Component Organization

**Webview Components (`src-tauri/webview/src/components/`):**
- `TitleBar.tsx` - Custom window chrome with traffic light buttons
- `ServerControl.tsx` - Proxy/mock server start/stop panel
- `TrafficViewer.tsx` - Display captured traffic logs
- `RulesPage.tsx` - Manage replace rules (XPath text replacement)
- `MockRulesPage.tsx` - Manage mock response rules
- `BreakpointsPage.tsx` - Configure traffic breakpoints
- `FileWatcherPage.tsx` - File system watching interface
- `SettingsPage.tsx` - Certificate management, preferences

**Main App (`App.tsx`):** Tab-based navigation between Server Control, Traffic, Rules, Mocks, Breakpoints, File Watcher, and Settings.

### XPath Replace Rules

Replace rules target XML elements via XPath and replace text content within matched elements only.

**Example:** 
```typescript
{
  xpath: "//Customer/SSN",
  matchText: "\\d{3}-\\d{2}-\\d{4}",
  replaceWith: "XXX-XX-XXXX",
  target: "response",
  isRegex: true
}
```

This finds `<SSN>123-45-6789</SSN>` and replaces content with `XXX-XX-XXXX`.

### Mock Rule Matching

Mock rules use multiple conditions with AND logic. All conditions must match for rule to activate.

**Condition Types:**
- `url` - URL path contains/matches pattern
- `xpath` - XML body matches XPath expression
- `header` - Specific header name/value
- `operation` - SOAP operation name (for SOAP APIs)
- `soapAction` - SOAP action header

**Priority:** Rules match in order defined. First matching rule wins.

### Traffic Breakpoints

Breakpoints pause traffic at request or response phase for manual inspection/modification.

**Target Options:**
- `request` - Pause before forwarding request
- `response` - Pause after receiving response
- `both` - Pause at both phases

User can resume, drop, or modify paused traffic from UI.

## Integration with APInox

APIprox is designed to work alongside APInox (SOAP API testing tool). The webview uses `@apinox/request-editor` package for XML editing (referenced as local file dependency in `package.json`).

## Tauri Configuration

**Main config:** `src-tauri/tauri.conf.json`
- Window settings (title, size, decorations)
- Bundle configuration (icon, identifier)
- Security settings (CSP, allowlist)

**Plugins Used:**
- `tauri-plugin-log` - Logging
- `tauri-plugin-dialog` - File dialogs
- `tauri-plugin-clipboard-manager` - Clipboard access
- `tauri-plugin-store` - Persistent key-value storage
- `tauri-plugin-opener` - Open URLs/files
- `tauri-plugin-shell` - Shell command execution
- `tauri-plugin-process` - Process management

## Testing

No automated test suite currently exists. Manual testing workflow:
1. Start dev mode: `npm run tauri:dev`
2. Test proxy mode with sample HTTP requests
3. Test HTTPS with certificate installation
4. Verify mock rules match correctly
5. Test replace rules with XML traffic
6. Verify breakpoints pause traffic as expected

## Common Development Tasks

### Adding a New Sidecar Endpoint

1. Define route handler in `sidecar/src/index.ts`
2. Add types to `shared/src/models.ts` if needed
3. Create bridge method in `src-tauri/webview/src/utils/bridge.ts`
4. Call from React component

### Adding a New UI Tab

1. Create component in `src-tauri/webview/src/components/`
2. Add tab type to `App.tsx` tab union
3. Add tab button to tab bar map
4. Add conditional render in main content area

### Modifying Proxy Behavior

1. Update `ProxyService.ts` for core proxy logic
2. Update `ReplacerService.ts` for text transformation
3. Update `MockService.ts` for mock matching
4. Ensure changes are compatible with existing rules

### Building for Release

1. Update version in `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`
2. Run `npm run tauri:build`
3. Test installer from `src-tauri/target/release/bundle/`
4. Sign binaries for macOS/Windows if distributing publicly
