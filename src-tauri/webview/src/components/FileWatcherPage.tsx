import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { listen } from '@tauri-apps/api/event';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { MonacoRequestEditor, MonacoResponseViewer, EditorSettingsProvider, useEditorSettings, DEFAULT_EDITOR_SETTINGS } from '@apinox/request-editor';
import type { EditorSettings } from '@apinox/request-editor';
import { bridge } from '../utils/bridge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FileWatch {
  id: string;
  name: string;
  enabled: boolean;
  requestFile: string;
  responseFile: string;
  correlationIdElements: string[];
}

interface SoapMessage {
  id: string;
  watchId: string;
  timestamp: number;
  messageType: string;
  filePath: string;
  content: string;
  operationName?: string;
  correlationId?: string;
}

interface SoapPair {
  id: string;
  watchId: string;
  operationName?: string;
  request?: SoapMessage;
  response?: SoapMessage;
  status: 'pending' | 'matched';
  createdAt: number;
  updatedAt: number;
}

interface WatcherSoapEvent {
  eventType: string;
  pair: SoapPair;
}

// ---------------------------------------------------------------------------
// Styled components
// ---------------------------------------------------------------------------

const Container = styled.div`
  display: flex;
  height: 100%;
  background: #1e1e1e;
  color: #d4d4d4;
  font-size: 13px;
`;

const Sidebar = styled.div`
  width: 240px;
  min-width: 200px;
  background: #252526;
  border-right: 1px solid #3e3e42;
  display: flex;
  flex-direction: column;
`;

const SidebarHeader = styled.div`
  padding: 10px 14px;
  border-bottom: 1px solid #3e3e42;
  display: flex;
  justify-content: space-between;
  align-items: center;
  h3 { margin: 0; font-size: 13px; font-weight: 600; }
`;

const WatchList = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const WatchItem = styled.div<{ $active: boolean }>`
  padding: 10px 14px;
  border-bottom: 1px solid #2d2d30;
  cursor: pointer;
  background: ${p => p.$active ? '#37373d' : 'transparent'};
  &:hover { background: ${p => p.$active ? '#37373d' : '#2a2d2e'}; }
`;

const WatchName = styled.div`
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
`;

const WatchPath = styled.div`
  font-size: 10px;
  color: #858585;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StatusBadge = styled.span<{ $enabled: boolean }>`
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  background: ${p => p.$enabled ? '#0e639c' : '#555'};
  color: white;
`;

const WatchActions = styled.div`
  margin-top: 6px;
  display: flex;
  gap: 6px;
`;

// Main area: pair list + detail panel
const MainArea = styled.div`
  flex: 1;
  display: flex;
  overflow: hidden;
`;

const PairList = styled.div`
  width: 280px;
  min-width: 220px;
  border-right: 1px solid #3e3e42;
  display: flex;
  flex-direction: column;
`;

const PairListHeader = styled.div`
  padding: 10px 14px;
  border-bottom: 1px solid #3e3e42;
  display: flex;
  justify-content: space-between;
  align-items: center;
  h3 { margin: 0; font-size: 13px; font-weight: 600; }
`;

const PairScroll = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const PairRow = styled.div<{ $active: boolean }>`
  padding: 10px 14px;
  border-bottom: 1px solid #2d2d30;
  cursor: pointer;
  background: ${p => p.$active ? '#37373d' : 'transparent'};
  &:hover { background: ${p => p.$active ? '#37373d' : '#2a2d2e'}; }
`;

const PairRowHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 3px;
`;

const OperationName = styled.div`
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
`;

const MatchBadge = styled.span<{ $matched: boolean }>`
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  background: ${p => p.$matched ? '#3a6e3a' : '#7a5a1e'};
  color: ${p => p.$matched ? '#89d185' : '#ddb165'};
  flex-shrink: 0;
  margin-left: 6px;
`;

const PairTime = styled.div`
  font-size: 10px;
  color: #858585;
`;

// Detail panel
const DetailPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const DetailHeader = styled.div`
  padding: 10px 16px;
  border-bottom: 1px solid #3e3e42;
  display: flex;
  align-items: center;
  gap: 12px;
  background: #252526;
`;

const DetailTitle = styled.div`
  font-size: 13px;
  font-weight: 500;
  flex: 1;
`;

const DetailBody = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const EditorPane = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-bottom: 1px solid #3e3e42;
  &:last-child { border-bottom: none; }
`;

const PaneLabel = styled.div`
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  color: #c8c8c8;
  background: #252526;
  border-bottom: 1px solid #2d2d30;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const GearBtn = styled.button`
  background: none;
  border: none;
  color: #858585;
  cursor: pointer;
  padding: 2px 4px;
  line-height: 1;
  font-size: 18px;
  display: flex;
  align-items: center;
  border-radius: 3px;
  &:hover { color: #d4d4d4; background: #3c3c3c; }
`;

const SettingsPopup = styled.div<{ $top: number; $right: number }>`
  position: fixed;
  top: ${p => p.$top}px;
  right: ${p => p.$right}px;
  z-index: 1000;
  background: #2d2d30;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 200px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.5);

  .settings-section {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .settings-title {
    font-size: 10px;
    font-weight: 700;
    color: #6b6b6b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  label.row {
    font-size: 12px;
    color: #c8c8c8;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    input[type="checkbox"] { cursor: pointer; }
  }

  label.col {
    font-size: 12px;
    color: #c8c8c8;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  select, input[type="number"] {
    background: #3c3c3c;
    border: 1px solid #555;
    border-radius: 3px;
    color: #d4d4d4;
    font-size: 12px;
    padding: 3px 6px;
    width: 100%;
  }

  hr {
    border: none;
    border-top: 1px solid #3e3e42;
    margin: 0;
  }
`;

const PaneMeta = styled.div`
  padding: 3px 14px;
  font-size: 10px;
  color: #6b6b6b;
  background: #252526;
  border-bottom: 1px solid #2d2d30;
`;

const Placeholder = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #555;
  font-size: 12px;
`;

const EmptyState = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #555;
  gap: 6px;
  p { margin: 0; font-size: 12px; }
`;

// Buttons
const Btn = styled.button`
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
  padding: 3px 10px;
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const PrimaryBtn = styled(Btn)`
  background: #0e639c;
  color: white;
  &:hover:not(:disabled) { background: #1177bb; }
`;

const SecondaryBtn = styled(Btn)`
  background: transparent;
  color: #d4d4d4;
  border: 1px solid #3e3e42;
  &:hover:not(:disabled) { background: #37373d; }
`;

const DangerBtn = styled(Btn)`
  background: #c50f1f;
  color: white;
  &:hover:not(:disabled) { background: #e81123; }
`;

const SuccessBtn = styled(Btn)`
  background: #3a6e3a;
  color: #89d185;
  border: 1px solid #3a6e3a;
  &:hover:not(:disabled) { background: #4d9e4d; }
`;

const AddBtn = styled(Btn)`
  background: #0e639c;
  color: white;
  padding: 3px 10px;
  &:hover { background: #1177bb; }
`;

// Modal
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const Modal = styled.div`
  background: #252526;
  border: 1px solid #3e3e42;
  border-radius: 6px;
  width: 500px;
  max-width: 90vw;
  box-shadow: 0 8px 32px rgba(0,0,0,.5);
`;

const ModalHeader = styled.div`
  padding: 14px 18px;
  border-bottom: 1px solid #3e3e42;
  font-size: 14px;
  font-weight: 600;
`;

const ModalBody = styled.div`
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ModalFooter = styled.div`
  padding: 12px 18px;
  border-top: 1px solid #3e3e42;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;

  label {
    font-size: 11px;
    font-weight: 600;
    color: #c8c8c8;
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }

  input, textarea {
    background: #3c3c3c;
    border: 1px solid #555;
    border-radius: 3px;
    color: #d4d4d4;
    font-size: 12px;
    padding: 5px 8px;
    font-family: 'Consolas', monospace;
    &:focus { outline: none; border-color: #0e639c; }
  }

  .hint {
    font-size: 10px;
    color: #6b6b6b;
    margin-top: 2px;
  }
`;

const FileInput = styled.div`
  display: flex;
  gap: 6px;
  align-items: stretch;

  input {
    flex: 1;
    min-width: 0;
  }
`;

const BrowseBtn = styled.button`
  background: #3c3c3c;
  border: 1px solid #555;
  border-radius: 3px;
  color: #d4d4d4;
  font-size: 12px;
  padding: 4px 10px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  &:hover { background: #4a4a4a; border-color: #777; }
`;

// ---------------------------------------------------------------------------
// Inner editor panes — must live inside EditorSettingsProvider to use context
// ---------------------------------------------------------------------------

interface EditorPanesProps {
  pair: SoapPair;
  requestPanePx: number | undefined;
  showSettings: boolean;
  onToggleSettings: () => void;
  formatTime: (ts: number) => string;
}

const EditorPanes: React.FC<EditorPanesProps> = ({
  pair, requestPanePx, showSettings, onToggleSettings, formatTime,
}) => {
  const { settings, updateSettings } = useEditorSettings();
  const gearBtnRef = useRef<HTMLButtonElement>(null);
  const [popupPos, setPopupPos] = useState({ top: 0, right: 0 });

  const handleGearClick = () => {
    if (!showSettings && gearBtnRef.current) {
      const rect = gearBtnRef.current.getBoundingClientRect();
      setPopupPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    onToggleSettings();
  };

  return (
    <>
      <EditorPane style={requestPanePx !== undefined ? { flex: `0 0 ${requestPanePx}px` } : {}}>
        <PaneLabel>
          <span>Request</span>
          <div style={{ position: 'relative' }}>
            <GearBtn ref={gearBtnRef} title="Editor settings" onClick={handleGearClick}>⚙</GearBtn>
            {showSettings && (
              <SettingsPopup $top={popupPos.top} $right={popupPos.right}>
                <div className="settings-section">
                  <div className="settings-title">Font</div>
                  <label className="col">
                    Size
                    <input
                      type="number" min={8} max={24}
                      value={settings.fontSize}
                      onChange={e => updateSettings({ fontSize: Number(e.target.value) })}
                    />
                  </label>
                  <label className="col">
                    Family
                    <select
                      value={settings.fontFamily}
                      onChange={e => updateSettings({ fontFamily: e.target.value })}
                    >
                      <option value='Consolas, "Courier New", monospace'>Consolas</option>
                      <option value='"Fira Code", monospace'>Fira Code</option>
                      <option value='"JetBrains Mono", monospace'>JetBrains Mono</option>
                      <option value='"Cascadia Code", monospace'>Cascadia Code</option>
                      <option value='"Source Code Pro", monospace'>Source Code Pro</option>
                      <option value='"Courier New", monospace'>Courier New</option>
                    </select>
                  </label>
                </div>
                <hr />
                <div className="settings-section">
                  <div className="settings-title">Display</div>
                  <label className="row">
                    <input type="checkbox" checked={settings.showLineNumbers} onChange={e => updateSettings({ showLineNumbers: e.target.checked })} />
                    Line Numbers
                  </label>
                  <label className="row">
                    <input type="checkbox" checked={settings.showMinimap} onChange={e => updateSettings({ showMinimap: e.target.checked })} />
                    Minimap
                  </label>
                  <label className="row">
                    <input type="checkbox" checked={settings.prettyPrint} onChange={e => updateSettings({ prettyPrint: e.target.checked })} />
                    Pretty Print
                  </label>
                </div>
                <hr />
                <div className="settings-section">
                  <div className="settings-title">Formatting</div>
                  <label className="row">
                    <input type="checkbox" checked={settings.inlineValues} onChange={e => updateSettings({ inlineValues: e.target.checked })} />
                    Inline Values
                  </label>
                  <label className="row">
                    <input type="checkbox" checked={settings.alignAttributes} onChange={e => updateSettings({ alignAttributes: e.target.checked })} />
                    Align Attributes
                  </label>
                  <label className="row">
                    <input type="checkbox" checked={settings.hideCausality} onChange={e => updateSettings({ hideCausality: e.target.checked })} />
                    Hide Causality Data
                  </label>
                </div>
              </SettingsPopup>
            )}
          </div>
        </PaneLabel>
        {pair.request ? (
          <>
            <PaneMeta>
              {pair.request.filePath} · {formatTime(pair.request.timestamp)}
            </PaneMeta>
            <MonacoRequestEditor
              value={pair.request.content}
              onChange={() => {}}
              language="xml"
              readOnly
              showLineNumbers={settings.showLineNumbers}
              showMinimap={settings.showMinimap}
              fontSize={settings.fontSize}
              fontFamily={settings.fontFamily}
            />
          </>
        ) : (
          <Placeholder>No request captured</Placeholder>
        )}
      </EditorPane>
      <EditorPane style={{ flex: 1, minHeight: 0 }}>
        <PaneLabel><span>Response</span></PaneLabel>
        {pair.response ? (
          <>
            <PaneMeta>
              {pair.response.filePath} · {formatTime(pair.response.timestamp)}
            </PaneMeta>
            <MonacoResponseViewer
              value={pair.response.content}
              language="xml"
              showLineNumbers={settings.showLineNumbers}
              showMinimap={settings.showMinimap}
              fontSize={settings.fontSize}
              fontFamily={settings.fontFamily}
            />
          </>
        ) : (
          <Placeholder>Waiting for response…</Placeholder>
        )}
      </EditorPane>
    </>
  );
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const DEFAULT_CORR_ELEMENTS = 'CorrelationId, MessageId, TraceId';

export const FileWatcherPage: React.FC = () => {
  const [watches, setWatches] = useState<FileWatch[]>([]);
  const [pairs, setPairs] = useState<SoapPair[]>([]);
  const [selectedWatchId, setSelectedWatchId] = useState<string | null>(null);
  const [selectedPairId, setSelectedPairId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWatch, setEditingWatch] = useState<FileWatch | null>(null);

  const [formName, setFormName] = useState('');
  const [formRequestFile, setFormRequestFile] = useState('');
  const [formResponseFile, setFormResponseFile] = useState('');
  const [formCorrElements, setFormCorrElements] = useState(DEFAULT_CORR_ELEMENTS);

  const [showEditorSettings, setShowEditorSettings] = useState(false);

  const detailBodyRef = useRef<HTMLDivElement>(null);
  const [detailBodyHeight, setDetailBodyHeight] = useState(0);

  // Measure DetailBody whenever the selected pair changes (DetailBody mounts/unmounts
  // with pair selection). ResizeObserver keeps it live as the window resizes.
  useEffect(() => {
    const el = detailBodyRef.current;
    if (!el) {
      setDetailBodyHeight(0);
      return;
    }
    // Capture immediately so the first render is correct.
    setDetailBodyHeight(el.getBoundingClientRect().height);
    const ro = new ResizeObserver(() => {
      setDetailBodyHeight(el.getBoundingClientRect().height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [selectedPairId]);

  // Load watches on mount
  useEffect(() => {
    loadWatches();
    loadPairs();
  }, []);

  // Listen for real-time SOAP pair events
  useEffect(() => {
    const unlisten = listen<WatcherSoapEvent>('watcher-soap-event', (event) => {
      const { pair } = event.payload;
      setPairs(prev => {
        const idx = prev.findIndex(p => p.id === pair.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = pair;
          return next;
        }
        return [pair, ...prev];
      });
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  const loadWatches = async () => {
    try {
      const result = await bridge.getFileWatches();
      setWatches(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error('Failed to load watches:', err);
    }
  };

  const loadPairs = async () => {
    try {
      const result = await bridge.getSoapPairs();
      if (Array.isArray(result) && result.length > 0) {
        setPairs(result.sort((a: SoapPair, b: SoapPair) => b.createdAt - a.createdAt));
      }
    } catch (err) {
      console.error('Failed to load existing pairs:', err);
    }
  };

  const openAddModal = () => {
    setEditingWatch(null);
    setFormName('');
    setFormRequestFile('');
    setFormResponseFile('');
    setFormCorrElements(DEFAULT_CORR_ELEMENTS);
    setShowAddModal(true);
  };

  const openEditModal = (watch: FileWatch) => {
    setEditingWatch(watch);
    setFormName(watch.name);
    setFormRequestFile(watch.requestFile);
    setFormResponseFile(watch.responseFile);
    setFormCorrElements(watch.correlationIdElements.join(', '));
    setShowAddModal(true);
  };

  const parseCorrElements = (raw: string): string[] =>
    raw.split(',').map(s => s.trim()).filter(Boolean);

  const browseFile = async (setter: (path: string) => void) => {
    const selected = await openDialog({
      multiple: false,
      filters: [{ name: 'XML Files', extensions: ['xml'] }, { name: 'All Files', extensions: ['*'] }],
    });
    if (selected && typeof selected === 'string') {
      setter(selected);
    }
  };

  const handleSaveWatch = async () => {
    if (!formName || !formRequestFile || !formResponseFile) {
      alert('Name, request file, and response file are required.');
      return;
    }
    const watchData = {
      id: editingWatch?.id ?? '',
      name: formName,
      enabled: editingWatch?.enabled ?? true,
      requestFile: formRequestFile,
      responseFile: formResponseFile,
      correlationIdElements: parseCorrElements(formCorrElements),
    };
    try {
      if (editingWatch) {
        await bridge.updateFileWatch(editingWatch.id, watchData);
      } else {
        await bridge.addFileWatch(watchData);
      }
      await loadWatches();
      setShowAddModal(false);
    } catch (err: any) {
      alert(`Failed to save watch: ${err}`);
    }
  };

  const handleToggleWatch = async (watch: FileWatch) => {
    try {
      await bridge.updateFileWatch(watch.id, { ...watch, enabled: !watch.enabled });
      await loadWatches();
    } catch (err: any) {
      alert(`Failed to toggle watch: ${err}`);
    }
  };

  const handleDeleteWatch = async (id: string) => {
    if (!confirm('Delete this watch?')) return;
    try {
      await bridge.deleteFileWatch(id);
      await loadWatches();
      if (selectedWatchId === id) setSelectedWatchId(null);
      setPairs(prev => prev.filter(p => p.watchId !== id));
    } catch (err: any) {
      alert(`Failed to delete watch: ${err}`);
    }
  };

  const handleClearPairs = async () => {
    if (!confirm('Clear all captured pair history?')) return;
    try {
      await bridge.clearFileWatchEvents();
      setPairs([]);
      setSelectedPairId(null);
    } catch (err) {
      console.error('Failed to clear pairs:', err);
    }
  };

  const handleCreateMockRule = async (pair: SoapPair) => {
    if (!pair.request || !pair.response) return;
    const opName = pair.operationName ?? 'UnknownOperation';
    try {
      await bridge.addMockRule({
        id: `mock-${Date.now()}`,
        name: `${opName} (from file watcher)`,
        enabled: true,
        conditions: [{ type: 'xpath', pattern: opName, isRegex: false }],
        statusCode: 200,
        responseBody: pair.response.content,
        delayMs: 0,
      });
      alert('Mock rule created!');
    } catch (err: any) {
      alert(`Failed to create mock rule: ${err}`);
    }
  };

  const formatTime = (ms: number) => new Date(ms).toLocaleTimeString();

  const visiblePairs = selectedWatchId
    ? pairs.filter(p => p.watchId === selectedWatchId)
    : pairs;

  const selectedPair = pairs.find(p => p.id === selectedPairId) ?? null;
  const selectedWatchName = watches.find(w => w.id === selectedWatchId)?.name;

  // Request pane: size to content but cap at 50% of available height.
  // Monaco line height at fontSize 12 is ~18px; add overhead for label + meta rows.
  const LINE_HEIGHT = 18;
  const PANE_OVERHEAD = 56; // PaneLabel (~28px) + PaneMeta (~22px) + separator
  const requestLineCount = selectedPair?.request?.content
    ? selectedPair.request.content.split('\n').length
    : 0;
  const requestNaturalPx = requestLineCount * LINE_HEIGHT + PANE_OVERHEAD;
  const requestPanePx = detailBodyHeight > 0
    ? Math.min(requestNaturalPx, detailBodyHeight * 0.5)
    : undefined;

  return (
    <Container>
      {/* ── Left: Watch list ── */}
      <Sidebar>
        <SidebarHeader>
          <h3>Watches</h3>
          <AddBtn onClick={openAddModal}>+ Add</AddBtn>
        </SidebarHeader>
        <WatchList>
          <WatchItem $active={selectedWatchId === null} onClick={() => setSelectedWatchId(null)}>
            <WatchName>
              All Watches
              <StatusBadge $enabled={true}>{pairs.length}</StatusBadge>
            </WatchName>
            <WatchPath>All captured pairs</WatchPath>
          </WatchItem>
          {watches.map(w => (
            <WatchItem
              key={w.id}
              $active={selectedWatchId === w.id}
              onClick={() => setSelectedWatchId(w.id)}
            >
              <WatchName>
                {w.name}
                <StatusBadge $enabled={w.enabled}>{w.enabled ? 'ON' : 'OFF'}</StatusBadge>
              </WatchName>
              <WatchPath title={w.requestFile}>{w.requestFile}</WatchPath>
              <WatchActions>
                <SecondaryBtn onClick={e => { e.stopPropagation(); openEditModal(w); }}>Edit</SecondaryBtn>
                <SecondaryBtn onClick={e => { e.stopPropagation(); handleToggleWatch(w); }}>
                  {w.enabled ? 'Disable' : 'Enable'}
                </SecondaryBtn>
                <DangerBtn onClick={e => { e.stopPropagation(); handleDeleteWatch(w.id); }}>
                  Delete
                </DangerBtn>
              </WatchActions>
            </WatchItem>
          ))}
        </WatchList>
      </Sidebar>

      {/* ── Centre: Pair list ── */}
      <MainArea>
        <PairList>
          <PairListHeader>
            <h3>{selectedWatchName ?? 'All Pairs'}</h3>
            <SecondaryBtn onClick={handleClearPairs}>Clear</SecondaryBtn>
          </PairListHeader>
          <PairScroll>
            {visiblePairs.length === 0 ? (
              <EmptyState style={{ padding: '32px 16px' }}>
                <p>{watches.length === 0 ? 'Add a watch to start.' : 'Waiting for file changes…'}</p>
              </EmptyState>
            ) : (
              visiblePairs.map(pair => (
                <PairRow
                  key={pair.id}
                  $active={selectedPairId === pair.id}
                  onClick={() => setSelectedPairId(pair.id)}
                >
                  <PairRowHeader>
                    <OperationName title={pair.operationName}>
                      {pair.operationName ?? '(unknown operation)'}
                    </OperationName>
                    <MatchBadge $matched={pair.status === 'matched'}>
                      {pair.status === 'matched' ? 'Matched' : 'Pending'}
                    </MatchBadge>
                  </PairRowHeader>
                  <PairTime>{formatTime(pair.createdAt)}</PairTime>
                </PairRow>
              ))
            )}
          </PairScroll>
        </PairList>

        {/* ── Right: Detail panel ── */}
        <DetailPanel>
          {selectedPair ? (
            <>
              <DetailHeader>
                <DetailTitle>{selectedPair.operationName ?? '(unknown operation)'}</DetailTitle>
                <MatchBadge $matched={selectedPair.status === 'matched'}>
                  {selectedPair.status === 'matched' ? 'Matched' : 'Pending'}
                </MatchBadge>
                {selectedPair.status === 'matched' && (
                  <SuccessBtn onClick={() => handleCreateMockRule(selectedPair)}>
                    Create Mock Rule
                  </SuccessBtn>
                )}
              </DetailHeader>
              <DetailBody ref={detailBodyRef}>
                <EditorSettingsProvider initialSettings={DEFAULT_EDITOR_SETTINGS}>
                  <EditorPanes
                    pair={selectedPair}
                    requestPanePx={requestPanePx}
                    showSettings={showEditorSettings}
                    onToggleSettings={() => setShowEditorSettings(p => !p)}
                    formatTime={formatTime}
                  />
                </EditorSettingsProvider>
              </DetailBody>
            </>
          ) : (
            <EmptyState>
              <p>Select a pair to view request &amp; response</p>
            </EmptyState>
          )}
        </DetailPanel>
      </MainArea>

      {/* ── Add / Edit Watch Modal ── */}
      {showAddModal && (
        <Overlay onClick={() => setShowAddModal(false)}>
          <Modal onClick={e => e.stopPropagation()}>
            <ModalHeader>{editingWatch ? 'Edit Watch' : 'Add Watch'}</ModalHeader>
            <ModalBody>
              <FormGroup>
                <label>Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Booking Service"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                />
              </FormGroup>
              <FormGroup>
                <label>Request File *</label>
                <FileInput>
                  <input
                    type="text"
                    placeholder="e.g. C:\logs\request.xml or /tmp/request.xml"
                    value={formRequestFile}
                    onChange={e => setFormRequestFile(e.target.value)}
                  />
                  <BrowseBtn onClick={() => browseFile(setFormRequestFile)}>Browse…</BrowseBtn>
                </FileInput>
                <span className="hint">File where SOAP requests are written</span>
              </FormGroup>
              <FormGroup>
                <label>Response File *</label>
                <FileInput>
                  <input
                    type="text"
                    placeholder="e.g. C:\logs\response.xml or /tmp/response.xml"
                    value={formResponseFile}
                    onChange={e => setFormResponseFile(e.target.value)}
                  />
                  <BrowseBtn onClick={() => browseFile(setFormResponseFile)}>Browse…</BrowseBtn>
                </FileInput>
                <span className="hint">File where SOAP responses are written</span>
              </FormGroup>
              <FormGroup>
                <label>Correlation ID Elements <span style={{ color: '#6b6b6b', fontWeight: 400, textTransform: 'none' }}>(comma-separated)</span></label>
                <input
                  type="text"
                  value={formCorrElements}
                  onChange={e => setFormCorrElements(e.target.value)}
                />
                <span className="hint">SOAP header element names used as correlation IDs</span>
              </FormGroup>
            </ModalBody>
            <ModalFooter>
              <SecondaryBtn onClick={() => setShowAddModal(false)}>Cancel</SecondaryBtn>
              <PrimaryBtn onClick={handleSaveWatch}>
                {editingWatch ? 'Save' : 'Add Watch'}
              </PrimaryBtn>
            </ModalFooter>
          </Modal>
        </Overlay>
      )}
    </Container>
  );
};
