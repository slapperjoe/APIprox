import React, { useState, useEffect } from 'react';
import { bridge } from '../utils/bridge';

interface MockCondition {
  type: 'url' | 'xpath' | 'soapAction' | 'header' | 'method';
  pattern: string;
  isRegex?: boolean;
  headerName?: string;
}

interface MockRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: MockCondition[];
  statusCode: number;
  responseBody: string;
  responseHeaders?: Record<string, string>;
  delayMs?: number;
}

export function MockRulesPage() {
  const [rules, setRules] = useState<MockRule[]>([]);
  const [editingRule, setEditingRule] = useState<MockRule | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRules();
  }, []);

  async function loadRules() {
    try {
      const response = await bridge.getMockRules();
      setRules(response.rules || []);
    } catch (error) {
      console.error('Failed to load mock rules:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddRule() {
    const newRule: MockRule = {
      id: `mock-${Date.now()}`,
      name: 'New Mock Rule',
      enabled: true,
      conditions: [{ type: 'url', pattern: '/api/*', isRegex: false }],
      statusCode: 200,
      responseBody: '<?xml version="1.0"?>\n<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\n  <soap:Body>\n    <Response>\n      <!-- Mock response -->\n    </Response>\n  </soap:Body>\n</soap:Envelope>',
      delayMs: 0
    };
    setEditingRule(newRule);
  }

  async function handleSaveRule() {
    if (!editingRule) return;

    try {
      const isNew = !rules.find(r => r.id === editingRule.id);
      
      if (isNew) {
        await bridge.addMockRule(editingRule);
      } else {
        await bridge.updateMockRule(editingRule.id, editingRule);
      }
      
      await loadRules();
      setEditingRule(null);
    } catch (error) {
      console.error('Failed to save rule:', error);
      alert('Failed to save rule: ' + (error as Error).message);
    }
  }

  async function handleDeleteRule(id: string) {
    if (!confirm('Delete this mock rule?')) return;

    try {
      await bridge.deleteMockRule(id);
      await loadRules();
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  }

  async function handleToggleRule(id: string) {
    const rule = rules.find(r => r.id === id);
    if (!rule) return;

    try {
      await bridge.updateMockRule(id, { ...rule, enabled: !rule.enabled });
      await loadRules();
    } catch (error) {
      console.error('Failed to toggle rule:', error);
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

  function updateCondition(index: number, updates: Partial<MockCondition>) {
    if (!editingRule) return;
    const newConditions = [...editingRule.conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    setEditingRule({ ...editingRule, conditions: newConditions });
  }

  if (isLoading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ color: '#858585' }}>Loading mock rules...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', height: '100%', overflow: 'auto' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 500 }}>
          Mock Response Rules
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
          + Add Mock Rule
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
          <p style={{ margin: 0, fontSize: '14px' }}>No mock rules configured</p>
          <p style={{ margin: '8px 0 0', fontSize: '12px' }}>
            Create rules to return predefined responses for matching requests
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
                      Status: {rule.statusCode}
                      {rule.delayMs ? ` • Delay: ${rule.delayMs}ms` : ''}
                      {' • '}
                      {rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''}
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
                <div style={{ marginBottom: '8px' }}>
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
                <div>
                  <div style={{ color: '#858585', marginBottom: '4px' }}>Response Preview:</div>
                  <pre style={{
                    background: '#1e1e1e',
                    padding: '8px',
                    borderRadius: '3px',
                    margin: 0,
                    maxHeight: '100px',
                    overflow: 'auto',
                    fontSize: '11px',
                    lineHeight: '1.4'
                  }}>
                    {rule.responseBody.substring(0, 200)}{rule.responseBody.length > 200 ? '...' : ''}
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
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
              {rules.find(r => r.id === editingRule.id) ? 'Edit' : 'Add'} Mock Rule
            </h3>

            {/* Name */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: '#cccccc' }}>
                Rule Name
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
                    <option value="xpath">XPath</option>
                    <option value="soapAction">SOAP Action</option>
                    <option value="header">Header</option>
                    <option value="method">Method</option>
                  </select>

                  <input
                    type="text"
                    value={condition.pattern}
                    onChange={(e) => updateCondition(idx, { pattern: e.target.value })}
                    placeholder={condition.type === 'xpath' ? '//Body/GetUser' : '/api/*'}
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

            {/* Response Config */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: '#cccccc' }}>
                  Status Code
                </label>
                <input
                  type="number"
                  value={editingRule.statusCode}
                  onChange={(e) => setEditingRule({ ...editingRule, statusCode: parseInt(e.target.value) })}
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

              <div>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: '#cccccc' }}>
                  Delay (ms)
                </label>
                <input
                  type="number"
                  value={editingRule.delayMs || 0}
                  onChange={(e) => setEditingRule({ ...editingRule, delayMs: parseInt(e.target.value) })}
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
            </div>

            {/* Response Body */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: '#cccccc' }}>
                Response Body
              </label>
              <textarea
                value={editingRule.responseBody}
                onChange={(e) => setEditingRule({ ...editingRule, responseBody: e.target.value })}
                rows={12}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: '#1e1e1e',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: '#cccccc',
                  fontSize: '12px',
                  fontFamily: 'Consolas, monospace',
                  resize: 'vertical'
                }}
              />
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
                Save Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
