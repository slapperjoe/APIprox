import React, { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ServerControl } from './components/ServerControl';
import { TrafficViewer } from './components/TrafficViewer';
import { RulesPage } from './components/RulesPage';
import { MockRulesPage } from './components/MockRulesPage';
import { BreakpointsPage } from './components/BreakpointsPage';
import { FileWatcherPage } from './components/FileWatcherPage';
import { SettingsPage } from './components/SettingsPage';
import { HelpPage } from './components/HelpPage';
import { TrafficLog } from './types';

type Tab = 'proxy' | 'traffic' | 'rules' | 'mock' | 'breakpoints' | 'filewatcher' | 'settings' | 'help';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('proxy');
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [proxyStatus, setProxyStatus] = useState<{ port: number; mode: string } | null>(null);
  const [trafficLogs, setTrafficLogs] = useState<TrafficLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<TrafficLog | null>(null);
  const [pausedCount, setPausedCount] = useState(0);

  // Keep native window title in sync with proxy status
  useEffect(() => {
    const appWindow = getCurrentWindow();
    if (proxyEnabled && proxyStatus) {
      const modeLabel = proxyStatus.mode === 'both' ? 'Proxy + Mock'
        : proxyStatus.mode === 'mock' ? 'Mock'
        : 'Proxy';
      appWindow.setTitle(`APIprox  [🟢 ${modeLabel} :${proxyStatus.port}]`);
    } else {
      appWindow.setTitle('APIprox  [🔴 Stopped]');
    }
  }, [proxyEnabled, proxyStatus]);

  useEffect(() => {
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
      background: '#1e1e1e',
      color: '#d4d4d4',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      {/* Tab Bar */}
      <div style={{
        height: '36px',
        background: '#2d2d30',
        borderBottom: '1px solid #3e3e42',
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px'
      }}>
        {(['proxy', 'traffic', 'rules', 'mock', 'breakpoints', 'filewatcher', 'settings', 'help'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); if (tab === 'breakpoints') setPausedCount(0); }}
            style={{
              padding: '6px 16px',
              background: activeTab === tab ? '#1e1e1e' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #007acc' : 'none',
              color: tab === 'breakpoints' && pausedCount > 0 ? '#f14c4c' : activeTab === tab ? '#ffffff' : '#cccccc',
              fontSize: '13px',
              cursor: 'pointer',
              textTransform: 'capitalize',
              position: 'relative',
            }}
          >
            {tab === 'rules' ? 'Replace Rules' : tab === 'mock' ? 'Mock Server' : tab === 'filewatcher' ? 'File Watcher' : tab}
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
              padding: '20px',
              background: '#252526',
              borderRadius: '6px',
              marginTop: '20px'
            }}>
              <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 500 }}>
                Quick Start
              </h2>
              <ol style={{ paddingLeft: '24px', lineHeight: '1.6', color: '#cccccc' }}>
                <li>Click "Start Proxy" to begin intercepting traffic</li>
                <li>Configure your application to use proxy: <code style={{ background: '#1e1e1e', padding: '2px 6px', borderRadius: '3px' }}>http://localhost:8888</code></li>
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
                padding: '20px',
                background: '#252526',
                borderTop: '1px solid #3e3e42',
                maxHeight: '300px',
                overflow: 'auto'
              }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>
                  Request Details
                </h3>
                <pre style={{
                  background: '#1e1e1e',
                  padding: '12px',
                  borderRadius: '4px',
                  fontSize: '12px',
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
