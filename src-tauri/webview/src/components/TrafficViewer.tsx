import React, { useState } from 'react';
import { TrafficLog } from '../types';

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
      background: '#1e1e1e'
    }}>
      <div style={{
        padding: '12px 16px',
        background: '#252526',
        borderBottom: '1px solid #3e3e42',
        fontSize: '13px',
        fontWeight: 500
      }}>
        Traffic Log ({logs.length})
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
            color: '#858585',
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
              background: '#252526',
              borderBottom: '1px solid #3e3e42'
            }}>
              <tr>
                <th style={{ padding: '8px', textAlign: 'left', fontWeight: 500, color: '#cccccc' }}>Time</th>
                <th style={{ padding: '8px', textAlign: 'left', fontWeight: 500, color: '#cccccc' }}>Method</th>
                <th style={{ padding: '8px', textAlign: 'left', fontWeight: 500, color: '#cccccc' }}>URL</th>
                <th style={{ padding: '8px', textAlign: 'left', fontWeight: 500, color: '#cccccc' }}>Status</th>
                <th style={{ padding: '8px', textAlign: 'right', fontWeight: 500, color: '#cccccc' }}>Duration</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  onClick={() => handleSelect(log)}
                  style={{
                    cursor: 'pointer',
                    background: selectedId === log.id ? '#37373d' : 'transparent',
                    borderBottom: '1px solid #2d2d30'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedId !== log.id) {
                      e.currentTarget.style.background = '#2a2d2e';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedId !== log.id) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <td style={{ padding: '8px', color: '#cccccc' }}>{formatTime(log.timestamp)}</td>
                  <td style={{ padding: '8px', color: '#4ec9b0', fontWeight: 500 }}>{log.method}</td>
                  <td style={{ padding: '8px', color: '#d4d4d4', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.url}
                  </td>
                  <td style={{ padding: '8px', color: getStatusColor(log.status), fontWeight: 500 }}>
                    {log.status || '-'}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'right', color: '#858585' }}>
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
