import React, { useState } from 'react';
import { ReplaceRule } from '../types';

export function RulesPage() {
  const [rules, setRules] = useState<ReplaceRule[]>([]);
  const [showAddRule, setShowAddRule] = useState(false);

  function handleAddRule() {
    const newRule: ReplaceRule = {
      id: `rule-${Date.now()}`,
      name: 'New Rule',
      enabled: true,
      matchText: '',
      replaceWith: '',
      target: 'both',
      isRegex: false
    };
    setRules([...rules, newRule]);
    setShowAddRule(false);
  }

  function handleDeleteRule(id: string) {
    setRules(rules.filter(r => r.id !== id));
  }

  function handleToggleRule(id: string) {
    setRules(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 500 }}>
          Replace Rules
        </h2>
        <button
          onClick={() => setShowAddRule(true)}
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
          <p style={{ margin: 0 }}>No replace rules configured</p>
          <p style={{ margin: '8px 0 0', fontSize: '12px' }}>
            Create rules to modify traffic on the fly using XPath or regex patterns
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
                border: `1px solid ${rule.enabled ? '#3e3e42' : '#555'}`
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
                      Target: {rule.target}
                      {rule.isRegex && ' • Regex'}
                      {rule.xpath && ` • XPath: ${rule.xpath}`}
                    </div>
                  </div>
                </div>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
                <div>
                  <div style={{ color: '#858585', marginBottom: '4px' }}>Match:</div>
                  <code style={{ background: '#1e1e1e', padding: '6px', borderRadius: '3px', display: 'block' }}>
                    {rule.matchText || '(empty)'}
                  </code>
                </div>
                <div>
                  <div style={{ color: '#858585', marginBottom: '4px' }}>Replace with:</div>
                  <code style={{ background: '#1e1e1e', padding: '6px', borderRadius: '3px', display: 'block' }}>
                    {rule.replaceWith || '(empty)'}
                  </code>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddRule && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#252526',
            padding: '24px',
            borderRadius: '8px',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h3 style={{ margin: '0 0 16px 0' }}>Add Replace Rule</h3>
            <p style={{ color: '#858585', fontSize: '13px', margin: '0 0 20px 0' }}>
              Rules will be editable after creation
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAddRule(false)}
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
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
