import React, { useState, useEffect, useMemo } from 'react';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
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
  tags?: string[];
  hitCount?: number;
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

function statusColor(code: number): string {
  if (code >= 200 && code < 300) return '#4caf50';
  if (code >= 300 && code < 400) return '#ff9800';
  if (code >= 400 && code < 500) return '#f44336';
  if (code >= 500) return '#e53935';
  return '#858585';
}

/** Tag input: shows pill chips and a text input; press Enter or comma to add. */
function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [inputValue, setInputValue] = useState('');

  function addTag(raw: string) {
    const trimmed = raw.trim();
    if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed]);
    setInputValue('');
  }

  function removeTag(idx: number) { onChange(tags.filter((_, i) => i !== idx)); }

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center',
      padding: '6px 8px', background: '#3c3c3c', border: '1px solid #555',
      borderRadius: '4px', minHeight: '36px',
    }}>
      {tags.map((tag, i) => (
        <span key={i} style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          background: '#1e4a7a', color: '#90caf9', padding: '2px 8px',
          borderRadius: '12px', fontSize: '11px',
        }}>
          {tag}
          <button
            onClick={() => removeTag(i)}
            style={{ background: 'none', border: 'none', color: '#90caf9', cursor: 'pointer', padding: '0', lineHeight: 1, fontSize: '14px' }}
          >×</button>
        </span>
      ))}
      <input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(inputValue); }
          if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) removeTag(tags.length - 1);
        }}
        placeholder={tags.length === 0 ? 'Type a tag and press Enter…' : ''}
        style={{
          background: 'none', border: 'none', outline: 'none',
          color: '#cccccc', fontSize: '12px', minWidth: '130px', flex: 1,
        }}
      />
    </div>
  );
}

/** Compact single-line row for a mock rule in the list view. */
function RuleRow({
  rule, isLast, onToggle, onEdit, onDelete,
}: {
  rule: MockRule; isLast: boolean;
  onToggle: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const condTooltip = rule.conditions
    .map((c) => `${c.type}${c.headerName ? ` [${c.headerName}]` : ''}: ${c.pattern}`)
    .join('\n');

  // Compact summary of first condition for inline display
  const firstCond = rule.conditions[0];
  const condSummary = firstCond
    ? `${firstCond.type}${firstCond.headerName ? `:${firstCond.headerName}` : ''}: ${firstCond.pattern}`
    : '';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '7px 12px',
      borderBottom: isLast ? 'none' : '1px solid #2a2a2a',
    }}>
      {/* Enabled toggle */}
      <button
        onClick={onToggle}
        title={rule.enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          fontSize: '14px', lineHeight: 1,
          color: rule.enabled ? '#4caf50' : '#555', flexShrink: 0,
        }}
      >{rule.enabled ? '●' : '○'}</button>

      {/* Name + condition summary (same line) */}
      <div
        title={condTooltip}
        style={{
          flex: 1, minWidth: 0,
          fontSize: '13px', color: rule.enabled ? '#cccccc' : '#666',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
      >
        {rule.name}
        {condSummary && (
          <span style={{ color: '#555', marginLeft: '10px' }}>
            {condSummary}{rule.conditions.length > 1 ? ` +${rule.conditions.length - 1}` : ''}
          </span>
        )}
      </div>

      {/* Status code */}
      <span style={{
        fontSize: '11px', fontWeight: 600, color: statusColor(rule.statusCode),
        background: '#1a1a1a', padding: '2px 8px', borderRadius: '10px',
        minWidth: '36px', textAlign: 'center', flexShrink: 0,
      }}>{rule.statusCode}</span>

      {/* Tag chips */}
      {(rule.tags ?? []).length > 0 && (
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          {(rule.tags ?? []).map((t, i) => (
            <span key={i} style={{
              fontSize: '10px', background: '#1e3a5a', color: '#90caf9',
              padding: '2px 8px', borderRadius: '10px',
            }}>{t}</span>
          ))}
        </div>
      )}

      {/* Hit count */}
      {(rule.hitCount ?? 0) > 0 && (
        <span style={{ fontSize: '11px', color: '#555', flexShrink: 0 }}>×{rule.hitCount}</span>
      )}

      {/* Actions */}
      <button
        onClick={onEdit}
        style={{
          padding: '3px 10px', background: 'transparent', border: '1px solid #0e639c',
          borderRadius: '3px', color: '#0e639c', fontSize: '11px', cursor: 'pointer', flexShrink: 0,
        }}
      >Edit</button>
      <button
        onClick={onDelete}
        style={{
          padding: '3px 10px', background: 'transparent', border: '1px solid #444',
          borderRadius: '3px', color: '#777', fontSize: '11px', cursor: 'pointer', flexShrink: 0,
        }}
      >Delete</button>
    </div>
  );
}

/** Export collection dialog. */
function ExportModal({ rules, onClose }: { rules: MockRule[]; onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(rules.map((r) => r.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const allSelected = selectedIds.size === rules.length;

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(rules.map((r) => r.id)));
  }

  function toggle(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  }

  async function doExport() {
    if (!name.trim()) { setError('Collection name is required.'); return; }
    if (selectedIds.size === 0) { setError('Select at least one rule to export.'); return; }
    setError('');
    setBusy(true);
    try {
      const filePath = await saveDialog({
        filters: [{ name: 'Mock Collection', extensions: ['mock.json'] }],
        defaultPath: `${name.trim().replace(/\s+/g, '-').toLowerCase()}.mock.json`,
      });
      if (!filePath) { setBusy(false); return; }
      await bridge.exportMockCollection([...selectedIds], name.trim(), description.trim(), filePath as string);
      onClose();
    } catch (e: any) {
      setError(`Export failed: ${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const iStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', background: '#3c3c3c', border: '1px solid #555',
    borderRadius: '4px', color: '#cccccc', fontSize: '13px', boxSizing: 'border-box',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px',
    }}>
      <div style={{
        background: '#252526', padding: '24px', borderRadius: '8px',
        width: '520px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', gap: '16px',
      }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 500 }}>Export Mock Collection</h3>

        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#999', marginBottom: '5px' }}>
            Collection name <span style={{ color: '#f44336' }}>*</span>
          </label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={iStyle}
            placeholder="e.g. Payments API Mocks" autoFocus />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', color: '#999', marginBottom: '5px' }}>
            Description
          </label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} style={iStyle}
            placeholder="Optional description for this collection" />
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: '#999' }}>
              Rules ({selectedIds.size} of {rules.length} selected)
            </span>
            <button onClick={toggleAll}
              style={{ background: 'none', border: 'none', color: '#0e639c', fontSize: '12px', cursor: 'pointer', padding: 0 }}>
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, border: '1px solid #3c3c3c', borderRadius: '4px' }}>
            {rules.map((rule) => (
              <label key={rule.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #2a2a2a',
              }}>
                <input type="checkbox" checked={selectedIds.has(rule.id)} onChange={() => toggle(rule.id)} />
                <span style={{ fontSize: '13px', flex: 1 }}>{rule.name}</span>
                <span style={{ fontSize: '11px', color: statusColor(rule.statusCode) }}>{rule.statusCode}</span>
                <span style={{ fontSize: '11px', color: '#666' }}>
                  {rule.conditions.length} cond{rule.conditions.length !== 1 ? 's' : ''}
                </span>
              </label>
            ))}
          </div>
        </div>

        {error && <div style={{ color: '#f44336', fontSize: '12px' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', background: 'transparent', border: '1px solid #555',
            borderRadius: '4px', color: '#cccccc', fontSize: '13px', cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={doExport} disabled={busy} style={{
            padding: '8px 16px', background: busy ? '#555' : '#0e639c',
            border: 'none', borderRadius: '4px', color: 'white',
            fontSize: '13px', cursor: busy ? 'default' : 'pointer',
          }}>{busy ? 'Exporting…' : 'Export'}</button>
        </div>
      </div>
    </div>
  );
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
  const [showExportModal, setShowExportModal] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadRules();
  }, []);

  async function loadRules() {
    try {
      const response = await bridge.getMockRules();
      const loaded: MockRule[] = Array.isArray(response) ? response : (response.rules ?? []);
      applyRules(loaded);
    } catch (error) {
      console.error('Failed to load mock rules:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function applyRules(loaded: MockRule[]) {
    setRules(loaded);
    // Ensure every group that appears in the data is open by default.
    setOpenGroups((prev) => {
      const next = new Set(prev);
      loaded.forEach((r) => {
        const key = r.tags && r.tags.length > 0 ? r.tags[0] : 'Uncategorized';
        next.add(key);
      });
      return next;
    });
  }

  async function reloadRules() {
    const response = await bridge.getMockRules();
    applyRules(Array.isArray(response) ? response : (response.rules ?? []));
  }

  // ── Derived state ──────────────────────────────────────────────────────────

  const allTags = useMemo(() => {
    const s = new Set<string>();
    rules.forEach((r) => (r.tags ?? []).forEach((t) => s.add(t)));
    return [...s].sort();
  }, [rules]);

  const filteredRules = useMemo(() => {
    const q = searchText.toLowerCase();
    return rules.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q) &&
        !r.conditions.some((c) => c.pattern.toLowerCase().includes(q))) return false;
      if (tagFilter && !(r.tags ?? []).includes(tagFilter)) return false;
      return true;
    });
  }, [rules, searchText, tagFilter]);

  const groupedRules = useMemo(() => {
    const groups = new Map<string, MockRule[]>();
    filteredRules.forEach((r) => {
      const key = r.tags && r.tags.length > 0 ? r.tags[0] : 'Uncategorized';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    });
    // Named groups sorted alphabetically, then Uncategorized last.
    const sorted = new Map<string, MockRule[]>();
    [...groups.keys()].filter((k) => k !== 'Uncategorized').sort()
      .forEach((k) => sorted.set(k, groups.get(k)!));
    if (groups.has('Uncategorized')) sorted.set('Uncategorized', groups.get('Uncategorized')!);
    return sorted;
  }, [filteredRules]);

  function toggleGroup(tag: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async function handleAddRule() {
    const newRule: MockRule = {
      id: '',
      name: 'New Mock Rule',
      enabled: true,
      conditions: [{ type: 'url', pattern: '/api/*', isRegex: false }],
      statusCode: 200,
      contentType: 'text/xml; charset=utf-8',
      responseBody: '<?xml version="1.0"?>\n<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\n  <soap:Body>\n    <Response>\n      <!-- Mock response -->\n    </Response>\n  </soap:Body>\n</soap:Envelope>',
      responseHeaders: {},
      delayMs: 0,
      tags: [],
    };
    setCustomContentType('');
    setEditingRule(newRule);
  }

  async function handleSaveRule() {
    if (!editingRule) return;

    try {
      const isNew = !editingRule.id || !rules.find(r => r.id === editingRule.id);

      if (isNew) {
        await bridge.addMockRule(editingRule);
      } else {
        await bridge.updateMockRule(editingRule.id, editingRule);
      }

      await reloadRules();
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
      await reloadRules();
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  }

  async function handleToggleRule(rule: MockRule) {
    try {
      await bridge.updateMockRule(rule.id, { ...rule, enabled: !rule.enabled });
      await reloadRules();
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  }

  async function handleImport() {
    try {
      const selected = await openDialog({
        multiple: false,
        filters: [{ name: 'Mock Collection', extensions: ['mock.json', 'json'] }],
      });
      if (!selected) return;
      const filePath = typeof selected === 'string' ? selected : (selected as any).path ?? String(selected);
      if (!confirm('Importing a collection will replace ALL current mock rules. Continue?')) return;
      await bridge.importMockCollection(filePath);
      await reloadRules();
    } catch (e: any) {
      alert('Import failed: ' + (e?.message ?? String(e)));
    }
  }

  // ── Edit modal helpers ─────────────────────────────────────────────────────

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
    setEditingRule({ ...rule, tags: rule.tags ?? [] });
  }

  function handleContentTypeSelect(value: string) {
    if (!editingRule) return;
    if (value === '') {
      setEditingRule({ ...editingRule, contentType: customContentType });
    } else {
      setCustomContentType('');
      setEditingRule({ ...editingRule, contentType: value });
    }
  }

  function getContentTypeSelectValue(ct: string | undefined): string {
    if (!ct) return CONTENT_TYPES[0].value;
    const found = CONTENT_TYPES.find(o => o.value === ct);
    return found ? found.value : '';
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Toolbar ── */}
      <div style={{
        padding: '10px 16px', borderBottom: '1px solid #2d2d2d',
        display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0,
        background: '#1e1e1e',
      }}>
        <input
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search rules…"
          style={{
            padding: '5px 10px', background: '#3c3c3c', border: '1px solid #555',
            borderRadius: '4px', color: '#cccccc', fontSize: '12px', width: '200px',
          }}
        />
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          style={{
            padding: '5px 8px', background: '#3c3c3c', border: '1px solid #555',
            borderRadius: '4px', color: tagFilter ? '#cccccc' : '#858585', fontSize: '12px',
          }}
        >
          <option value="">All tags</option>
          {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <span style={{ flex: 1 }} />

        <span style={{ fontSize: '11px', color: '#555' }}>
          {filteredRules.length} / {rules.length}
        </span>

        <button
          onClick={handleImport}
          style={{
            padding: '5px 12px', background: 'transparent', border: '1px solid #555',
            borderRadius: '4px', color: '#cccccc', fontSize: '12px', cursor: 'pointer',
          }}
        >Import</button>

        <button
          onClick={() => setShowExportModal(true)}
          disabled={rules.length === 0}
          style={{
            padding: '5px 12px', background: 'transparent', border: '1px solid #555',
            borderRadius: '4px', color: rules.length === 0 ? '#444' : '#cccccc',
            fontSize: '12px', cursor: rules.length === 0 ? 'default' : 'pointer',
          }}
        >Export</button>

        <button
          onClick={handleAddRule}
          style={{
            padding: '5px 14px', background: '#0e639c', border: 'none',
            borderRadius: '4px', color: 'white', fontSize: '12px', cursor: 'pointer',
          }}
        >+ Add Rule</button>
      </div>

      {/* ── Template helpers hint ── */}
      <div style={{ padding: '5px 16px', background: '#181818', borderBottom: '1px solid #2d2d2d', flexShrink: 0 }}>
        <p style={{ margin: 0, fontSize: '11px', color: '#555' }}>
          Body helpers:{' '}
          {['{{uuid}}', '{{now}}', '{{randomInt 1 100}}', '{{randomElement a b c}}', "{{requestHeader 'name'}}"].map((h) => (
            <code key={h} style={{ background: '#1e1e1e', padding: '1px 5px', borderRadius: '3px', marginRight: '6px', fontSize: '10px' }}>{h}</code>
          ))}
        </p>
      </div>

      {/* ── Rule groups ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {filteredRules.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#555', fontSize: '13px' }}>
            {rules.length === 0
              ? 'No mock rules configured. Click "+ Add Rule" to create one.'
              : 'No rules match the current filter.'}
          </div>
        ) : (
          [...groupedRules.entries()].map(([tag, groupRules]) => (
            <div key={tag} style={{ marginBottom: '14px' }}>
              {/* Group header */}
              <button
                onClick={() => toggleGroup(tag)}
                style={{
                  width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '4px 0', marginBottom: '4px', textAlign: 'left',
                }}
              >
                <span style={{ color: '#555', fontSize: '10px' }}>
                  {openGroups.has(tag) ? '▼' : '▶'}
                </span>
                <span style={{
                  fontSize: '11px', fontWeight: 700, color: '#888',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>
                  {tag}
                </span>
                <span style={{ fontSize: '10px', color: '#555' }}>({groupRules.length})</span>
                <div style={{ flex: 1, height: '1px', background: '#2a2a2a', marginLeft: '6px' }} />
              </button>

              {/* Group rows */}
              {openGroups.has(tag) && (
                <div style={{
                  background: '#1e1e1e', borderRadius: '4px',
                  border: '1px solid #2d2d2d', overflow: 'hidden',
                }}>
                  {groupRules.map((rule, idx) => (
                    <RuleRow
                      key={rule.id}
                      rule={rule}
                      isLast={idx === groupRules.length - 1}
                      onToggle={() => handleToggleRule(rule)}
                      onEdit={() => openEdit(rule)}
                      onDelete={() => handleDeleteRule(rule.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ── Export modal ── */}
      {showExportModal && (
        <ExportModal rules={rules} onClose={() => setShowExportModal(false)} />
      )}

      {/* ── Edit / Add modal ── */}
      {editingRule && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px',
        }}>
          <div style={{
            background: '#252526', padding: '24px', borderRadius: '8px',
            maxWidth: '760px', width: '100%', maxHeight: '90vh', overflow: 'auto',
          }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 500 }}>
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

            {/* Tags */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: '#cccccc' }}>
                Tags
                <span style={{ fontSize: '11px', color: '#666', marginLeft: '8px' }}>
                  Groups related rules. Press Enter or comma to add each tag.
                </span>
              </label>
              <TagInput
                tags={editingRule.tags ?? []}
                onChange={(t) => setEditingRule({ ...editingRule, tags: t })}
              />
            </div>

            {/* Conditions */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', color: '#cccccc' }}>
                  Match Conditions{' '}
                  <span style={{ fontSize: '11px', color: '#666' }}>(ALL must match)</span>
                </label>
                <button
                  onClick={addCondition}
                  style={{
                    padding: '4px 10px', background: '#0e639c', border: 'none',
                    borderRadius: '3px', color: 'white', fontSize: '11px', cursor: 'pointer',
                  }}
                >+ Add Condition</button>
              </div>

              {editingRule.conditions.map((condition, idx) => (
                <div key={idx} style={{ marginBottom: '8px' }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: condition.type === 'header' || condition.type === 'queryParam'
                      ? '130px 140px 1fr 80px 40px'
                      : '130px 1fr 80px 40px',
                    gap: '8px',
                    alignItems: 'center',
                  }}>
                    <select
                      value={condition.type}
                      onChange={(e) => {
                        const newType = e.target.value as MockCondition['type'];
                        const namePreservingTypes = new Set(['header', 'queryParam']);
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
                    >✕</button>
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
                  onChange={(e) => setEditingRule({ ...editingRule, statusCode: parseInt(e.target.value) || 200 })}
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
                  onChange={(e) => setEditingRule({ ...editingRule, delayMs: parseInt(e.target.value) || 0 })}
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
                overflow: 'hidden',
              }}>
                <MonacoRequestEditor
                  value={editingRule.responseBody}
                  onChange={(value) => setEditingRule({ ...editingRule, responseBody: value })}
                  language={contentTypeToLanguage(editingRule.contentType || '')}
                />
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditingRule(null)}
                style={{
                  padding: '8px 16px', background: 'transparent', border: '1px solid #555',
                  borderRadius: '4px', color: '#cccccc', fontSize: '13px', cursor: 'pointer',
                }}
              >Cancel</button>
              <button
                onClick={handleSaveRule}
                style={{
                  padding: '8px 16px', background: '#0e639c', border: 'none',
                  borderRadius: '4px', color: 'white', fontSize: '13px', cursor: 'pointer',
                }}
              >Save Rule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
