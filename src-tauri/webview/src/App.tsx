import React, { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow, UserAttentionType } from '@tauri-apps/api/window';
import { platform } from '@tauri-apps/plugin-os';
import { ServerControl } from './components/ServerControl';
import { TrafficViewer } from './components/TrafficViewer';
import { RulesPage } from './components/RulesPage';
import { MockRulesPage } from './components/MockRulesPage';
import { BreakpointsPage } from './components/BreakpointsPage';
import { FileWatcherPage } from './components/FileWatcherPage';
import { SettingsPage } from './components/SettingsPage';
import { HelpPage } from './components/HelpPage';
import { TrafficLog } from './types';
import { tokens } from './styles/tokens';

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
  }, []);

  // Keep native window title in sync with proxy status
  useEffect(() => {
    const appWindow = getCurrentWindow();
    if (proxyEnabled && proxyStatus) {
      const modeLabel = MODE_TITLE_LABELS[proxyStatus.mode] ?? proxyStatus.mode;
      // macOS renders color emoji in the title bar; Windows/Linux do not
      if (platformOS === 'macos') {
        appWindow.setTitle(`APIprox  [🟢 ${modeLabel} :${proxyStatus.port}]`);
      } else {
        appWindow.setTitle(`APIprox  [▶ ${modeLabel} :${proxyStatus.port}]`);
      }
    } else {
      if (platformOS === 'macos') {
        appWindow.setTitle('APIprox  [🔴 Stopped]');
      } else {
        appWindow.setTitle('APIprox  [■ Stopped]');
      }
    }
  }, [proxyEnabled, proxyStatus, platformOS]);

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
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'proxy' && (
          <div style={{ padding: '20px' }}>
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
        )}

        {activeTab === 'traffic' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, minHeight: 0 }}>
              <TrafficViewer 
                logs={trafficLogs} 
                onSelectLog={setSelectedLog}
              />
            </div>
            
            {selectedLog && (
              <div style={{
                padding: tokens.space['6'],
                background: tokens.surface.panel,
                borderTop: `1px solid ${tokens.border.default}`,
                maxHeight: '300px',
                overflow: 'auto'
              }}>
                <h3 style={{ margin: `0 0 ${tokens.space['4']} 0`, fontSize: tokens.fontSize.lg }}>
                  Request Details
                </h3>
                <pre style={{
                  background: tokens.surface.base,
                  padding: tokens.space['4'],
                  borderRadius: tokens.radius.md,
                  fontSize: tokens.fontSize.sm,
                  overflow: 'auto',
                  margin: 0
                }}>
                  {JSON.stringify(selectedLog, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {activeTab === 'rules' && <RulesPage />}
        
        {activeTab === 'mock' && <MockRulesPage />}
        
        {activeTab === 'breakpoints' && <BreakpointsPage />}
        
        {activeTab === 'filewatcher' && <FileWatcherPage />}

        {activeTab === 'settings' && <SettingsPage />}
        
        {activeTab === 'help' && <HelpPage />}
      </div>
    </div>
  );
}

export default App;
