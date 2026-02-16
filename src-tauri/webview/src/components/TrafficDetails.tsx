import React, { useState } from 'react';
import { MonacoResponseViewer } from '@apinox/request-editor';
import { TrafficLog } from '../types';

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
      background: '#252526',
      borderTop: '1px solid #3e3e42',
      height: '400px'
    }}>
      {/* Tab Bar */}
      <div style={{
        display: 'flex',
        gap: '4px',
        padding: '8px 12px',
        background: '#2d2d30',
        borderBottom: '1px solid #3e3e42'
      }}>
        {(['request', 'response', 'headers', 'raw'] as DetailTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '6px 12px',
              background: activeTab === tab ? '#007acc' : 'transparent',
              border: 'none',
              borderRadius: '3px',
              color: activeTab === tab ? '#ffffff' : '#cccccc',
              fontSize: '12px',
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
            theme={{
              name: 'apiprox-dark',
              isLight: false,
              background: '#1e1e1e',
              foreground: '#d4d4d4',
              lineNumberColor: '#858585',
              selectionBackground: '#264f78',
              cursorColor: '#aeafad',
              inputBackground: '#3c3c3c',
              inputBorder: '#3c3c3c',
              buttonBackground: '#0e639c',
              buttonForeground: '#ffffff',
              buttonHoverBackground: '#1177bb',
              disabledForeground: '#656565',
              errorForeground: '#f48771'
            }}
          />
        )}

        {activeTab === 'response' && (
          <MonacoResponseViewer
            value={log.responseBody || '(empty)'}
            language={responseLanguage}
            theme={{
              name: 'apiprox-dark',
              isLight: false,
              background: '#1e1e1e',
              foreground: '#d4d4d4',
              lineNumberColor: '#858585',
              selectionBackground: '#264f78',
              cursorColor: '#aeafad',
              inputBackground: '#3c3c3c',
              inputBorder: '#3c3c3c',
              buttonBackground: '#0e639c',
              buttonForeground: '#ffffff',
              buttonHoverBackground: '#1177bb',
              disabledForeground: '#656565',
              errorForeground: '#f48771'
            }}
          />
        )}

        {activeTab === 'headers' && (
          <div style={{ padding: '16px', overflow: 'auto', height: '100%' }}>
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ fontSize: '13px', color: '#4ec9b0', marginBottom: '8px', fontWeight: 600 }}>
                Request Headers
              </h4>
              {log.requestHeaders && Object.keys(log.requestHeaders).length > 0 ? (
                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                  <tbody>
                    {Object.entries(log.requestHeaders).map(([key, value]) => (
                      <tr key={key} style={{ borderBottom: '1px solid #3e3e42' }}>
                        <td style={{ padding: '6px 8px', color: '#9cdcfe', fontWeight: 500, width: '200px' }}>{key}</td>
                        <td style={{ padding: '6px 8px', color: '#d4d4d4', wordBreak: 'break-all' }}>{String(value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ color: '#858585', fontSize: '12px', fontStyle: 'italic' }}>No request headers</div>
              )}
            </div>

            <div>
              <h4 style={{ fontSize: '13px', color: '#4ec9b0', marginBottom: '8px', fontWeight: 600 }}>
                Response Headers
              </h4>
              {log.responseHeaders && Object.keys(log.responseHeaders).length > 0 ? (
                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                  <tbody>
                    {Object.entries(log.responseHeaders).map(([key, value]) => (
                      <tr key={key} style={{ borderBottom: '1px solid #3e3e42' }}>
                        <td style={{ padding: '6px 8px', color: '#9cdcfe', fontWeight: 500, width: '200px' }}>{key}</td>
                        <td style={{ padding: '6px 8px', color: '#d4d4d4', wordBreak: 'break-all' }}>{String(value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ color: '#858585', fontSize: '12px', fontStyle: 'italic' }}>No response headers</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'raw' && (
          <MonacoResponseViewer
            value={JSON.stringify(log, null, 2)}
            language="json"
            theme={{
              name: 'apiprox-dark',
              isLight: false,
              background: '#1e1e1e',
              foreground: '#d4d4d4',
              lineNumberColor: '#858585',
              selectionBackground: '#264f78',
              cursorColor: '#aeafad',
              inputBackground: '#3c3c3c',
              inputBorder: '#3c3c3c',
              buttonBackground: '#0e639c',
              buttonForeground: '#ffffff',
              buttonHoverBackground: '#1177bb',
              disabledForeground: '#656565',
              errorForeground: '#f48771'
            }}
          />
        )}
      </div>
    </div>
  );
}
