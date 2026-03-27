import React, { useState } from 'react';
import { MonacoResponseViewer } from '@apinox/request-editor';
import { TrafficLog } from '../types';
import { tokens } from '../styles/tokens';

interface TrafficDetailsProps {
  log: TrafficLog;
}

type DetailTab = 'request' | 'response' | 'headers' | 'raw';

export function TrafficDetails({ log }: TrafficDetailsProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('response');

  const getLanguage = (contentType?: string): string => {
    if (!contentType) return 'text';
    if (contentType.includes('xml') || contentType.includes('soap')) return 'xml';
    if (contentType.includes('json')) return 'json';
    if (contentType.includes('html')) return 'html';
    return 'text';
  };

  const requestLanguage = getLanguage(log.requestHeaders?.['content-type'] || log.requestHeaders?.['Content-Type']);
  const responseLanguage = getLanguage(log.responseHeaders?.['content-type'] || log.responseHeaders?.['Content-Type']);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      background: tokens.surface.panel,
      height: '100%'
    }}>
      {/* Tab Bar */}
      <div style={{
        display: 'flex',
        gap: '4px',
        padding: '8px 12px',
        background: tokens.surface.elevated,
        borderBottom: `1px solid ${tokens.border.default}`
      }}>
        {(['request', 'response', 'headers', 'raw'] as DetailTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '6px 12px',
              background: activeTab === tab ? tokens.status.accent : 'transparent',
              border: 'none',
              borderRadius: tokens.radius.sm,
              color: activeTab === tab ? tokens.text.white : tokens.text.secondary,
              fontSize: tokens.fontSize.sm,
              cursor: 'pointer',
              textTransform: 'capitalize',
              transition: 'background 0.2s'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'request' && (
          <MonacoResponseViewer
            value={log.requestBody || '(empty)'}
            language={requestLanguage}
          />
        )}

        {activeTab === 'response' && (
          <MonacoResponseViewer
            value={log.responseBody || '(empty)'}
            language={responseLanguage}
          />
        )}

        {activeTab === 'headers' && (
          <div style={{ padding: '16px', overflow: 'auto', height: '100%' }}>
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ fontSize: tokens.fontSize.base, color: tokens.syntax.request, marginBottom: '8px', fontWeight: 600 }}>
                Request Headers
              </h4>
              {log.requestHeaders && Object.keys(log.requestHeaders).length > 0 ? (
                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                  <tbody>
                    {Object.entries(log.requestHeaders).map(([key, value]) => (
                      <tr key={key} style={{ borderBottom: `1px solid ${tokens.border.default}` }}>
                        <td style={{ padding: '6px 8px', color: tokens.syntax.param, fontWeight: 500, width: '200px' }}>{key}</td>
                        <td style={{ padding: '6px 8px', color: tokens.text.primary, wordBreak: 'break-all' }}>{String(value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ color: tokens.text.muted, fontSize: tokens.fontSize.sm, fontStyle: 'italic' }}>No request headers</div>
              )}
            </div>

            <div>
              <h4 style={{ fontSize: tokens.fontSize.base, color: tokens.syntax.request, marginBottom: '8px', fontWeight: 600 }}>
                Response Headers
              </h4>
              {log.responseHeaders && Object.keys(log.responseHeaders).length > 0 ? (
                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                  <tbody>
                    {Object.entries(log.responseHeaders).map(([key, value]) => (
                      <tr key={key} style={{ borderBottom: `1px solid ${tokens.border.default}` }}>
                        <td style={{ padding: '6px 8px', color: tokens.syntax.param, fontWeight: 500, width: '200px' }}>{key}</td>
                        <td style={{ padding: '6px 8px', color: tokens.text.primary, wordBreak: 'break-all' }}>{String(value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ color: tokens.text.muted, fontSize: tokens.fontSize.sm, fontStyle: 'italic' }}>No response headers</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'raw' && (
          <MonacoResponseViewer
            value={JSON.stringify(log, null, 2)}
            language="json"
          />
        )}
      </div>
    </div>
  );
}
