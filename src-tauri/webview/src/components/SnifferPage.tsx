import React, { useState, useEffect, useMemo } from 'react';
import { bridge, SystemProxyStatus } from '../utils/bridge';
import { TrafficLog } from '../types';
import { TrafficDetails } from './TrafficDetails';
import { tokens } from '../styles/tokens';

interface SnifferPageProps {
  trafficLogs: TrafficLog[];
}

type SetupTab = 'env' | 'httpclient' | 'iisexpress' | 'wcf';

const HTTP_METHODS = ['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export function SnifferPage({ trafficLogs }: SnifferPageProps) {
  const [proxyStatus, setProxyStatus] = useState<SystemProxyStatus | null>(null);
  const [proxyLoading, setProxyLoading] = useState(false);
  const [proxyError, setProxyError] = useState<string | null>(null);

  const [activeSetupTab, setActiveSetupTab] = useState<SetupTab>('env');

  const [urlFilter, setUrlFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<TrafficLog | null>(null);

  useEffect(() => {
    loadProxyStatus();
    const interval = setInterval(loadProxyStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadProxyStatus() {
    try {
      const status = await bridge.getSystemProxyStatus();
      setProxyStatus(status);
    } catch (err: any) {
      console.error('[Sniffer] Failed to load system proxy status:', err);
    }
  }

  async function handleEnableProxy() {
    setProxyLoading(true);
    setProxyError(null);
    try {
      // Default proxy port — 8888 is the APIprox default
      const port = 8888;
      await bridge.setSystemProxy(port);
      await loadProxyStatus();
    } catch (err: any) {
      setProxyError(err?.message ?? String(err));
    } finally {
      setProxyLoading(false);
    }
  }

  async function handleDisableProxy() {
    setProxyLoading(true);
    setProxyError(null);
    try {
      await bridge.clearSystemProxy();
      await loadProxyStatus();
    } catch (err: any) {
      setProxyError(err?.message ?? String(err));
    } finally {
      setProxyLoading(false);
    }
  }

  const filteredLogs = useMemo(() => {
    return trafficLogs.filter((log) => {
      if (urlFilter && !log.url.toLowerCase().includes(urlFilter.toLowerCase())) return false;
      if (methodFilter !== 'ALL' && log.method !== methodFilter) return false;
      if (statusFilter) {
        const s = parseInt(statusFilter, 10);
        if (!isNaN(s)) {
          if (statusFilter.endsWith('xx')) {
            const range = Math.floor(s / 100) * 100;
            if (!log.status || log.status < range || log.status >= range + 100) return false;
          } else {
            if (log.status !== s) return false;
          }
        }
      }
      return true;
    });
  }, [trafficLogs, urlFilter, methodFilter, statusFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: tokens.surface.base }}>
      {/* ── System Proxy Panel ───────────────────────────────────────────── */}
      <div style={{
        padding: tokens.space['6'],
        background: tokens.surface.panel,
        borderBottom: `1px solid ${tokens.border.default}`,
      }}>
        <h2 style={{ margin: `0 0 ${tokens.space['5']} 0`, fontSize: tokens.fontSize.xl, fontWeight: 500 }}>
          Network Sniffer
        </h2>

        <SystemProxyPanel
          status={proxyStatus}
          loading={proxyLoading}
          error={proxyError}
          onEnable={handleEnableProxy}
          onDisable={handleDisableProxy}
        />
      </div>

      {/* ── App Setup Guide ──────────────────────────────────────────────── */}
      <div style={{
        padding: `${tokens.space['5']} ${tokens.space['6']}`,
        background: tokens.surface.panel,
        borderBottom: `1px solid ${tokens.border.default}`,
      }}>
        <div style={{ marginBottom: tokens.space['4'], fontSize: tokens.fontSize.base, fontWeight: 500, color: tokens.text.secondary }}>
          Configure your app to use the proxy
        </div>
        <SetupGuide activeTab={activeSetupTab} onTabChange={setActiveSetupTab} />
      </div>

      {/* ── Live Traffic ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Filter Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: tokens.space['4'],
          padding: `${tokens.space['3']} ${tokens.space['6']}`,
          background: tokens.surface.elevated,
          borderBottom: `1px solid ${tokens.border.default}`,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: tokens.fontSize.base, color: tokens.text.secondary, fontWeight: 500 }}>
            Traffic ({filteredLogs.length})
          </span>

          <input
            type="text"
            placeholder="Filter by URL…"
            value={urlFilter}
            onChange={(e) => setUrlFilter(e.target.value)}
            style={{
              flex: 1,
              padding: `4px ${tokens.space['3']}`,
              background: tokens.surface.input,
              border: `1px solid ${tokens.border.subtle}`,
              borderRadius: tokens.radius.md,
              color: tokens.text.primary,
              fontSize: tokens.fontSize.sm,
            }}
          />

          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            style={{
              padding: `4px ${tokens.space['3']}`,
              background: tokens.surface.input,
              border: `1px solid ${tokens.border.subtle}`,
              borderRadius: tokens.radius.md,
              color: tokens.text.secondary,
              fontSize: tokens.fontSize.sm,
            }}
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Status (e.g. 200, 4xx)"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              width: '130px',
              padding: `4px ${tokens.space['3']}`,
              background: tokens.surface.input,
              border: `1px solid ${tokens.border.subtle}`,
              borderRadius: tokens.radius.md,
              color: tokens.text.primary,
              fontSize: tokens.fontSize.sm,
            }}
          />

          {(urlFilter || methodFilter !== 'ALL' || statusFilter) && (
            <button
              onClick={() => { setUrlFilter(''); setMethodFilter('ALL'); setStatusFilter(''); }}
              style={{
                padding: `4px ${tokens.space['3']}`,
                background: 'transparent',
                border: `1px solid ${tokens.border.subtle}`,
                borderRadius: tokens.radius.md,
                color: tokens.text.muted,
                fontSize: tokens.fontSize.sm,
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Traffic Table */}
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <TrafficTable logs={filteredLogs} selected={selectedLog} onSelect={setSelectedLog} />
        </div>

        {/* Detail Panel */}
        {selectedLog && (
          <TrafficDetails log={selectedLog} />
        )}
      </div>
    </div>
  );
}

// ── System Proxy Panel ────────────────────────────────────────────────────────

interface SystemProxyPanelProps {
  status: SystemProxyStatus | null;
  loading: boolean;
  error: string | null;
  onEnable: () => void;
  onDisable: () => void;
}

function SystemProxyPanel({ status, loading, error, onEnable, onDisable }: SystemProxyPanelProps) {
  const isWindows = status?.platform === 'windows';
  const isEnabled = status?.enabled ?? false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.space['4'] }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: tokens.space['5'], flexWrap: 'wrap' }}>
        {/* Status badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.space['3'] }}>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: isEnabled ? tokens.status.success : tokens.status.error,
            boxShadow: isEnabled ? `0 0 5px ${tokens.status.successGlow}` : `0 0 5px ${tokens.status.errorGlow}`,
            flexShrink: 0,
          }} />
          <span style={{ fontSize: tokens.fontSize.base, color: tokens.text.secondary }}>
            {status == null
              ? 'Checking…'
              : isEnabled
                ? `System proxy active → ${status.host}${status.port ? `:${status.port}` : ''}`
                : 'System proxy not set'}
          </span>
        </div>

        {/* Toggle button — only on Windows */}
        {isWindows && (
          isEnabled ? (
            <button
              onClick={onDisable}
              disabled={loading}
              style={dangerButtonStyle(loading)}
            >
              {loading ? 'Disabling…' : 'Disable System Proxy'}
            </button>
          ) : (
            <button
              onClick={onEnable}
              disabled={loading}
              style={primaryButtonStyle(loading)}
            >
              {loading ? 'Enabling…' : 'Enable System Proxy (port 8888)'}
            </button>
          )
        )}

        {/* Platform notice for non-Windows */}
        {status && !isWindows && (
          <div style={{
            fontSize: tokens.fontSize.sm,
            color: tokens.text.muted,
            fontStyle: 'italic',
          }}>
            Automatic proxy configuration is only available on Windows.
            Use the setup guide below.
          </div>
        )}
      </div>

      {error && (
        <div style={{
          padding: tokens.space['4'],
          background: tokens.surface.danger,
          border: `1px solid #6a2d2d`,
          borderRadius: tokens.radius.md,
          fontSize: tokens.fontSize.sm,
          color: tokens.text.danger,
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

// ── Setup Guide ───────────────────────────────────────────────────────────────

interface SetupGuideProps {
  activeTab: SetupTab;
  onTabChange: (tab: SetupTab) => void;
}

const SETUP_TABS: { id: SetupTab; label: string }[] = [
  { id: 'env', label: 'Environment Variable' },
  { id: 'httpclient', label: '.NET HttpClient' },
  { id: 'iisexpress', label: 'IIS Express' },
  { id: 'wcf', label: 'WCF / WebServiceClient' },
];

function SetupGuide({ activeTab, onTabChange }: SetupGuideProps) {
  return (
    <div style={{ background: tokens.surface.base, borderRadius: tokens.radius.lg, border: `1px solid ${tokens.border.default}` }}>
      {/* Tab row */}
      <div style={{
        display: 'flex',
        borderBottom: `1px solid ${tokens.border.default}`,
        background: tokens.surface.elevated,
        borderRadius: `${tokens.radius.lg} ${tokens.radius.lg} 0 0`,
        overflow: 'hidden',
      }}>
        {SETUP_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              padding: `${tokens.space['3']} ${tokens.space['5']}`,
              background: activeTab === tab.id ? tokens.surface.base : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? `2px solid ${tokens.status.accent}` : 'none',
              color: activeTab === tab.id ? tokens.text.white : tokens.text.secondary,
              fontSize: tokens.fontSize.sm,
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: tokens.space['5'] }}>
        {activeTab === 'env' && <EnvVarGuide />}
        {activeTab === 'httpclient' && <HttpClientGuide />}
        {activeTab === 'iisexpress' && <IisExpressGuide />}
        {activeTab === 'wcf' && <WcfGuide />}
      </div>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre style={{
      background: tokens.surface.elevated,
      border: `1px solid ${tokens.border.default}`,
      borderRadius: tokens.radius.md,
      padding: tokens.space['4'],
      fontSize: tokens.fontSize.sm,
      color: tokens.syntax.string,
      overflowX: 'auto',
      margin: `${tokens.space['3']} 0 0 0`,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
    }}>
      {children}
    </pre>
  );
}

function GuideText({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: tokens.fontSize.sm, color: tokens.text.secondary, margin: `0 0 ${tokens.space['3']} 0`, lineHeight: '1.6' }}>
      {children}
    </p>
  );
}

function EnvVarGuide() {
  return (
    <div>
      <GuideText>
        Set environment variables before starting your app. This works for most HTTP clients including .NET
        HttpClient (via <code style={inlineCode}>HttpClientHandler.UseProxy = true</code> — the default).
      </GuideText>
      <GuideText><strong>Windows (Command Prompt / PowerShell):</strong></GuideText>
      <CodeBlock>{`set HTTP_PROXY=http://127.0.0.1:8888\nset HTTPS_PROXY=http://127.0.0.1:8888`}</CodeBlock>
      <CodeBlock>{`$env:HTTP_PROXY = "http://127.0.0.1:8888"\n$env:HTTPS_PROXY = "http://127.0.0.1:8888"`}</CodeBlock>
      <GuideText><strong>macOS / Linux:</strong></GuideText>
      <CodeBlock>{`export HTTP_PROXY=http://127.0.0.1:8888\nexport HTTPS_PROXY=http://127.0.0.1:8888`}</CodeBlock>
      <GuideText>
        For HTTPS traffic you also need to trust the APIprox CA certificate (see the Settings tab).
      </GuideText>
    </div>
  );
}

function HttpClientGuide() {
  return (
    <div>
      <GuideText>
        Configure <code style={inlineCode}>HttpClient</code> directly in code — useful when you can't set
        environment variables or need per-client control.
      </GuideText>
      <CodeBlock>{`var handler = new HttpClientHandler
{
    Proxy = new WebProxy("http://127.0.0.1:8888"),
    UseProxy = true,
    // Trust all certs (dev only) — or install the APIprox CA cert instead:
    ServerCertificateCustomValidationCallback = (_, _, _, _) => true,
};
var client = new HttpClient(handler);`}</CodeBlock>
      <GuideText>
        For production-style HTTPS inspection, install the APIprox CA certificate via the Settings tab and
        remove the <code style={inlineCode}>ServerCertificateCustomValidationCallback</code> override.
      </GuideText>
    </div>
  );
}

function IisExpressGuide() {
  return (
    <div>
      <GuideText>
        IIS Express itself doesn't proxy outbound traffic, but the ASP.NET application it hosts does.
        Set the proxy via the app's <code style={inlineCode}>web.config</code> or a startup
        <code style={inlineCode}> launchSettings.json</code> environment block.
      </GuideText>
      <GuideText><strong>Option 1 — web.config (system.net proxy):</strong></GuideText>
      <CodeBlock>{`<configuration>
  <system.net>
    <defaultProxy enabled="true">
      <proxy proxyaddress="http://127.0.0.1:8888" bypassonlocal="false" />
    </defaultProxy>
  </system.net>
</configuration>`}</CodeBlock>
      <GuideText><strong>Option 2 — launchSettings.json environment variables:</strong></GuideText>
      <CodeBlock>{`{
  "profiles": {
    "IIS Express": {
      "environmentVariables": {
        "HTTPS_PROXY": "http://127.0.0.1:8888",
        "HTTP_PROXY": "http://127.0.0.1:8888"
      }
    }
  }
}`}</CodeBlock>
      <GuideText>
        Restart IIS Express after making changes. Trust the APIprox CA certificate in Windows
        Certificate Manager to avoid SSL errors.
      </GuideText>
    </div>
  );
}

function WcfGuide() {
  return (
    <div>
      <GuideText>
        WCF clients use <code style={inlineCode}>system.net/defaultProxy</code> by default (same as HttpClient).
        Enable <code style={inlineCode}>useDefaultWebProxy</code> on the binding or set it explicitly in config.
      </GuideText>
      <GuideText><strong>app.config / web.config:</strong></GuideText>
      <CodeBlock>{`<system.serviceModel>
  <bindings>
    <basicHttpBinding>
      <binding name="MyBinding">
        <security mode="Transport" />
      </binding>
    </basicHttpBinding>
  </bindings>
</system.serviceModel>

<system.net>
  <defaultProxy enabled="true" useDefaultCredentials="true">
    <proxy proxyaddress="http://127.0.0.1:8888" bypassonlocal="false" />
  </defaultProxy>
</system.net>`}</CodeBlock>
      <GuideText><strong>Code (CoreWCF / WCF client):</strong></GuideText>
      <CodeBlock>{`var binding = new BasicHttpBinding();
binding.UseDefaultWebProxy = true;

// Or set explicitly:
System.Net.WebRequest.DefaultWebProxy =
    new System.Net.WebProxy("http://127.0.0.1:8888");`}</CodeBlock>
    </div>
  );
}

// ── Traffic Table ─────────────────────────────────────────────────────────────

interface TrafficTableProps {
  logs: TrafficLog[];
  selected: TrafficLog | null;
  onSelect: (log: TrafficLog) => void;
}

function TrafficTable({ logs, selected, onSelect }: TrafficTableProps) {
  if (logs.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: tokens.space['4'],
        color: tokens.text.muted,
        fontSize: tokens.fontSize.sm,
      }}>
        <div style={{ fontSize: '32px' }}>📡</div>
        <div>No traffic captured yet.</div>
        <div style={{ color: tokens.text.hint }}>Start the proxy server, then configure your app using the guide above.</div>
      </div>
    );
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: tokens.fontSize.sm }}>
      <thead style={{
        position: 'sticky',
        top: 0,
        background: tokens.surface.panel,
        borderBottom: `1px solid ${tokens.border.default}`,
        zIndex: 1,
      }}>
        <tr>
          <th style={thStyle}>Time</th>
          <th style={thStyle}>Method</th>
          <th style={{ ...thStyle, width: '100%' }}>URL</th>
          <th style={thStyle}>Status</th>
          <th style={{ ...thStyle, textAlign: 'right' }}>Duration</th>
        </tr>
      </thead>
      <tbody>
        {logs.map((log) => (
          <TrafficRow key={log.id} log={log} isSelected={selected?.id === log.id} onClick={onSelect} />
        ))}
      </tbody>
    </table>
  );
}

function TrafficRow({ log, isSelected, onClick }: { log: TrafficLog; isSelected: boolean; onClick: (l: TrafficLog) => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <tr
      onClick={() => onClick(log)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: 'pointer',
        background: isSelected ? tokens.surface.active : hovered ? tokens.surface.stripe : 'transparent',
        borderBottom: `1px solid ${tokens.surface.elevated}`,
      }}
    >
      <td style={tdStyle}>{formatTime(log.timestamp)}</td>
      <td style={{ ...tdStyle, color: tokens.syntax.request, fontWeight: 600 }}>{log.method}</td>
      <td style={{ ...tdStyle, maxWidth: '500px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {log.url}
      </td>
      <td style={{ ...tdStyle, color: statusColor(log.status), fontWeight: 600 }}>{log.status ?? '—'}</td>
      <td style={{ ...tdStyle, textAlign: 'right', color: tokens.text.muted }}>
        {log.duration != null ? `${log.duration}ms` : '—'}
      </td>
    </tr>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString();
}

function statusColor(status?: number): string {
  if (!status) return tokens.text.muted;
  if (status < 300) return tokens.httpStatus.success;
  if (status < 400) return tokens.httpStatus.redirect;
  if (status < 500) return tokens.httpStatus.clientError;
  return tokens.httpStatus.serverError;
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px',
  textAlign: 'left',
  fontWeight: 500,
  color: tokens.text.secondary,
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '7px 10px',
  color: tokens.text.primary,
};

const inlineCode: React.CSSProperties = {
  background: tokens.surface.elevated,
  padding: '1px 4px',
  borderRadius: tokens.radius.sm,
  fontSize: tokens.fontSize.xs,
  color: tokens.syntax.param,
};

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: `8px ${tokens.space['5']}`,
    background: disabled ? tokens.surface.input : tokens.status.accentDark,
    border: 'none',
    borderRadius: tokens.radius.md,
    color: tokens.text.white,
    fontSize: tokens.fontSize.base,
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  };
}

function dangerButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: `8px ${tokens.space['5']}`,
    background: disabled ? tokens.surface.input : '#c5000b',
    border: 'none',
    borderRadius: tokens.radius.md,
    color: tokens.text.white,
    fontSize: tokens.fontSize.base,
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  };
}
