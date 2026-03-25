import React, { useState } from 'react';
import { TrafficLog } from '../types';
import { tokens } from '../styles/tokens';

interface TrafficViewerProps {
  logs: TrafficLog[];
  onSelectLog?: (log: TrafficLog) => void;
}

export function TrafficViewer({ logs, onSelectLog }: TrafficViewerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function handleSelect(log: TrafficLog) {
    setSelectedId(log.id);
    onSelectLog?.(log);
  }

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  }

  function getStatusColor(status?: number): string {
    if (!status) return '#888';
    if (status >= 200 && status < 300) return '#6fbf6f';
    if (status >= 300 && status < 400) return '#6f9fbf';
    if (status >= 400 && status < 500) return '#bfaf6f';
    return '#bf6f6f';
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: tokens.surface.base
    }}>
      <div style={{
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 500 }}>Traffic Log ({logs.length})</h2>
      </div>

      <div style={{
        flex: 1,
        overflow: 'auto'
      }}>
        {logs.length === 0 ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: tokens.text.muted,
            fontSize: '13px'
          }}>
            No traffic captured yet. Start the proxy server to begin.
          </div>
        ) : (
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '12px'
          }}>
            <thead style={{
              position: 'sticky',
              top: 0,
              background: tokens.surface.panel,
              borderBottom: `1px solid ${tokens.border.default}`
            }}>
              <tr>
                <th style={{ padding: '8px', textAlign: 'left', fontWeight: 500, color: tokens.text.secondary }}>Time</th>
                <th style={{ padding: '8px', textAlign: 'left', fontWeight: 500, color: tokens.text.secondary }}>Method</th>
                <th style={{ padding: '8px', textAlign: 'left', fontWeight: 500, color: tokens.text.secondary }}>URL</th>
                <th style={{ padding: '8px', textAlign: 'left', fontWeight: 500, color: tokens.text.secondary }}>Status</th>
                <th style={{ padding: '8px', textAlign: 'right', fontWeight: 500, color: tokens.text.secondary }}>Duration</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  onClick={() => handleSelect(log)}
                  style={{
                    cursor: 'pointer',
                    background: selectedId === log.id ? tokens.surface.active : 'transparent',
                    borderBottom: `1px solid ${tokens.surface.elevated}`
                  }}
                  onMouseEnter={(e) => {
                    if (selectedId !== log.id) {
                      e.currentTarget.style.background = tokens.surface.stripe;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedId !== log.id) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <td style={{ padding: '8px', color: tokens.text.secondary }}>{formatTime(log.timestamp)}</td>
                  <td style={{ padding: '8px', color: tokens.syntax.request, fontWeight: 500 }}>{log.method}</td>
                  <td style={{ padding: '8px', color: tokens.text.primary, maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.url}
                  </td>
                  <td style={{ padding: '8px', color: getStatusColor(log.status), fontWeight: 500 }}>
                    {log.status || '-'}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', color: tokens.text.muted }}>
                    {log.duration ? `${log.duration}ms` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
