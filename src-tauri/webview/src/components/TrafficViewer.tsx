import React, { useState, useMemo } from 'react';
import { TrafficLog } from '../types';
import { tokens } from '../styles/tokens';

const HTTP_METHODS = ['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

interface TrafficViewerProps {
  logs: TrafficLog[];
  onSelectLog?: (log: TrafficLog) => void;
}

export function TrafficViewer({ logs, onSelectLog }: TrafficViewerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [urlFilter, setUrlFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('');

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
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
  }, [logs, urlFilter, methodFilter, statusFilter]);

  function handleSelect(log: TrafficLog) {
    setSelectedId(log.id);
    onSelectLog?.(log);
  }

  const hasFilters = urlFilter || methodFilter !== 'ALL' || statusFilter;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: tokens.surface.base }}>
      {/* Filter bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.space['4'],
        padding: `${tokens.space['3']} ${tokens.space['6']}`,
        background: tokens.surface.elevated,
        borderBottom: `1px solid ${tokens.border.default}`,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: tokens.fontSize.base, color: tokens.text.secondary, fontWeight: 500, whiteSpace: 'nowrap' }}>
          Traffic ({filteredLogs.length}{logs.length !== filteredLogs.length ? `/${logs.length}` : ''})
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
          {HTTP_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
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

        {hasFilters && (
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

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        {filteredLogs.length === 0 ? (
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
            <div>{logs.length === 0 ? 'No traffic captured yet. Start the proxy to begin.' : 'No entries match the current filters.'}</div>
          </div>
        ) : (
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
              {filteredLogs.map((log) => (
                <TrafficRow
                  key={log.id}
                  log={log}
                  isSelected={selectedId === log.id}
                  onClick={handleSelect}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
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
      <td style={tdStyle}>{new Date(log.timestamp).toLocaleTimeString()}</td>
      <td style={{ ...tdStyle, color: tokens.syntax.request, fontWeight: 600 }}>{log.method}</td>
      <td style={{ ...tdStyle, maxWidth: '500px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.url}</td>
      <td style={{ ...tdStyle, color: statusColor(log.status), fontWeight: 600 }}>{log.status ?? '—'}</td>
      <td style={{ ...tdStyle, textAlign: 'right', color: tokens.text.muted }}>{log.duration != null ? `${log.duration}ms` : '—'}</td>
    </tr>
  );
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

