/**
 * Bridge for communicating with the sidecar backend
 * Uses HTTP to communicate with the Express server running in the sidecar
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

let sidecarPort: number | null = null;
const portCallbacks: Array<(port: number) => void> = [];
let initialized = false;

// Initialize Tauri event listeners
async function initializeTauriListeners() {
  if (initialized) return;
  
  console.log('[Bridge] Initializing Tauri listeners...');
  initialized = true;
  
  try {
    // Listen for sidecar port event
    await listen<number>('sidecar-port', (event) => {
      sidecarPort = event.payload;
      console.log('[Bridge] Sidecar port received via event:', sidecarPort);
      // Notify all callbacks
      portCallbacks.forEach(cb => cb(sidecarPort!));
    });
    
    console.log('[Bridge] Event listener registered for sidecar-port');
    
    // Also try to get it via invoke immediately
    try {
      const port = await invoke<number | null>('get_sidecar_port');
      if (port && !sidecarPort) {
        sidecarPort = port;
        console.log('[Bridge] Sidecar port from invoke:', sidecarPort);
        // Notify all callbacks
        portCallbacks.forEach(cb => cb(sidecarPort!));
      } else if (port) {
        console.log('[Bridge] Port already set, invoke returned:', port);
      } else {
        console.log('[Bridge] Invoke returned null, waiting for event');
      }
    } catch (err) {
      console.error('[Bridge] Failed to get sidecar port via invoke:', err);
    }
  } catch (error) {
    console.error('[Bridge] Error initializing Tauri listeners:', error);
  }
}

// Initialize on module load
initializeTauriListeners();

// Also try again when DOM is ready (just in case)
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initializeTauriListeners());
  }
}

// Helper to get sidecar URL
function getSidecarUrl(path: string): string {
  if (!sidecarPort) {
    throw new Error('Sidecar port not available yet');
  }
  return `http://127.0.0.1:${sidecarPort}${path}`;
}

export interface ProxyStartRequest {
  port: number;
  mode: 'proxy' | 'mock' | 'both';
  targetUrl: string;
}

export interface ProxyStatusResponse {
  enabled: boolean;
  port: number | null;
  mode: string;
}

export const bridge = {
  async startProxy(config: ProxyStartRequest): Promise<any> {
    initializeTauriListeners(); // Ensure initialized
    const response = await fetch(getSidecarUrl('/proxy/start'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    return response.json();
  },

  async stopProxy(): Promise<any> {
    initializeTauriListeners(); // Ensure initialized
    const response = await fetch(getSidecarUrl('/proxy/stop'), {
      method: 'POST'
    });
    return response.json();
  },

  async getProxyStatus(): Promise<ProxyStatusResponse> {
    initializeTauriListeners(); // Ensure initialized
    const response = await fetch(getSidecarUrl('/proxy/status'));
    return response.json();
  },

  async getMockStatus(): Promise<any> {
    const response = await fetch(getSidecarUrl('/mock/status'));
    return response.json();
  },

  async healthCheck(): Promise<any> {
    try {
      if (!sidecarPort) {
        return { status: 'waiting', message: 'Waiting for sidecar port...' };
      }
      const response = await fetch(getSidecarUrl('/health'), { 
        signal: AbortSignal.timeout(2000) 
      });
      return response.json();
    } catch (error) {
      console.error('[Bridge] Health check failed:', error);
      return { status: 'error', message: 'Sidecar not reachable' };
    }
  },

  getSidecarPort(): number | null {
    return sidecarPort;
  },

  onPortAvailable(callback: (port: number) => void): void {
    if (sidecarPort) {
      callback(sidecarPort);
    } else {
      portCallbacks.push(callback);
    }
  },

  // Certificate management
  async getCertificateInfo(): Promise<any> {
    initializeTauriListeners();
    const response = await fetch(getSidecarUrl('/certificate/info'));
    return response.json();
  },

  async generateCertificate(): Promise<any> {
    initializeTauriListeners();
    const response = await fetch(getSidecarUrl('/certificate/generate'), {
      method: 'POST'
    });
    return response.json();
  },

  async trustCertificate(): Promise<any> {
    initializeTauriListeners();
    const response = await fetch(getSidecarUrl('/certificate/trust'), {
      method: 'POST'
    });
    return response.json();
  },

  async getExportCertificateUrl(): Promise<string> {
    initializeTauriListeners();
    return getSidecarUrl('/certificate/export');
  },

  // Mock rules management
  async getMockRules(): Promise<any> {
    initializeTauriListeners();
    const response = await fetch(getSidecarUrl('/mock/rules'));
    return response.json();
  },

  async addMockRule(rule: any): Promise<any> {
    initializeTauriListeners();
    const response = await fetch(getSidecarUrl('/mock/rules'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule)
    });
    return response.json();
  },

  async updateMockRule(id: string, updates: any): Promise<any> {
    initializeTauriListeners();
    const response = await fetch(getSidecarUrl(`/mock/rules/${id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return response.json();
  },

  async deleteMockRule(id: string): Promise<any> {
    initializeTauriListeners();
    const response = await fetch(getSidecarUrl(`/mock/rules/${id}`), {
      method: 'DELETE'
    });
    return response.json();
  },

  // Breakpoint management
  async getBreakpointRules(): Promise<any> {
    initializeTauriListeners();
    const response = await fetch(getSidecarUrl('/breakpoint/rules'));
    return response.json();
  },

  async addBreakpointRule(rule: any): Promise<any> {
    initializeTauriListeners();
    const response = await fetch(getSidecarUrl('/breakpoint/rules'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rule)
    });
    return response.json();
  },

  async updateBreakpointRule(id: string, updates: any): Promise<any> {
    initializeTauriListeners();
    const response = await fetch(getSidecarUrl(`/breakpoint/rules/${id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return response.json();
  },

  async deleteBreakpointRule(id: string): Promise<any> {
    initializeTauriListeners();
    const response = await fetch(getSidecarUrl(`/breakpoint/rules/${id}`), {
      method: 'DELETE'
    });
    return response.json();
  },

  async getBreakpointQueue(): Promise<any> {
    initializeTauriListeners();
    const response = await fetch(getSidecarUrl('/breakpoint/queue'));
    return response.json();
  },

  async continueBreakpoint(id: string, modifications?: any): Promise<any> {
    initializeTauriListeners();
    const response = await fetch(getSidecarUrl(`/breakpoint/continue/${id}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modifications })
    });
    return response.json();
  },

  async dropBreakpoint(id: string): Promise<any> {
    initializeTauriListeners();
    const response = await fetch(getSidecarUrl(`/breakpoint/drop/${id}`), {
      method: 'POST'
    });
    return response.json();
  },

  // ============================================================================
  // File Watcher Methods
  // ============================================================================

  async getFileWatches(): Promise<any> {
    initializeTauriListeners();
    const response = await fetch(getSidecarUrl('/filewatcher/watches'));
    return response.json();
  },

  async addFileWatch(watch: any): Promise<any> {
    initializeTauriListeners();
    const response = await fetch(getSidecarUrl('/filewatcher/watches'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(watch)
    });
    return response.json();
  },

  async updateFileWatch(id: string, updates: any): Promise<any> {
    initializeTauriListeners();
    const response = await fetch(getSidecarUrl(`/filewatcher/watches/${id}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    return response.json();
  },

  async deleteFileWatch(id: string): Promise<any> {
    initializeTauriListeners();
    const response = await fetch(getSidecarUrl(`/filewatcher/watches/${id}`), {
      method: 'DELETE'
    });
    return response.json();
  },

  async getFileWatchEvents(limit?: number): Promise<any> {
    initializeTauriListeners();
    const url = limit 
      ? getSidecarUrl(`/filewatcher/events?limit=${limit}`)
      : getSidecarUrl('/filewatcher/events');
    const response = await fetch(url);
    return response.json();
  },

  async clearFileWatchEvents(): Promise<any> {
    initializeTauriListeners();
    const response = await fetch(getSidecarUrl('/filewatcher/events/clear'), {
      method: 'POST'
    });
    return response.json();
  }
};
