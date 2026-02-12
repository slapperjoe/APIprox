import React, { useState, useEffect } from 'react';
import { bridge } from '../utils/bridge';

interface ServerControlProps {
  onStatusChange?: (enabled: boolean) => void;
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
      setProxyEnabled(status.enabled);
      if (status.port) setProxyPort(status.port);
      onStatusChange?.(status.enabled);
    } catch (err: any) {
      console.error('Failed to load status:', err);
    }
  }

  async function handleStart() {
    setLoading(true);
    setError(null);
    try {
      const result = await bridge.startProxy({ port: proxyPort, mode, targetUrl });
      if (result.success) {
        setProxyEnabled(true);
        onStatusChange?.(true);
      } else {
        setError(result.error || 'Failed to start proxy');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start proxy');
    } finally {
      setLoading(false);
    }
  }

  async function handleStop() {
    setLoading(true);
    setError(null);
    try {
      const result = await bridge.stopProxy();
      if (result.success) {
        setProxyEnabled(false);
        onStatusChange?.(false);
      } else {
        setError(result.error || 'Failed to stop proxy');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to stop proxy');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      padding: '20px',
      background: '#252526',
      borderRadius: '6px',
      marginBottom: '20px'
    }}>
      <h2 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 500 }}>
        Proxy Server Control
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Target URL Input */}
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#cccccc' }}>
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
              background: '#3c3c3c',
              border: '1px solid #555',
              borderRadius: '4px',
              color: '#cccccc',
              fontSize: '13px'
            }}
          />
          <div style={{ fontSize: '11px', color: '#858585', marginTop: '4px' }}>
            The upstream server to forward requests to (e.g., http://localhost:8080, https://api.example.com)
          </div>
        </div>

        {/* Port Input */}
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#cccccc' }}>
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
              background: '#3c3c3c',
              border: '1px solid #555',
              borderRadius: '4px',
              color: '#cccccc',
              fontSize: '13px'
            }}
          />
        </div>

        {/* Mode Selection */}
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#cccccc' }}>
            Mode
          </label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as any)}
            disabled={proxyEnabled || loading}
            style={{
              padding: '8px 12px',
              background: '#3c3c3c',
              border: '1px solid #555',
              borderRadius: '4px',
              color: '#cccccc',
              fontSize: '13px'
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
                background: '#0e639c',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                fontSize: '13px',
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
                borderRadius: '4px',
                color: 'white',
                fontSize: '13px',
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
            borderRadius: '4px',
            fontSize: '13px',
            color: '#6fbf6f'
          }}>
            🟢 Proxy server running on port {proxyPort}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div style={{
            padding: '12px',
            background: '#3d1a1a',
            border: '1px solid #6a2d2d',
            borderRadius: '4px',
            fontSize: '13px',
            color: '#bf6f6f'
          }}>
            ❌ {error}
          </div>
        )}
      </div>
    </div>
  );
}
