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

      {/* Traffic card list — no table, no horizontal scroll */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
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
          filteredLogs.map((log) => (
            <TrafficRow key={log.id} log={log} isSelected={selectedId === log.id} onClick={handleSelect} />
          ))
        )}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────
function extractPath(url: string): string {
  try { const u = new URL(url); return u.pathname + u.search; } catch { return url; }
}

function methodBg(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':    return '#1a5c2a';
    case 'POST':   return '#1a3d5c';
    case 'PUT':    return '#5c4a1a';
    case 'PATCH':  return '#3d1a5c';
    case 'DELETE': return '#5c1a1a';
    default:       return '#3a3a3a';
  }
}

function statusStyle(status?: number) {
  if (!status) return { bg: 'rgba(60,60,60,0.2)', fg: tokens.text.muted, border: 'rgba(100,100,100,0.4)' };
  if (status < 300) return { bg: 'rgba(58,110,58,0.25)',  fg: '#89d185', border: 'rgba(58,110,58,0.5)' };
  if (status < 400) return { bg: 'rgba(14,99,156,0.25)',  fg: '#6db3e8', border: 'rgba(14,99,156,0.5)' };
  if (status < 500) return { bg: 'rgba(122,90,30,0.25)',  fg: '#ddb165', border: 'rgba(122,90,30,0.5)' };
  return                     { bg: 'rgba(156,14,14,0.25)', fg: '#f28b82', border: 'rgba(156,14,14,0.5)' };
}

// ── TrafficRow card ────────────────────────────────────────────────────────
function TrafficRow({ log, isSelected, onClick }: { log: TrafficLog; isSelected: boolean; onClick: (l: TrafficLog) => void }) {
  const [hovered, setHovered] = useState(false);
  const ss = statusStyle(log.status);
  const path = extractPath(log.url);
  return (
    <div
      onClick={() => onClick(log)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={log.url}
      style={{
        padding: '8px 12px',
        cursor: 'pointer',
        background: isSelected ? tokens.surface.active : hovered ? tokens.surface.stripe : 'transparent',
        borderBottom: `1px solid ${tokens.surface.elevated}`,
      }}
    >
      {/* Line 1: method badge + path (no hostname) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '1px 6px',
          borderRadius: 3, fontFamily: 'monospace', flexShrink: 0,
          color: 'white', background: methodBg(log.method),
        }}>
          {log.method}
        </span>
        <span style={{
          fontSize: tokens.fontSize.sm,
          color: tokens.text.primary,
          fontFamily: 'monospace',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
        }}>
          {path}
        </span>
      </div>
      {/* Line 2: time + status chip + duration */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 10, color: tokens.text.hint, flexShrink: 0 }}>
          {new Date(log.timestamp).toLocaleTimeString()}
        </span>
        {log.status != null && (
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '1px 6px',
            borderRadius: 8, flexShrink: 0,
            background: ss.bg, color: ss.fg, border: `1px solid ${ss.border}`,
          }}>
            {log.status}
          </span>
        )}
        {log.duration != null && (
          <span style={{ fontSize: 10, color: tokens.text.muted }}>{log.duration}ms</span>
        )}
      </div>
    </div>
  );
}

