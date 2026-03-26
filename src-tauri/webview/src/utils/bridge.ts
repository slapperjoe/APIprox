/**
 * Bridge for communicating with the Rust backend via Tauri invoke().
 */
import { invoke } from '@tauri-apps/api/core';

export interface ProxyStartRequest {
  port: number;
  mode: 'proxy' | 'mock' | 'both';
  targetUrl: string;
}

export interface ProxyStatusResponse {
  running: boolean;
  port: number | null;
  mode: string;
  targetUrl: string;
}

export interface SystemProxyStatus {
  enabled: boolean;
  host: string;
  port: number | null;
  /** "windows" | "macos" | "linux" | "unknown" */
  platform: string;
  /** Whether set/clear automation is supported on this platform */
  automationSupported: boolean;
  /** macOS only: whether Touch ID / password is required to change settings */
  requiresElevation: boolean;
  /** macOS only: network services the proxy will be applied to */
  networkServices: string[];
}

export const bridge = {
  // ── Proxy ──────────────────────────────────────────────────────────────────
  async startProxy(config: ProxyStartRequest): Promise<void> {
    return invoke('start_proxy', {
      port: config.port,
      mode: config.mode,
      targetUrl: config.targetUrl,
    });
  },

  async stopProxy(): Promise<void> {
    return invoke('stop_proxy');
  },

  async getProxyStatus(): Promise<ProxyStatusResponse> {
    return invoke('get_proxy_status');
  },

  async getMockStatus(): Promise<any> {
    return invoke('get_mock_status');
  },

  // ── Certificate management ─────────────────────────────────────────────────
  async getCertificateInfo(): Promise<any> {
    return invoke('get_certificate_info');
  },

  async generateCertificate(): Promise<any> {
    return invoke('generate_certificate');
  },

  async trustCertificate(): Promise<any> {
    return invoke('trust_certificate');
  },

  async untrustCertificate(): Promise<any> {
    return invoke('untrust_certificate');
  },

  async getExportCertificateUrl(): Promise<string> {
    const info: any = await invoke('get_certificate_info');
    return info.certPath ?? '';
  },

  // ── Mock rules ─────────────────────────────────────────────────────────────
  async getMockRules(): Promise<any> {
    return invoke('get_mock_rules');
  },

  async addMockRule(rule: any): Promise<any> {
    return invoke('add_mock_rule', { rule });
  },

  async updateMockRule(id: string, rule: any): Promise<any> {
    return invoke('update_mock_rule', { id, rule });
  },

  async deleteMockRule(id: string): Promise<any> {
    return invoke('delete_mock_rule', { id });
  },

  async exportMockCollection(
    ids: string[],
    name: string,
    description: string,
    filePath: string,
  ): Promise<void> {
    return invoke('export_mock_collection', { ids, name, description, filePath });
  },

  async importMockCollection(filePath: string): Promise<any[]> {
    return invoke('import_mock_collection', { filePath });
  },

  // ── Replace rules ──────────────────────────────────────────────────────────
  async getReplaceRules(): Promise<any[]> {
    return invoke('get_replace_rules');
  },

  async addReplaceRule(rule: any): Promise<any> {
    return invoke('add_replace_rule', { rule });
  },

  async updateReplaceRule(id: string, rule: any): Promise<any> {
    return invoke('update_replace_rule', { id, rule });
  },

  async deleteReplaceRule(id: string): Promise<void> {
    return invoke('delete_replace_rule', { id });
  },

  // ── Breakpoints ────────────────────────────────────────────────────────────
  async getBreakpointRules(): Promise<any> {
    return invoke('get_breakpoint_rules');
  },

  async addBreakpointRule(rule: any): Promise<any> {
    return invoke('add_breakpoint_rule', { rule });
  },

  async updateBreakpointRule(id: string, rule: any): Promise<any> {
    // Update is done by replacing via set_breakpoint_rules for now
    const rules: any[] = await invoke('get_breakpoint_rules');
    const updated = rules.map((r: any) => r.id === id ? { ...r, ...rule } : r);
    await invoke('set_breakpoint_rules', { rules: updated });
    return rule;
  },

  async deleteBreakpointRule(id: string): Promise<any> {
    return invoke('delete_breakpoint_rule', { id });
  },

  async getBreakpointQueue(): Promise<any> {
    return invoke('get_paused_traffic');
  },

  async continueBreakpoint(id: string, modifications?: { body?: string; headers?: Record<string, string>; statusCode?: number }): Promise<any> {
    return invoke('continue_breakpoint', {
      id,
      modifiedBody: modifications?.body ?? null,
      modifiedHeaders: modifications?.headers ?? null,
      modifiedStatusCode: modifications?.statusCode ?? null,
    });
  },

  async dropBreakpoint(id: string): Promise<any> {
    return invoke('drop_breakpoint', { id });
  },

  // ── File Watcher ───────────────────────────────────────────────────────────
  async getFileWatches(): Promise<any> {
    return invoke('get_file_watches');
  },

  async addFileWatch(watch: {
    id: string;
    name: string;
    enabled: boolean;
    requestFile: string;
    responseFile: string;
    correlationIdElements: string[];
  }): Promise<any> {
    return invoke('add_file_watch', { watch });
  },

  async updateFileWatch(id: string, watch: {
    id: string;
    name: string;
    enabled: boolean;
    requestFile: string;
    responseFile: string;
    correlationIdElements: string[];
  }): Promise<any> {
    return invoke('update_file_watch', { id, watch });
  },

  /** Returns all current in-memory SOAP pairs (optionally filtered by watchId). Use on mount to restore state. */
  async getSoapPairs(watchId?: string): Promise<any> {
    return invoke('get_soap_pairs', { watchId: watchId ?? null });
  },

  async deleteFileWatch(id: string): Promise<any> {
    return invoke('delete_file_watch', { id });
  },

  /** @deprecated Pairs are now driven by real-time watcher-soap-event. Returns empty array. */
  async getFileWatchEvents(limit?: number): Promise<any> {
    return invoke('get_watcher_events', { limit: limit ?? null });
  },

  /** Clears all in-memory pair history on the Rust side. */
  async clearFileWatchEvents(): Promise<any> {
    return invoke('clear_watcher_events');
  },

  // ── Sniffer / System Proxy ─────────────────────────────────────────────────
  async getSystemProxyStatus(): Promise<SystemProxyStatus> {
    return invoke('get_system_proxy_status');
  },

  async setSystemProxy(port: number): Promise<void> {
    return invoke('set_system_proxy', { port });
  },

  async clearSystemProxy(): Promise<void> {
    return invoke('clear_system_proxy');
  },
};
