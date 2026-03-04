import React, { useState, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { bridge } from '../utils/bridge';
import { MonacoRequestEditorWithToolbar, HeadersPanel } from '@apinox/request-editor';
import type { MonacoRequestEditorHandle } from '@apinox/request-editor';

interface BreakpointCondition {
  type: 'url' | 'method' | 'statusCode' | 'header' | 'contains';
  pattern: string;
  isRegex?: boolean;
  headerName?: string;
}

interface BreakpointRule {
  id: string;
  name: string;
  enabled: boolean;
  target: 'request' | 'response' | 'both';
  conditions: BreakpointCondition[];
}

interface PausedTraffic {
  id: string;
  timestamp: number;
  pauseType: 'request' | 'response';
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody: string;
  statusCode?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  matchedRule: string;
}

export function BreakpointsPage() {
  const [rules, setRules] = useState<BreakpointRule[]>([]);
  const [queue, setQueue] = useState<PausedTraffic[]>([]);
  const [editingRule, setEditingRule] = useState<BreakpointRule | null>(null);
  const [editingTraffic, setEditingTraffic] = useState<PausedTraffic | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editedBody, setEditedBody] = useState<string>('');
  const [editedHeaders, setEditedHeaders] = useState<Record<string, string>>({});

  useEffect(() => {
    loadRules();
    loadQueue();

    // Refresh queue when Rust emits breakpoint-paused event
    const unlisten = listen<PausedTraffic[]>('breakpoint-paused', (event) => {
      setQueue(event.payload);
    });

    return () => { unlisten.then(fn => fn()); };
  }, []);

  async function loadRules() {
    try {
      const response = await bridge.getBreakpointRules();
      setRules(Array.isArray(response) ? response : (response.rules || []));
    } catch (error) {
      console.error('Failed to load breakpoint rules:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadQueue() {
    try {
      const response = await bridge.getBreakpointQueue();
      setQueue(Array.isArray(response) ? response : (response.queue || []));
    } catch (error) {
      console.error('Failed to load breakpoint queue:', error);
    }
  }

  async function handleAddRule() {
    const newRule: BreakpointRule = {
      id: `bp-${Date.now()}`,
      name: 'New Breakpoint',
      enabled: true,
      target: 'request',
      conditions: [{ type: 'url', pattern: '/api/*', isRegex: false }]
    };
    setEditingRule(newRule);
  }

  async function handleSaveRule() {
    if (!editingRule) return;

    try {
      const isNew = !rules.find(r => r.id === editingRule.id);
      
      if (isNew) {
        await bridge.addBreakpointRule(editingRule);
      } else {
        await bridge.updateBreakpointRule(editingRule.id, editingRule);
      }
      
      await loadRules();
      setEditingRule(null);
    } catch (error) {
      console.error('Failed to save rule:', error);
      alert('Failed to save rule: ' + (error as Error).message);
    }
  }

  async function handleDeleteRule(id: string) {
    if (!confirm('Delete this breakpoint?')) return;

    try {
      await bridge.deleteBreakpointRule(id);
      await loadRules();
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  }

  async function handleToggleRule(id: string) {
    const rule = rules.find(r => r.id === id);
    if (!rule) return;

    try {
      await bridge.updateBreakpointRule(id, { ...rule, enabled: !rule.enabled });
      await loadRules();
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  }

  async function handleContinue(id: string, modifications?: any) {
    try {
      await bridge.continueBreakpoint(id, modifications);
      await loadQueue();
      setEditingTraffic(null);
    } catch (error) {
      console.error('Failed to continue traffic:', error);
    }
  }

  async function handleDrop(id: string) {
    if (!confirm('Drop this request/response?')) return;

    try {
      await bridge.dropBreakpoint(id);
      await loadQueue();
      setEditingTraffic(null);
    } catch (error) {
      console.error('Failed to drop traffic:', error);
    }
  }

  function addCondition() {
    if (!editingRule) return;
    setEditingRule({
      ...editingRule,
      conditions: [...editingRule.conditions, { type: 'url', pattern: '', isRegex: false }]
    });
  }

  function removeCondition(index: number) {
    if (!editingRule) return;
    setEditingRule({
      ...editingRule,
      conditions: editingRule.conditions.filter((_, i) => i !== index)
    });
  }

  function updateCondition(index: number, updates: Partial<BreakpointCondition>) {
    if (!editingRule) return;
    const newConditions = [...editingRule.conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    setEditingRule({ ...editingRule, conditions: newConditions });
  }

  function detectLanguage(headers: Record<string, string> = {}): string {
    const ct = headers['content-type'] || headers['Content-Type'] || '';
    if (ct.includes('xml') || ct.includes('soap')) return 'xml';
    if (ct.includes('json')) return 'json';
    return 'text';
  }

  if (isLoading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ color: '#858585' }}>Loading breakpoints...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column', gap: '20px', overflow: 'auto' }}>
      {/* Paused Traffic Queue */}
      <div style={{ background: '#252526', borderRadius: '6px', padding: '20px' }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 500 }}>
          Paused Traffic ({queue.length})
        </h2>

        {queue.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#858585', fontSize: '13px' }}>
            No traffic paused. Enable breakpoint rules to start intercepting.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {queue.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '16px',
                  background: '#1e1e1e',
                  borderRadius: '4px',
                  border: '1px solid #3e3e42'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>
                      <span style={{ color: item.pauseType === 'request' ? '#4ec9b0' : '#dcdcaa' }}>
                        {item.pauseType.toUpperCase()}
                      </span>
                      {' '}
                      <span style={{ color: '#d4d4d4' }}>{item.method} {item.url}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#858585', marginTop: '4px' }}>
                      Rule: {item.matchedRule} • {new Date(item.timestamp).toLocaleTimeString()}
                      {item.statusCode && ` • Status: ${item.statusCode}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => {
                        setEditingTraffic(item);
                        const body = item.pauseType === 'request' ? item.requestBody : (item.responseBody ?? '');
                        const headers = item.pauseType === 'request' ? (item.requestHeaders ?? {}) : (item.responseHeaders ?? {});
                        setEditedBody(body);
                        setEditedHeaders({ ...headers });
                      }}
                      style={{
                        padding: '4px 12px',
                        background: '#0e639c',
                        border: 'none',
                        borderRadius: '4px',
                        color: 'white',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Edit & Continue
                    </button>
                    <button
                      onClick={() => handleContinue(item.id)}
                      style={{
                        padding: '4px 12px',
                        background: '#106b21',
                        border: 'none',
                        borderRadius: '4px',
                        color: 'white',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Continue
                    </button>
                    <button
                      onClick={() => handleDrop(item.id)}
                      style={{
                        padding: '4px 12px',
                        background: '#6b1010',
                        border: 'none',
                        borderRadius: '4px',
                        color: 'white',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Drop
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Breakpoint Rules */}
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 500 }}>
            Breakpoint Rules
          </h2>
          <button
            onClick={handleAddRule}
            style={{
              padding: '8px 16px',
              background: '#0e639c',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            + Add Breakpoint
          </button>
        </div>

        {rules.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            background: '#252526',
            borderRadius: '6px',
            color: '#858585'
          }}>
            <p style={{ margin: 0, fontSize: '14px' }}>No breakpoints configured</p>
            <p style={{ margin: '8px 0 0', fontSize: '12px' }}>
              Create breakpoints to pause traffic and inspect/edit requests and responses
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {rules.map((rule) => (
              <div
                key={rule.id}
                style={{
                  padding: '16px',
                  background: '#252526',
                  borderRadius: '6px',
                  border: `1px solid ${rule.enabled ? '#0e639c' : '#555'}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => handleToggleRule(rule.id)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <div>
                      <div style={{ fontWeight: 500, fontSize: '14px' }}>{rule.name}</div>
                      <div style={{ fontSize: '12px', color: '#858585', marginTop: '4px' }}>
                        Target: {rule.target} • {rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setEditingRule(rule)}
                      style={{
                        padding: '4px 12px',
                        background: 'transparent',
                        border: '1px solid #0e639c',
                        borderRadius: '4px',
                        color: '#0e639c',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      style={{
                        padding: '4px 12px',
                        background: 'transparent',
                        border: '1px solid #555',
                        borderRadius: '4px',
                        color: '#cccccc',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: '12px' }}>
                  <div style={{ color: '#858585', marginBottom: '4px' }}>Conditions:</div>
                  {rule.conditions.map((cond, idx) => (
                    <div key={idx} style={{ marginLeft: '12px', marginBottom: '4px' }}>
                      • {cond.type}: <code style={{ background: '#1e1e1e', padding: '2px 6px', borderRadius: '3px' }}>
                        {cond.pattern}
                      </code>
                      {cond.isRegex && <span style={{ color: '#858585', marginLeft: '6px' }}>(regex)</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Rule Modal */}
      {editingRule && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#252526',
            padding: '24px',
            borderRadius: '8px',
            maxWidth: '700px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '16px' }}>
              {rules.find(r => r.id === editingRule.id) ? 'Edit' : 'Add'} Breakpoint
            </h3>

            {/* Name */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: '#cccccc' }}>
                Name
              </label>
              <input
                type="text"
                value={editingRule.name}
                onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
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
            </div>

            {/* Target */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: '#cccccc' }}>
                Pause on
              </label>
              <select
                value={editingRule.target}
                onChange={(e) => setEditingRule({ ...editingRule, target: e.target.value as any })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: '#3c3c3c',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: '#cccccc',
                  fontSize: '13px'
                }}
              >
                <option value="request">Request (before forwarding)</option>
                <option value="response">Response (after receiving)</option>
                <option value="both">Both Request and Response</option>
              </select>
            </div>

            {/* Conditions */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', color: '#cccccc' }}>Match Conditions (ALL must match)</label>
                <button
                  onClick={addCondition}
                  style={{
                    padding: '4px 10px',
                    background: '#0e639c',
                    border: 'none',
                    borderRadius: '3px',
                    color: 'white',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  + Add Condition
                </button>
              </div>

              {editingRule.conditions.map((condition, idx) => (
                <div key={idx} style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr 80px 40px',
                  gap: '8px',
                  marginBottom: '8px',
                  alignItems: 'center'
                }}>
                  <select
                    value={condition.type}
                    onChange={(e) => updateCondition(idx, { type: e.target.value as any })}
                    style={{
                      padding: '6px',
                      background: '#3c3c3c',
                      border: '1px solid #555',
                      borderRadius: '4px',
                      color: '#cccccc',
                      fontSize: '12px'
                    }}
                  >
                    <option value="url">URL</option>
                    <option value="method">Method</option>
                    <option value="statusCode">Status Code</option>
                    <option value="header">Header</option>
                    <option value="contains">Body Contains</option>
                  </select>

                  <input
                    type="text"
                    value={condition.pattern}
                    onChange={(e) => updateCondition(idx, { pattern: e.target.value })}
                    placeholder={condition.type === 'url' ? '/api/*' : 'pattern'}
                    style={{
                      padding: '6px 10px',
                      background: '#3c3c3c',
                      border: '1px solid #555',
                      borderRadius: '4px',
                      color: '#cccccc',
                      fontSize: '12px'
                    }}
                  />

                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={condition.isRegex || false}
                      onChange={(e) => updateCondition(idx, { isRegex: e.target.checked })}
                      style={{ width: '14px', height: '14px' }}
                    />
                    Regex
                  </label>

                  <button
                    onClick={() => removeCondition(idx)}
                    style={{
                      padding: '6px',
                      background: '#5a2e2e',
                      border: 'none',
                      borderRadius: '4px',
                      color: '#ff6b6b',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditingRule(null)}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: '#cccccc',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRule}
                style={{
                  padding: '8px 16px',
                  background: '#0e639c',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Traffic Modal */}
      {editingTraffic && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#252526',
            padding: '24px',
            borderRadius: '8px',
            maxWidth: '900px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>
              Edit {editingTraffic.pauseType === 'request' ? 'Request' : 'Response'}
            </h3>

            <div style={{ fontSize: '13px', color: '#858585', marginBottom: '20px' }}>
              {editingTraffic.method} {editingTraffic.url}
            </div>

            {/* Headers */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: '#cccccc', fontWeight: 600 }}>
                {editingTraffic.pauseType === 'request' ? 'Request Headers' : 'Response Headers'}
              </label>
              <div style={{ height: '160px', border: '1px solid #555', borderRadius: '4px', overflow: 'hidden' }}>
                <HeadersPanel
                  headers={editedHeaders}
                  onChange={setEditedHeaders}
                />
              </div>
            </div>

            {/* Body Editor */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: '#cccccc', fontWeight: 600 }}>
                {editingTraffic.pauseType === 'request' ? 'Request Body' : 'Response Body'}
              </label>
              <div style={{ height: '320px', border: '1px solid #555', borderRadius: '4px', overflow: 'hidden' }}>
                <MonacoRequestEditorWithToolbar
                  value={editedBody}
                  onChange={setEditedBody}
                  language={detectLanguage(editedHeaders)}
                />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => handleDrop(editingTraffic.id)}
                style={{
                  padding: '8px 16px',
                  background: '#6b1010',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Drop
              </button>
              <button
                onClick={() => setEditingTraffic(null)}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: '#cccccc',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleContinue(editingTraffic.id, {
                    body: editedBody,
                    headers: editedHeaders,
                  });
                }}
                style={{
                  padding: '8px 16px',
                  background: '#106b21',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Continue with Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
