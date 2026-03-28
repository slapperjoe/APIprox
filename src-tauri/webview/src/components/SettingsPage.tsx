import React, { useState, useEffect } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { CertificateManager } from './CertificateManager';
import { tokens } from '../styles/tokens';

export function SettingsPage() {
  const [httpsEnabled, setHttpsEnabled] = useState(true);
  const [trustCertificate, setTrustCertificate] = useState(false);
  const [defaultPort, setDefaultPort] = useState(8888);
  const [appVersion, setAppVersion] = useState<string>('...');
  const [testStatus, setTestStatus] = useState<string | null>(null);

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => setAppVersion('unknown'));
  }, []);

  async function sendTestRequests() {
    setTestStatus('Sending...');
    const requests = [
      fetch('https://httpbin.org/get'),
      fetch('https://httpbin.org/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true, from: 'APIprox' }),
      }),
      fetch('https://httpbin.org/status/404'),
      fetch('https://httpbin.org/status/500'),
      fetch('https://httpbin.org/delay/1'),
    ];
    const results = await Promise.allSettled(requests);
    const ok = results.filter(r => r.status === 'fulfilled').length;
    const fail = results.filter(r => r.status === 'rejected').length;
    setTestStatus(`Done — ${ok} sent${fail > 0 ? `, ${fail} failed (may need HTTPS cert trust)` : ''}`);
    setTimeout(() => setTestStatus(null), 6000);
  }

  const sectionStyle: React.CSSProperties = {
    background: tokens.surface.panel,
    borderRadius: tokens.radius.lg,
    padding: '20px',
    marginBottom: '16px',
  };

  const sectionHeadStyle: React.CSSProperties = {
    margin: '0 0 16px 0',
    fontSize: '14px',
    fontWeight: 600,
    textTransform: 'uppercase',
    color: tokens.text.muted,
    letterSpacing: '0.05em',
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 500 }}>Settings</h2>

      {/* Row 1: About + Default Port side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>

        <div style={sectionStyle}>
          <h3 style={sectionHeadStyle}>About</h3>
          <div style={{ fontSize: tokens.fontSize.base, color: tokens.text.secondary, lineHeight: '1.7' }}>
            <div><span style={{ color: tokens.text.muted }}>Version</span> &nbsp; {appVersion}</div>
            <div><span style={{ color: tokens.text.muted }}>Stack</span> &nbsp; Tauri 2 · Rust · React</div>
            <div style={{ marginTop: '8px', fontSize: tokens.fontSize.sm, color: tokens.text.muted }}>
              Desktop HTTP/HTTPS proxy and mock server for API testing and debugging.
            </div>
          </div>
        </div>

        <div style={sectionStyle}>
          <h3 style={sectionHeadStyle}>Default Port</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input
              type="number"
              value={defaultPort}
              onChange={(e) => setDefaultPort(parseInt(e.target.value))}
              style={{
                width: '100px',
                padding: '8px 12px',
                background: tokens.surface.input,
                border: `1px solid ${tokens.border.subtle}`,
                borderRadius: tokens.radius.md,
                color: tokens.text.secondary,
                fontSize: tokens.fontSize.base,
              }}
            />
            <span style={{ fontSize: tokens.fontSize.base, color: tokens.text.muted }}>
              Default proxy port for new sessions
            </span>
          </div>
        </div>
      </div>

      {/* HTTPS Interception */}
      <div style={sectionStyle}>
        <h3 style={sectionHeadStyle}>HTTPS Interception</h3>

        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '12px' }}>
          <input
            type="checkbox"
            checked={httpsEnabled}
            onChange={(e) => setHttpsEnabled(e.target.checked)}
            style={{ width: '16px', height: '16px' }}
          />
          <div>
            <div style={{ fontSize: tokens.fontSize.base }}>Enable HTTPS Interception</div>
            <div style={{ fontSize: tokens.fontSize.sm, color: tokens.text.muted, marginTop: '2px' }}>
              Allows proxying and modifying HTTPS traffic via on-the-fly certificate signing
            </div>
          </div>
        </label>

        {httpsEnabled && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', paddingLeft: '28px' }}>
            <input
              type="checkbox"
              checked={trustCertificate}
              onChange={(e) => setTrustCertificate(e.target.checked)}
              style={{ width: '16px', height: '16px' }}
            />
            <div>
              <div style={{ fontSize: tokens.fontSize.base }}>Auto-trust generated certificates</div>
              <div style={{ fontSize: tokens.fontSize.sm, color: tokens.text.muted, marginTop: '2px' }}>
                Automatically add APIprox CA to the system trust store after generation
              </div>
            </div>
          </label>
        )}
      </div>

      {/* Certificate Management */}
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ ...sectionHeadStyle, paddingLeft: '4px', marginBottom: '12px' }}>Certificate Management</h3>
        <CertificateManager />
      </div>

      {/* Developer Tools */}
      <div style={{ ...sectionStyle, marginBottom: 0 }}>
        <h3 style={sectionHeadStyle}>Developer Tools</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={sendTestRequests}
            disabled={testStatus === 'Sending...'}
            style={{
              padding: '7px 16px',
              background: tokens.surface.input,
              border: `1px solid ${tokens.border.subtle}`,
              borderRadius: tokens.radius.md,
              color: tokens.text.secondary,
              fontSize: tokens.fontSize.sm,
              cursor: testStatus === 'Sending...' ? 'wait' : 'pointer',
              opacity: testStatus === 'Sending...' ? 0.7 : 1,
            }}
          >
            Send Test Requests
          </button>
          {testStatus && (
            <span style={{ fontSize: tokens.fontSize.sm, color: tokens.text.muted }}>
              {testStatus}
            </span>
          )}
          <span style={{ fontSize: tokens.fontSize.xs, color: tokens.text.hint }}>
            Fires 5 requests to httpbin.org — useful for testing sniffer/traffic capture
          </span>
        </div>
      </div>
    </div>
  );
}

