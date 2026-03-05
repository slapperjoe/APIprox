import React, { useState, useEffect } from 'react';
import { MonacoRequestEditor } from '@apinox/request-editor';
import { bridge } from '../utils/bridge';

interface MockCondition {
  type: 'url' | 'xpath' | 'soapAction' | 'header' | 'method' | 'queryParam' | 'contains';
  pattern: string;
  isRegex?: boolean;
  /** Header name (for "header") or query param name (for "queryParam") */
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
  contentType?: string;
  delayMs?: number;
}

const CONTENT_TYPES = [
  { label: 'XML (text/xml)', value: 'text/xml; charset=utf-8' },
  { label: 'JSON (application/json)', value: 'application/json; charset=utf-8' },
  { label: 'Plain text (text/plain)', value: 'text/plain; charset=utf-8' },
  { label: 'HTML (text/html)', value: 'text/html; charset=utf-8' },
  { label: 'Custom…', value: '' },
];

function contentTypeToLanguage(ct: string): string {
  if (!ct) return 'plaintext';
  if (ct.includes('json')) return 'json';
  if (ct.includes('xml')) return 'xml';
  if (ct.includes('html')) return 'html';
  return 'plaintext';
}

/** Inline key-value header editor */
function HeadersEditor({
  headers,
  onChange,
}: {
  headers: Record<string, string>;
  onChange: (h: Record<string, string>) => void;
}) {
  // Use an internal array of {key,value} pairs to avoid duplicate-key collisions
  const [pairs, setPairs] = React.useState<{ key: string; value: string }[]>(
    () => Object.entries(headers).map(([key, value]) => ({ key, value }))
  );

  // Sync outward whenever pairs change
  function update(next: { key: string; value: string }[]) {
    setPairs(next);
    const record: Record<string, string> = {};
    next.forEach(({ key, value }) => { if (key !== '') record[key] = value; });
    onChange(record);
  }

  function setKey(i: number, newKey: string) {
    update(pairs.map((p, idx) => idx === i ? { ...p, key: newKey } : p));
  }

  function setValue(i: number, newVal: string) {
    update(pairs.map((p, idx) => idx === i ? { ...p, value: newVal } : p));
  }

  function remove(i: number) {
    update(pairs.filter((_, idx) => idx !== i));
  }

  function add() {
    update([...pairs, { key: '', value: '' }]);
  }

  const inputStyle: React.CSSProperties = {
    padding: '5px 8px',
    background: '#3c3c3c',
    border: '1px solid #555',
    borderRadius: '4px',
    color: '#cccccc',
    fontSize: '12px',
    width: '100%',
  };

  return (
    <div>
      {pairs.map(({ key, value }, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 32px', gap: '6px', marginBottom: '6px' }}>
          <input
            style={inputStyle}
            placeholder="Header name"
            value={key}
            onChange={(e) => setKey(i, e.target.value)}
          />
          <input
            style={inputStyle}
            placeholder="Value"
            value={value}
            onChange={(e) => setValue(i, e.target.value)}
          />
          <button
            onClick={() => remove(i)}
            style={{ padding: '4px', background: '#5a2e2e', border: 'none', borderRadius: '4px', color: '#ff6b6b', fontSize: '12px', cursor: 'pointer' }}
          >✕</button>
        </div>
      ))}
      <button
        onClick={add}
        style={{ padding: '4px 10px', background: '#0e639c', border: 'none', borderRadius: '3px', color: 'white', fontSize: '11px', cursor: 'pointer' }}
      >
        + Add Header
      </button>
    </div>
  );
}

export function MockRulesPage() {
  const [rules, setRules] = useState<MockRule[]>([]);
  const [editingRule, setEditingRule] = useState<MockRule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [customContentType, setCustomContentType] = useState('');

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
      contentType: 'text/xml; charset=utf-8',
      responseBody: '<?xml version="1.0"?>\n<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\n  <soap:Body>\n    <Response>\n      <!-- Mock response -->\n    </Response>\n  </soap:Body>\n</soap:Envelope>',
      responseHeaders: {},
      delayMs: 0,
    };
    setCustomContentType('');
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

  function openEdit(rule: MockRule) {
    const isPreset = CONTENT_TYPES.some(o => o.value !== '' && o.value === rule.contentType);
    setCustomContentType(isPreset ? '' : (rule.contentType || ''));
    setEditingRule(rule);
  }

  function handleContentTypeSelect(value: string) {
    if (!editingRule) return;
    if (value === '') {
      // "Custom" option – keep whatever is in customContentType
      setEditingRule({ ...editingRule, contentType: customContentType });
    } else {
      setCustomContentType('');
      setEditingRule({ ...editingRule, contentType: value });
    }
  }

  /** Determine whether a content-type value is one of the preset options */
  function getContentTypeSelectValue(ct: string | undefined): string {
    if (!ct) return CONTENT_TYPES[0].value;
    const found = CONTENT_TYPES.find(o => o.value === ct);
    return found ? found.value : ''; // '' = "Custom"
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    background: '#3c3c3c',
    border: '1px solid #555',
    borderRadius: '4px',
    color: '#cccccc',
    fontSize: '13px',
    boxSizing: 'border-box',
  };

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
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 500 }}>Mock Server Rules</h2>
          <p style={{ margin: 0, fontSize: '12px', color: '#858585' }}>
            Use <code style={{ background: '#1e1e1e', padding: '1px 5px', borderRadius: '3px' }}>{'{{uuid}}'}</code>{' '}
            <code style={{ background: '#1e1e1e', padding: '1px 5px', borderRadius: '3px' }}>{'{{now}}'}</code>{' '}
            <code style={{ background: '#1e1e1e', padding: '1px 5px', borderRadius: '3px' }}>{'{{randomInt 1 100}}'}</code>{' '}
            <code style={{ background: '#1e1e1e', padding: '1px 5px', borderRadius: '3px' }}>{'{{randomElement a b c}}'}</code>{' '}
            <code style={{ background: '#1e1e1e', padding: '1px 5px', borderRadius: '3px' }}>{"{{requestHeader 'name'}}"}</code>{' '}
            template helpers in response bodies.
          </p>
        </div>
        <button
          onClick={handleAddRule}
          style={{
            padding: '8px 16px',
            background: '#0e639c',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            fontSize: '13px',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          + Add Rule
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
                      {rule.contentType ? ` • ${rule.contentType.split(';')[0]}` : ''}
                      {' • '}
                      {rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''}
                      {rule.responseHeaders && Object.keys(rule.responseHeaders).length > 0
                        ? ` • ${Object.keys(rule.responseHeaders).length} header${Object.keys(rule.responseHeaders).length !== 1 ? 's' : ''}`
                        : ''}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => openEdit(rule)}
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
                      • {cond.type}
                      {cond.headerName ? ` [${cond.headerName}]` : ''}: <code style={{ background: '#1e1e1e', padding: '2px 6px', borderRadius: '3px' }}>
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
            maxWidth: '760px',
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
                style={inputStyle}
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
                <div key={idx} style={{ marginBottom: '8px' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: condition.type === 'header' || condition.type === 'queryParam'
                      ? '130px 140px 1fr 80px 40px'
                      : '130px 1fr 80px 40px',
                    gap: '8px',
                    alignItems: 'center'
                  }}>
                    <select
                      value={condition.type}
                      onChange={(e) => {
                        const newType = e.target.value as MockCondition['type'];
                        const namePreservingTypes = new Set(['header', 'queryParam']);
                        // Preserve headerName when switching between types that both use it
                        const keepName = namePreservingTypes.has(newType) && namePreservingTypes.has(condition.type);
                        updateCondition(idx, { type: newType, headerName: keepName ? condition.headerName : undefined });
                      }}
                      style={{ padding: '6px', background: '#3c3c3c', border: '1px solid #555', borderRadius: '4px', color: '#cccccc', fontSize: '12px' }}
                    >
                      <option value="url">URL Path</option>
                      <option value="method">HTTP Method</option>
                      <option value="header">Header</option>
                      <option value="queryParam">Query Param</option>
                      <option value="xpath">XPath</option>
                      <option value="contains">Body Contains</option>
                      <option value="soapAction">SOAP Action</option>
                    </select>

                    {(condition.type === 'header' || condition.type === 'queryParam') && (
                      <input
                        type="text"
                        value={condition.headerName || ''}
                        onChange={(e) => updateCondition(idx, { headerName: e.target.value })}
                        placeholder={condition.type === 'header' ? 'Header name' : 'Param name'}
                        style={{ padding: '6px 10px', background: '#3c3c3c', border: '1px solid #555', borderRadius: '4px', color: '#cccccc', fontSize: '12px' }}
                      />
                    )}

                    <input
                      type="text"
                      value={condition.pattern}
                      onChange={(e) => updateCondition(idx, { pattern: e.target.value })}
                      placeholder={
                        condition.type === 'method' ? 'GET, POST, …'
                        : condition.type === 'xpath' ? '//Body/GetUser'
                        : condition.type === 'header' || condition.type === 'queryParam' ? 'Expected value'
                        : '/api/*'
                      }
                      style={{ padding: '6px 10px', background: '#3c3c3c', border: '1px solid #555', borderRadius: '4px', color: '#cccccc', fontSize: '12px' }}
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
                      style={{ padding: '6px', background: '#5a2e2e', border: 'none', borderRadius: '4px', color: '#ff6b6b', fontSize: '12px', cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Response Config row */}
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 120px', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: '#cccccc' }}>Status Code</label>
                <input
                  type="number"
                  value={editingRule.statusCode}
                  onChange={(e) => setEditingRule({ ...editingRule, statusCode: parseInt(e.target.value) })}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: '#cccccc' }}>Content-Type</label>
                <select
                  value={getContentTypeSelectValue(editingRule.contentType)}
                  onChange={(e) => handleContentTypeSelect(e.target.value)}
                  style={{ ...inputStyle, padding: '7px 12px' }}
                >
                  {CONTENT_TYPES.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {getContentTypeSelectValue(editingRule.contentType) === '' && (
                  <input
                    type="text"
                    value={editingRule.contentType || ''}
                    onChange={(e) => {
                      setCustomContentType(e.target.value);
                      setEditingRule({ ...editingRule, contentType: e.target.value });
                    }}
                    placeholder="e.g. application/soap+xml"
                    style={{ ...inputStyle, marginTop: '6px' }}
                  />
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: '#cccccc' }}>Delay (ms)</label>
                <input
                  type="number"
                  value={editingRule.delayMs || 0}
                  onChange={(e) => setEditingRule({ ...editingRule, delayMs: parseInt(e.target.value) })}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Response Headers */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '8px', color: '#cccccc' }}>
                Response Headers
              </label>
              <HeadersEditor
                headers={editingRule.responseHeaders || {}}
                onChange={(h) => setEditingRule({ ...editingRule, responseHeaders: h })}
              />
            </div>

            {/* Response Body */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: '#cccccc' }}>
                Response Body
              </label>
              <div style={{
                height: '280px',
                border: '1px solid #555',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <MonacoRequestEditor
                  value={editingRule.responseBody}
                  onChange={(value) => setEditingRule({ ...editingRule, responseBody: value })}
                  language={contentTypeToLanguage(editingRule.contentType || '')}
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
              </div>
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

