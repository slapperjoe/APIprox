import React, { useState, useEffect } from 'react';
import { bridge } from '../utils/bridge';
import { tokens } from '../styles/tokens';

interface ServerControlProps {
  onStatusChange?: (info: { running: boolean; port: number; mode: string }) => void;
}

export function ServerControl({ onStatusChange }: ServerControlProps) {
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [proxyPort, setProxyPort] = useState(8888);
  const [targetUrl, setTargetUrl] = useState('http://localhost:3000');
  const [mode, setMode] = useState<'proxy' | 'mock' | 'both'>('proxy');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadStatus() {
    try {
      const status = await bridge.getProxyStatus();
      setStatus(status);
      setProxyEnabled(status.running);
      if (status.port) setProxyPort(status.port);
      if (status.running) {
        if (status.mode) setMode(status.mode as any);
        if (status.targetUrl !== undefined) setTargetUrl(status.targetUrl);
      }
      onStatusChange?.({ running: status.running, port: status.port ?? proxyPort, mode: status.mode ?? mode });
    } catch (err: any) {
      console.error('Failed to load status:', err);
    }
  }

  async function handleStart() {
    setLoading(true);
    setError(null);
    try {
      await bridge.startProxy({ port: proxyPort, mode, targetUrl });
      setProxyEnabled(true);
      onStatusChange?.({ running: true, port: proxyPort, mode });
    } catch (err: any) {
      setError(err.message || String(err) || 'Failed to start proxy');
    } finally {
      setLoading(false);
    }
  }

  async function handleStop() {
    setLoading(true);
    setError(null);
    try {
      await bridge.stopProxy();
      setProxyEnabled(false);
      onStatusChange?.({ running: false, port: proxyPort, mode });
    } catch (err: any) {
      setError(err.message || String(err) || 'Failed to stop proxy');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      padding: '20px',
      background: tokens.surface.panel,
      borderRadius: tokens.radius.lg,
      marginBottom: '20px'
    }}>
      <h2 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 500 }}>
        Proxy Server Control
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Target URL Input */}
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: tokens.fontSize.base, color: tokens.text.secondary }}>
            Target URL
          </label>
          <input
            type="text"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            disabled={proxyEnabled || loading}
            placeholder="http://localhost:3000"
            style={{
              width: '100%',
              padding: '8px 12px',
              background: tokens.surface.input,
              border: `1px solid ${tokens.border.subtle}`,
              borderRadius: tokens.radius.md,
              color: tokens.text.secondary,
              fontSize: tokens.fontSize.base
            }}
          />
          <div style={{ fontSize: tokens.fontSize.xs, color: tokens.text.muted, marginTop: '4px' }}>
            The upstream server to forward requests to (e.g., http://localhost:8080, https://api.example.com)
          </div>
        </div>

        {/* Port Input */}
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: tokens.fontSize.base, color: tokens.text.secondary }}>
            Port
          </label>
          <input
            type="number"
            value={proxyPort}
            onChange={(e) => setProxyPort(parseInt(e.target.value))}
            disabled={proxyEnabled || loading}
            style={{
              width: '100px',
              padding: '8px 12px',
              background: tokens.surface.input,
              border: `1px solid ${tokens.border.subtle}`,
              borderRadius: tokens.radius.md,
              color: tokens.text.secondary,
              fontSize: tokens.fontSize.base
            }}
          />
        </div>

        {/* Mode Selection */}
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: tokens.fontSize.base, color: tokens.text.secondary }}>
            Mode
          </label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as any)}
            disabled={proxyEnabled || loading}
            style={{
              padding: '8px 12px',
              background: tokens.surface.input,
              border: `1px solid ${tokens.border.subtle}`,
              borderRadius: tokens.radius.md,
              color: tokens.text.secondary,
              fontSize: tokens.fontSize.base
            }}
          >
            <option value="proxy">Proxy Only</option>
            <option value="mock">Mock Only</option>
            <option value="both">Proxy + Mock</option>
          </select>
        </div>

        {/* Control Buttons */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          {!proxyEnabled ? (
            <button
              onClick={handleStart}
              disabled={loading}
              style={{
                padding: '10px 24px',
                background: tokens.status.accentDark,
                border: 'none',
                borderRadius: tokens.radius.md,
                color: tokens.text.white,
                fontSize: tokens.fontSize.base,
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? 'Starting...' : 'Start Proxy'}
            </button>
          ) : (
            <button
              onClick={handleStop}
              disabled={loading}
              style={{
                padding: '10px 24px',
                background: '#c5000b',
                border: 'none',
                borderRadius: tokens.radius.md,
                color: tokens.text.white,
                fontSize: tokens.fontSize.base,
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? 'Stopping...' : 'Stop Proxy'}
            </button>
          )}
        </div>

        {/* Status Indicator */}
        {proxyEnabled && (
          <div style={{
            padding: '12px',
            background: '#1a3d1a',
            border: '1px solid #2d6a2d',
            borderRadius: tokens.radius.md,
            fontSize: tokens.fontSize.base,
            color: '#6fbf6f'
          }}>
            🟢 {mode === 'both' ? 'Proxy + Mock' : mode === 'mock' ? 'Mock server' : 'Proxy'} running on port {proxyPort}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div style={{
            padding: '12px',
            background: '#3d1a1a',
            border: '1px solid #6a2d2d',
            borderRadius: tokens.radius.md,
            fontSize: tokens.fontSize.base,
            color: '#bf6f6f'
          }}>
            ❌ {error}
          </div>
        )}
      </div>
    </div>
  );
}
