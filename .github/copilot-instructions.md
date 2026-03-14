# APIprox Development Guide

## Project Overview

APIprox is a desktop HTTP/HTTPS proxy and mock server for API testing, built with Tauri 2 (Rust), React, and TypeScript. It intercepts, inspects, and mocks HTTP/HTTPS traffic with support for HTTPS certificate generation, traffic recording, mock rules, replace rules (XPath/regex-based), and breakpoints.

### Architecture

**Two-Part Structure:**

1. **Tauri App (`src-tauri/`)**: Rust backend containing ALL business logic — proxy, mock server, certificate management, file watching, replace rules, and breakpoints. Manages global app state and exposes functionality to the webview via Tauri IPC commands.
2. **Webview Frontend (`src-tauri/webview/`)**: React/TypeScript UI built with Vite. Purely display and interaction — no business logic. Communicates with the Rust backend via `bridge.ts`.

> **Note:** There is no Node.js sidecar. All backend services are implemented in Rust within `src-tauri/src/`.

**Communication Flow:**
- Webview calls Rust commands via `invoke()` (Tauri IPC) — wrapped in `bridge.ts`
- Rust pushes real-time events to the webview via `app.emit("event-name", payload)` / `listen()` in TS
- No HTTP server or REST API — all communication is in-process via Tauri IPC

**Shared Types:** The `shared/` directory contains TypeScript interfaces used by the webview. These mirror the Rust structs (serialised via `serde`) defined in `src-tauri/src/models.rs`.

## Build & Run Commands

### Development
```bash
npm run tauri:dev
```
- Installs webview dependencies, starts Tauri in dev mode
- Webview runs with Vite HMR
- Rust compiles in debug mode

### Production Build
```bash
npm run tauri:build
```
- Builds webview production bundle and creates platform-specific installers
- Outputs to `src-tauri/target/release/bundle/`

## Key Conventions

### State Persistence

**Rust writes configuration to:** `~/.apiprox/`
- `mock-rules.json` — Mock rule definitions
- `breakpoint-rules.json` — Breakpoint configurations
- `file-watches.json` — File watcher configurations
- `ca.key` / `ca.crt` — Generated CA certificate

**Tauri stores app preferences via:** `tauri-plugin-store` (stored in platform app data dir)

### Communication Between Webview and Rust

**Pattern:** Webview calls Rust commands via `invoke()`. Rust pushes real-time updates via `app.emit()`.

**Bridge Utility:** `src-tauri/webview/src/utils/bridge.ts` wraps all `invoke()` calls into typed async methods. All Tauri command calls go through this file.

**Tauri Commands (registered in `src-tauri/src/lib.rs`):**
- `start_proxy` / `stop_proxy` / `get_proxy_status`
- `start_mock` / `stop_mock` / `get_mock_status`
- `get_mock_rules` / `add_mock_rule` / `update_mock_rule` / `delete_mock_rule`
- `get_replace_rules` / `add_replace_rule` / `update_replace_rule` / `delete_replace_rule`
- `get_breakpoint_rules` / `add_breakpoint_rule` / `delete_breakpoint_rule` / `set_breakpoint_rules`
- `get_paused_traffic` / `continue_breakpoint` / `drop_breakpoint`
- `get_file_watches` / `add_file_watch` / `update_file_watch` / `delete_file_watch`
- `get_watcher_events` / `clear_watcher_events`
- `get_certificate_info` / `generate_certificate` / `trust_certificate`

**Real-time Tauri Events (Rust → Webview via `listen()`):**
- `"proxy-event"` — captured traffic log entries
- `"watcher-event"` — file system change events
- `"breakpoint-paused"` — traffic paused at a breakpoint

### TypeScript Shared Models

All shared types are in `shared/src/models.ts`. Used directly by webview components and bridge.

**Key Models:**
- `MockRule` — Mock response configuration with conditions
- `ReplaceRule` — XPath/regex text replacement rule
- `BreakpointRule` — Traffic pause configuration
- `FileWatch` — File system watch configuration
- `ProxyEvent` / `WatcherEvent` — Traffic log entries

### Backend Services Architecture (Rust)

All services live in `src-tauri/src/` and are held in `AppState` (managed by Tauri).

**`proxy/`** — HTTP/HTTPS proxy using `hyper`. Handles CONNECT tunneling for HTTPS, applies replace rules, forwards to target URL or mock. Emits `proxy-event` traffic logs.

**`mock/`** — Mock server. Matches requests against `MockRule` conditions (AND logic). Returns configured responses (status, body, headers, delay). Falls through to proxy if `passthroughEnabled`.

**`replacer/`** — Applies `ReplaceRule` XPath/regex transformations to request/response bodies. Uses `sxd-document` / `sxd-xpath` for XML targeting.

**`breakpoint/`** — Pauses traffic matching `BreakpointRule` conditions. Holds requests/responses until user resumes, modifies, or drops via UI.

**`filewatcher/`** — Watches file system paths via `notify` crate. Emits `watcher-event` to webview on file changes.

**`certificates/`** — Self-signed CA generation and per-domain certificate signing using the `rcgen` crate. Trust installation via platform CLI tools.

### Certificate Management

**CA Generation:** `src-tauri/src/certificates/manager.rs` generates a root CA and signs per-domain certificates on-the-fly for HTTPS interception.

**Trust Installation:**
- Windows: Uses `certutil -addstore "Root" cert.pem`
- macOS: Uses `security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain cert.pem`
- Linux: Copies to `/usr/local/share/ca-certificates/` and runs `update-ca-certificates`

Certificates stored in `~/.apiprox/`.

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


### Adding a New Backend Feature

1. Add Rust structs/logic in the relevant `src-tauri/src/<module>/` directory
2. Add a Tauri command handler in `src-tauri/src/commands/<module>.rs`
3. Register the command in the `invoke_handler!` list in `src-tauri/src/lib.rs`
4. Add types to `shared/src/models.ts` if needed
5. Add a bridge method in `src-tauri/webview/src/utils/bridge.ts`
6. Call from the React component

### Adding a New UI Tab

1. Create component in `src-tauri/webview/src/components/`
2. Add tab type to `App.tsx` tab union
3. Add tab button to tab bar map
4. Add conditional render in main content area

### Modifying Proxy/Mock/Replace Behaviour

1. Update the relevant Rust service in `src-tauri/src/<proxy|mock|replacer>/`
2. If the Tauri command signature changes, update the corresponding entry in `src-tauri/src/commands/`
3. Update `bridge.ts` and shared types if the data shape changes
4. Ensure changes are compatible with existing persisted rules in `~/.apiprox/`

### Building for Release

1. Update version in `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`
2. Run `npm run tauri:build`
3. Test installer from `src-tauri/target/release/bundle/`
4. Sign binaries for macOS/Windows if distributing publicly
