import React, { useState, useEffect, useRef, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow, UserAttentionType } from '@tauri-apps/api/window';
import { getVersion } from '@tauri-apps/api/app';
import { platform } from '@tauri-apps/plugin-os';
import { ServerControl } from './components/ServerControl';
import { TrafficViewer } from './components/TrafficViewer';
import { TrafficDetails } from './components/TrafficDetails';
import { RulesPage } from './components/RulesPage';
import { MockRulesPage } from './components/MockRulesPage';
import { BreakpointsPage } from './components/BreakpointsPage';
import { FileWatcherPage } from './components/FileWatcherPage';
import { SettingsPage } from './components/SettingsPage';
import { HelpPage } from './components/HelpPage';
import { TrafficLog } from './types';
import { tokens } from './styles/tokens';
import { useIgnoreList } from './utils/useIgnoreList';
import { ConditionPickerModal, suggestConditionsFromSoapXml, SuggestedCondition } from './components/ConditionPickerModel';

type Tab = 'proxy' | 'traffic' | 'rules' | 'mock' | 'breakpoints' | 'filewatcher' | 'settings' | 'help';

const TAB_LABELS: Record<Tab, string> = {
  proxy: 'Proxy',
  traffic: 'Traffic',
  rules: 'Replace Rules',
  mock: 'Mock Server',
  breakpoints: 'Breakpoints',
  filewatcher: 'File Watcher',
  settings: 'Settings',
  help: 'Help',
};

const MODE_TITLE_LABELS: Record<string, string> = {
  proxy: 'Proxy',
  mock: 'Mock',
  both: 'Proxy + Mock',
  sniffer: 'Sniffer',
  'sniffer-mock': 'Sniffer + Mock',
};

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('proxy');
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [proxyStatus, setProxyStatus] = useState<{ port: number; mode: string } | null>(null);
  const [trafficLogs, setTrafficLogs] = useState<TrafficLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<TrafficLog | null>(null);
  const [pausedCount, setPausedCount] = useState(0);
  const [platformOS, setPlatformOS] = useState<string>('unknown');
  const [isFocused, setIsFocused] = useState(true);
  const [appVersion, setAppVersion] = useState<string>('');
  const { rules: ignoreRules, addRule: addIgnoreRule, removeRule: removeIgnoreRule } = useIgnoreList();

  // ── Traffic → Rule creation ───────────────────────────────────────────────
  // Pending pre-filled rules to open in the target page modals
  const [pendingMockRule, setPendingMockRule] = useState<any | null>(null);
  const [pendingReplaceForm, setPendingReplaceForm] = useState<{ name: string; matchText: string; replaceWith: string; target: 'request' | 'response' | 'both'; isRegex: boolean; xpath: string } | null>(null);
  const [conditionPickerState, setConditionPickerState] = useState<{ log: TrafficLog; suggestions: SuggestedCondition[] } | null>(null);

  function extractUrlPath(url: string): string {
    try { const u = new URL(url); return u.pathname + u.search; } catch { return url; }
  }

  function handleCreateMockRule(log: TrafficLog) {
    const ct = (log.responseHeaders?.['content-type'] ?? log.responseHeaders?.['Content-Type'] ?? 'text/xml; charset=utf-8') as string;
    const isXml = ct.includes('xml') || ct.includes('soap');
    const path = extractUrlPath(log.url);

    const httpSuggestions: SuggestedCondition[] = [
      {
        label: `URL contains "${path}"`,
        condition: { type: 'url', pattern: path, isRegex: false },
        recommended: true,
        group: 'HTTP',
      },
      {
        label: `Method = ${log.method}`,
        condition: { type: 'method', pattern: log.method, isRegex: false },
        recommended: false,
        group: 'HTTP',
      },
    ];

    const xmlSuggestions: SuggestedCondition[] = (isXml && log.requestBody)
      ? suggestConditionsFromSoapXml(log.requestBody)
      : [];

    // SOAP/XML conditions first, HTTP at end
    setConditionPickerState({ log, suggestions: [...xmlSuggestions, ...httpSuggestions] });
  }

  function handleConditionsConfirmed(conditions: any[]) {
    if (!conditionPickerState) return;
    const { log } = conditionPickerState;
    const ct = (log.responseHeaders?.['content-type'] ?? log.responseHeaders?.['Content-Type'] ?? 'text/xml; charset=utf-8') as string;
    const path = extractUrlPath(log.url);
    setPendingMockRule({
      id: '',
      name: `Mock ${path}`,
      enabled: true,
      conditions: conditions.length > 0 ? conditions : [{ type: 'url', pattern: path, isRegex: false }],
      statusCode: log.status ?? 200,
      contentType: ct,
      responseBody: log.responseBody ?? '',
      responseHeaders: { ...(log.responseHeaders ?? {}) },
      delayMs: 0,
      tags: [],
    });
    setConditionPickerState(null);
    setActiveTab('mock');
  }

  function handleCreateReplaceRule(log: any) {
    const path = extractUrlPath(log.url);
    setPendingReplaceForm({
      name: `Replace in ${path}`,
      matchText: '',
      replaceWith: '',
      target: 'response',
      isRegex: false,
      xpath: '',
    });
    setActiveTab('rules');
  }

  // Resizable traffic sidebar
  const [sidebarWidth, setSidebarWidth] = useState(360);
  const sidebarDragging = useRef(false);
  const handleSidebarDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    sidebarDragging.current = true;
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(200, Math.min(startWidth + (ev.clientX - startX), 700));
      setSidebarWidth(next);
    };
    const onUp = () => {
      sidebarDragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  // Taskbar attention: flash/bounce when breakpoints are held and window is not focused
  useEffect(() => {
    const appWindow = getCurrentWindow();
    if (pausedCount > 0 && !isFocused) {
      console.warn('[APIprox] requestUserAttention(Critical) — pausedCount:', pausedCount, 'isFocused:', isFocused);
      appWindow.requestUserAttention(UserAttentionType.Critical)
        .then(() => console.info('[APIprox] requestUserAttention(Critical) succeeded'))
        .catch((err) => console.error('[APIprox] requestUserAttention(Critical) failed:', err));
    } else {
      console.info('[APIprox] requestUserAttention(null) — cancelling attention. pausedCount:', pausedCount, 'isFocused:', isFocused);
      appWindow.requestUserAttention(null)
        .catch((err) => console.error('[APIprox] requestUserAttention(null) failed:', err));
    }
  }, [pausedCount, isFocused]);

  // Detect platform once on mount (platform() is synchronous in @tauri-apps/plugin-os)
  useEffect(() => {
    try {
      setPlatformOS(platform());
    } catch {
      // not in Tauri environment
    }
    getVersion().then(v => setAppVersion(v)).catch(() => {});
  }, []);

  // Keep native window title in sync with proxy status and version
  useEffect(() => {
    const appWindow = getCurrentWindow();
    const ver = appVersion ? ` v${appVersion}` : '';
    let title: string;
    if (proxyEnabled && proxyStatus) {
      const modeLabel = MODE_TITLE_LABELS[proxyStatus.mode] ?? proxyStatus.mode;
      if (platformOS === 'macos') {
        title = `APIprox${ver}  [🟢 ${modeLabel} :${proxyStatus.port}]`;
      } else {
        title = `APIprox${ver}  [▶ ${modeLabel} :${proxyStatus.port}]`;
      }
    } else {
      if (platformOS === 'macos') {
        title = `APIprox${ver}  [🔴 Stopped]`;
      } else {
        title = `APIprox${ver}  [■ Stopped]`;
      }
    }
    // Set both: Tauri setTitle (Windows/macOS) and document.title (Linux/WebKit2GTK)
    console.info('[APIprox] setTitle attempt:', title, 'platformOS:', platformOS);
    document.title = title;
    appWindow.setTitle(title)
      .then(() => console.info('[APIprox] setTitle resolved OK'))
      .catch((err) => console.error('[APIprox] setTitle failed:', err, 'title was:', title));
  }, [proxyEnabled, proxyStatus, platformOS, appVersion]);

  useEffect(() => {
    const appWindow = getCurrentWindow();

    // Track window focus for taskbar attention requests
    const unlistenFocus = appWindow.onFocusChanged(({ payload: focused }) => {
      setIsFocused(focused);
    });

    // Listen for traffic events emitted by the Rust proxy
    const unlistenTraffic = listen<TrafficLog>('traffic-event', (event) => {
      setTrafficLogs(prev => [event.payload, ...prev].slice(0, 1000));
    });

    // Auto-switch to breakpoints tab and update badge when traffic is paused
    const unlistenBreakpoint = listen<any[]>('breakpoint-paused', (event) => {
      const count = event.payload.length;
      setPausedCount(count);
      if (count > 0) {
        setActiveTab('breakpoints');
      }
    });

    return () => {
      unlistenFocus.then(fn => fn());
      unlistenTraffic.then(fn => fn());
      unlistenBreakpoint.then(fn => fn());
    };
  }, []);

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: tokens.surface.base,
      color: tokens.text.primary,
      fontFamily: tokens.fontFamily
    }}>
      {/* Tab Bar */}
      <div style={{
        height: '36px',
        background: tokens.surface.elevated,
        borderBottom: `1px solid ${tokens.border.default}`,

        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        gap: '0'
      }}>
        {/* Status indicator dot — CSS-coloured, works on all platforms */}
        <div
          title={proxyEnabled ? 'Server running' : 'Server stopped'}
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: proxyEnabled ? tokens.status.success : tokens.status.error,
            boxShadow: proxyEnabled
              ? `0 0 5px ${tokens.status.successGlow}`
              : `0 0 5px ${tokens.status.errorGlow}`,

            flexShrink: 0,
            marginLeft: '4px',
            marginRight: '8px',
            transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
          }}
        />
        {(['proxy', 'traffic', 'rules', 'mock', 'breakpoints', 'filewatcher', 'settings', 'help'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); if (tab === 'breakpoints') setPausedCount(0); }}
            style={{
              padding: '6px 16px',
              background: activeTab === tab ? tokens.surface.base : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? `2px solid ${tokens.status.accent}` : 'none',
              color: tab === 'breakpoints' && pausedCount > 0 ? tokens.status.error : activeTab === tab ? tokens.text.white : tokens.text.secondary,
              fontSize: tokens.fontSize.base,
              cursor: 'pointer',
              textTransform: 'capitalize',
              position: 'relative',
            }}
          >
            {TAB_LABELS[tab]}
            {tab === 'breakpoints' && pausedCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                background: tokens.status.error,
                color: '#fff',
                borderRadius: '50%',
                width: '14px',
                height: '14px',
                fontSize: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>{pausedCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* ServerControl is always mounted to preserve mode/sniffer state across tab switches */}
        <div style={{ display: activeTab === 'proxy' ? 'flex' : 'none', flexDirection: 'column', flex: 1, overflow: 'auto', padding: '20px' }}>
          <ServerControl onStatusChange={(info) => {
            setProxyEnabled(info.running);
            setProxyStatus(info.running ? { port: info.port, mode: info.mode } : null);
          }} />

          <div style={{
              padding: tokens.space['6'],
              background: tokens.surface.panel,
              borderRadius: tokens.radius.lg,
              marginTop: tokens.space['6']
            }}>
              <h2 style={{ margin: `0 0 ${tokens.space['5']} 0`, fontSize: tokens.fontSize.xl, fontWeight: 500 }}>
                Quick Start
              </h2>
              <ol style={{ paddingLeft: tokens.space['7'], lineHeight: '1.6', color: tokens.text.secondary }}>
                <li>Click "Start Proxy" to begin intercepting traffic</li>
                <li>Configure your application to use proxy: <code style={{ background: tokens.surface.base, padding: `2px ${tokens.space['2']}`, borderRadius: tokens.radius.sm }}>http://localhost:8888</code></li>
                <li>View captured traffic in the "Traffic" tab</li>
                <li>Create replace rules in the "Replace Rules" tab to modify traffic on the fly</li>
              </ol>
            </div>
          </div>

        {/* Traffic tab is always mounted to preserve filter state across tab switches */}
        <div style={{ display: activeTab === 'traffic' ? 'flex' : 'none', flex: 1, flexDirection: 'row', overflow: 'hidden' }}>
          {/* Left sidebar — traffic list */}
          <div style={{
            width: `${sidebarWidth}px`,
            flexShrink: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <TrafficViewer
              logs={trafficLogs}
              onSelectLog={setSelectedLog}
              ignoreRules={ignoreRules}
              onAddIgnoreRule={addIgnoreRule}
              onCreateMockRule={handleCreateMockRule}
              onCreateReplaceRule={handleCreateReplaceRule}
            />
          </div>

          {/* Resize handle */}
          <div
            onMouseDown={handleSidebarDividerMouseDown}
            style={{
              width: '5px',
              flexShrink: 0,
              background: tokens.border.default,
              cursor: 'col-resize',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = tokens.status.accentDark)}
            onMouseLeave={e => (e.currentTarget.style.background = tokens.border.default)}
          />

          {/* Right — request/response detail */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {selectedLog
              ? <TrafficDetails log={selectedLog} />
              : (
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: tokens.text.muted,
                  fontSize: tokens.fontSize.base,
                  fontStyle: 'italic',
                }}>
                  Select a request to inspect
                </div>
              )
            }
          </div>
        </div>

        <div style={{ display: activeTab === 'rules' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'auto' }}>
          <RulesPage
            pendingForm={pendingReplaceForm}
            onPendingFormConsumed={() => setPendingReplaceForm(null)}
          />
        </div>
        
        {activeTab === 'mock' && (
          <MockRulesPage
            initialRule={pendingMockRule}
            onInitialRuleConsumed={() => setPendingMockRule(null)}
          />
        )}
        {activeTab === 'breakpoints' && <BreakpointsPage />}
        {activeTab === 'filewatcher' && <FileWatcherPage />}
        {activeTab === 'settings' && (
          <div style={{ flex: 1, overflow: 'auto' }}>
            <SettingsPage ignoreRules={ignoreRules} onRemoveIgnoreRule={removeIgnoreRule} onAddIgnoreRule={addIgnoreRule} />
          </div>
        )}
        {activeTab === 'help' && <HelpPage />}
      {conditionPickerState && (
        <ConditionPickerModal
          suggestions={conditionPickerState.suggestions}
          onConfirm={handleConditionsConfirmed}
          onCancel={() => setConditionPickerState(null)}
        />
      )}
      </div>
    </div>
  );
}

export default App;
