import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { listen } from '@tauri-apps/api/event';
import { bridge } from '../utils/bridge';

interface FileWatch {
  id: string;
  name: string;
  path: string;
  pattern?: string;
  enabled: boolean;
  recursive: boolean;
  createdAt: string;
}

interface FileChangeEvent {
  watchId: string;
  watchName: string;
  eventType: 'created' | 'modified' | 'deleted' | 'renamed';
  filePath: string;
  timestamp: string;
  size?: number;
  content?: string;
  pairingKey?: string;
  messageType?: 'request' | 'response';
}

interface PairedEvents {
  pairingKey: string;
  request?: FileChangeEvent;
  response?: FileChangeEvent;
  timestamp: string;
}

const Container = styled.div`
  display: flex;
  height: 100%;
  background: #1e1e1e;
`;

const Sidebar = styled.div`
  width: 300px;
  background: #252526;
  border-right: 1px solid #3e3e42;
  display: flex;
  flex-direction: column;
`;

const SidebarHeader = styled.div`
  padding: 12px 16px;
  border-bottom: 1px solid #3e3e42;
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 500;
  }
`;

const AddButton = styled.button`
  background: #0e639c;
  border: none;
  color: white;
  padding: 4px 12px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  
  &:hover {
    background: #1177bb;
  }
`;

const WatchList = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const WatchItem = styled.div<{ $active: boolean }>`
  padding: 12px 16px;
  border-bottom: 1px solid #3e3e42;
  cursor: pointer;
  background: ${props => props.$active ? '#37373d' : 'transparent'};
  
  &:hover {
    background: #2a2d2e;
  }
`;

const WatchName = styled.div`
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const WatchPath = styled.div`
  font-size: 11px;
  color: #858585;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const WatchPattern = styled.div`
  font-size: 10px;
  color: #6a9955;
`;

const StatusBadge = styled.span<{ $enabled: boolean }>`
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  background: ${props => props.$enabled ? '#4d9e4d' : '#858585'};
  color: white;
`;

const MainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

const ContentHeader = styled.div`
  padding: 12px 16px;
  border-bottom: 1px solid #3e3e42;
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 500;
  }
`;

const EventList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 8px;
`;

const PairContainer = styled.div`
  background: #252526;
  border: 2px solid #0e639c;
  border-radius: 4px;
  padding: 16px;
  margin-bottom: 12px;
`;

const PairHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #3e3e42;
  
  h4 {
    margin: 0;
    font-size: 14px;
    color: #0e639c;
  }
`;

const PairContent = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
`;

const PairItem = styled.div`
  background: #1e1e1e;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  padding: 12px;
`;

const PairLabel = styled.div`
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  color: #858585;
  margin-bottom: 8px;
`;

const EventItem = styled.div`
  background: #252526;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  padding: 12px;
  margin-bottom: 8px;
`;

const EventHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`;

const EventType = styled.span<{ $type: string }>`
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 3px;
  font-weight: 500;
  text-transform: uppercase;
  background: ${props => {
    switch(props.$type) {
      case 'created': return '#4d9e4d';
      case 'modified': return '#d7a40e';
      case 'deleted': return '#e81123';
      case 'renamed': return '#0e639c';
      default: return '#858585';
    }
  }};
  color: white;
`;

const EventTime = styled.span`
  font-size: 11px;
  color: #858585;
`;

const EventPath = styled.div`
  font-size: 12px;
  color: #d4d4d4;
  font-family: 'Consolas', monospace;
  word-break: break-all;
  margin-bottom: 4px;
`;

const EventMeta = styled.div`
  font-size: 11px;
  color: #858585;
`;

const Modal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: #252526;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  width: 500px;
  max-height: 80vh;
  overflow-y: auto;
`;

const ModalHeader = styled.div`
  padding: 16px;
  border-bottom: 1px solid #3e3e42;
  
  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 500;
  }
`;

const ModalBody = styled.div`
  padding: 16px;
`;

const FormGroup = styled.div`
  margin-bottom: 16px;
  
  label {
    display: block;
    font-size: 12px;
    margin-bottom: 6px;
    color: #d4d4d4;
  }
  
  input, select {
    width: 100%;
    padding: 6px 8px;
    background: #1e1e1e;
    border: 1px solid #3e3e42;
    border-radius: 3px;
    color: #d4d4d4;
    font-size: 13px;
    font-family: inherit;
    
    &:focus {
      outline: none;
      border-color: #0e639c;
    }
  }
`;

const CheckboxGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  
  input[type="checkbox"] {
    width: auto;
  }
  
  label {
    margin: 0;
    font-size: 13px;
  }
`;

const ModalFooter = styled.div`
  padding: 16px;
  border-top: 1px solid #3e3e42;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`;

const Button = styled.button`
  padding: 6px 16px;
  border-radius: 3px;
  border: none;
  cursor: pointer;
  font-size: 13px;
`;

const PrimaryButton = styled(Button)`
  background: #0e639c;
  color: white;
  
  &:hover {
    background: #1177bb;
  }
`;

const SecondaryButton = styled(Button)`
  background: transparent;
  color: #d4d4d4;
  border: 1px solid #3e3e42;
  
  &:hover {
    background: #37373d;
  }
`;

const DangerButton = styled(Button)`
  background: #e81123;
  color: white;
  
  &:hover {
    background: #c50f1f;
  }
`;

const SuccessButton = styled(Button)`
  background: #4d9e4d;
  color: white;
  
  &:hover {
    background: #3d8e3d;
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #858585;
  
  p {
    margin: 8px 0;
    font-size: 14px;
  }
`;

export const FileWatcherPage: React.FC = () => {
  const [watches, setWatches] = useState<FileWatch[]>([]);
  const [events, setEvents] = useState<FileChangeEvent[]>([]);
  const [selectedWatch, setSelectedWatch] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newWatch, setNewWatch] = useState({
    name: '',
    path: '',
    pattern: '',
    recursive: true
  });

  useEffect(() => {
    loadWatches();
    loadEvents();

    // Listen for real-time watcher events from Rust
    const unlisten = listen<any>('watcher-event', (event) => {
      const e = event.payload;
      // Map Rust WatcherEvent fields to local FileChangeEvent shape
      const mapped: FileChangeEvent = {
        watchId: e.watchId,
        watchName: e.watchName,
        eventType: e.eventKind || 'modified',
        filePath: e.filePath,
        timestamp: new Date(e.timestamp).toISOString(),
      };
      setEvents(prev => [mapped, ...prev].slice(0, 1000));
    });

    return () => { unlisten.then(fn => fn()); };
  }, []);

  const loadWatches = async () => {
    try {
      const result = await bridge.getFileWatches();
      setWatches(Array.isArray(result) ? result : (result.watches || []));
    } catch (error) {
      console.error('Failed to load file watches:', error);
    }
  };

  const loadEvents = async () => {
    try {
      const result = await bridge.getFileWatchEvents(100);
      const raw = Array.isArray(result) ? result : (result.events || []);
      // Map Rust WatcherEvent fields to local FileChangeEvent shape
      setEvents(raw.map((e: any) => ({
        watchId: e.watchId,
        watchName: e.watchName,
        eventType: e.eventKind || 'modified',
        filePath: e.filePath,
        timestamp: new Date(e.timestamp).toISOString(),
      })));
    } catch (error) {
      console.error('Failed to load events:', error);
    }
  };

  const handleAddWatch = async () => {
    if (!newWatch.name || !newWatch.path) {
      alert('Name and path are required');
      return;
    }

    try {
      const watch = {
        id: '',
        name: newWatch.name,
        path: newWatch.path,
        pattern: newWatch.pattern || null,
        enabled: true,
        recursive: newWatch.recursive,
        createdAt: new Date().toISOString()
      };

      await bridge.addFileWatch(watch);
      await loadWatches();
      setShowAddModal(false);
      setNewWatch({ name: '', path: '', pattern: '', recursive: true });
    } catch (error: any) {
      alert(`Failed to add watch: ${error}`);
    }
  };

  const handleToggleWatch = async (id: string, enabled: boolean) => {
    const watch = watches.find((w: any) => w.id === id);
    if (!watch) return;
    try {
      await bridge.updateFileWatch(id, { ...watch, enabled: !enabled });
      await loadWatches();
    } catch (error: any) {
      alert(`Failed to toggle watch: ${error}`);
    }
  };

  const handleDeleteWatch = async (id: string) => {
    if (!confirm('Are you sure you want to delete this watch?')) {
      return;
    }

    try {
      await bridge.deleteFileWatch(id);
      await loadWatches();
      if (selectedWatch === id) {
        setSelectedWatch(null);
      }
    } catch (error: any) {
      alert(`Failed to delete watch: ${error.message || error}`);
    }
  };

  const handleClearEvents = async () => {
    if (!confirm('Clear all event history?')) {
      return;
    }

    try {
      await bridge.clearFileWatchEvents();
      await loadEvents();
    } catch (error) {
      alert('Failed to clear events');
    }
  };

  const filteredEvents = selectedWatch
    ? events.filter(e => e.watchId === selectedWatch)
    : events;

  // Group events into pairs based on pairing key
  const pairEvents = (events: FileChangeEvent[]): PairedEvents[] => {
    const pairs: Map<string, PairedEvents> = new Map();
    
    for (const event of events) {
      if (!event.pairingKey || !event.messageType) {
        continue; // Skip unpaired events
      }
      
      const existing = pairs.get(event.pairingKey);
      if (existing) {
        if (event.messageType === 'request') {
          existing.request = event;
        } else {
          existing.response = event;
        }
        // Update timestamp to latest
        existing.timestamp = event.timestamp > existing.timestamp ? event.timestamp : existing.timestamp;
      } else {
        pairs.set(event.pairingKey, {
          pairingKey: event.pairingKey,
          [event.messageType]: event,
          timestamp: event.timestamp
        });
      }
    }
    
    // Return only complete pairs (both request and response), sorted by timestamp
    return Array.from(pairs.values())
      .filter(p => p.request && p.response)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  };

  const pairedEvents = pairEvents(filteredEvents);
  const unpairedEvents = filteredEvents.filter(e => !e.pairingKey || !e.messageType);

  const handleCreateMockRule = async (pair: PairedEvents) => {
    if (!pair.request || !pair.response) return;
    
    try {
      // Extract operation name from request for rule name
      const operationMatch = pair.request.content?.match(/<([^:>\s]+:)?(\w+)Request>/);
      const operationName = operationMatch ? operationMatch[2] : 'UnknownOperation';
      
      const mockRule = {
        id: `mock-${Date.now()}`,
        name: `${operationName} (from files)`,
        enabled: true,
        conditions: [
          {
            type: 'xpath' as const,
            pattern: `${operationName}Request`,
            isRegex: false
          }
        ],
        statusCode: 200,
        responseBody: pair.response.content || '',
        delayMs: 0
      };
      
      await bridge.addMockRule(mockRule);
      alert('Mock rule created successfully!');
    } catch (error: any) {
      alert(`Failed to create mock rule: ${error.message || error}`);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const formatSize = (size?: number) => {
    if (!size) return '';
    if (size < 1024) return `${size}B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
    return `${(size / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <Container>
      <Sidebar>
        <SidebarHeader>
          <h3>File Watches</h3>
          <AddButton onClick={() => setShowAddModal(true)}>+ Add</AddButton>
        </SidebarHeader>
        <WatchList>
          <WatchItem 
            $active={selectedWatch === null}
            onClick={() => setSelectedWatch(null)}
          >
            <WatchName>
              All Watches
              <StatusBadge $enabled={true}>{events.length} events</StatusBadge>
            </WatchName>
            <WatchPath>View all file changes</WatchPath>
          </WatchItem>
          {watches.map(watch => (
            <WatchItem
              key={watch.id}
              $active={selectedWatch === watch.id}
              onClick={() => setSelectedWatch(watch.id)}
            >
              <WatchName>
                {watch.name}
                <StatusBadge $enabled={watch.enabled}>
                  {watch.enabled ? 'ON' : 'OFF'}
                </StatusBadge>
              </WatchName>
              <WatchPath title={watch.path}>{watch.path}</WatchPath>
              {watch.pattern && <WatchPattern>Pattern: {watch.pattern}</WatchPattern>}
              <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                <SecondaryButton onClick={(e) => {
                  e.stopPropagation();
                  handleToggleWatch(watch.id, watch.enabled);
                }}>
                  {watch.enabled ? 'Disable' : 'Enable'}
                </SecondaryButton>
                <DangerButton onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteWatch(watch.id);
                }}>
                  Delete
                </DangerButton>
              </div>
            </WatchItem>
          ))}
        </WatchList>
      </Sidebar>

      <MainContent>
        <ContentHeader>
          <h2>
            {selectedWatch 
              ? watches.find(w => w.id === selectedWatch)?.name || 'Events'
              : 'All Events'}
          </h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <SecondaryButton onClick={loadEvents}>Refresh</SecondaryButton>
            <DangerButton onClick={handleClearEvents}>Clear</DangerButton>
          </div>
        </ContentHeader>

        {filteredEvents.length === 0 ? (
          <EmptyState>
            <p>No file changes detected</p>
            <p style={{ fontSize: '12px' }}>
              {watches.length === 0 
                ? 'Add a file watch to start monitoring'
                : 'Waiting for file system events...'}
            </p>
          </EmptyState>
        ) : (
          <EventList>
            {/* Paired Request/Response Events */}
            {pairedEvents.map((pair, idx) => (
              <PairContainer key={`pair-${idx}`}>
                <PairHeader>
                  <h4>Request/Response Pair - {pair.pairingKey}</h4>
                  <SuccessButton onClick={() => handleCreateMockRule(pair)}>
                    Create Mock Rule
                  </SuccessButton>
                </PairHeader>
                <PairContent>
                  <PairItem>
                    <PairLabel>Request</PairLabel>
                    <EventPath>{pair.request?.filePath}</EventPath>
                    <EventMeta>
                      {formatTime(pair.request?.timestamp || '')}
                      {pair.request?.size !== undefined && ` • ${formatSize(pair.request.size)}`}
                    </EventMeta>
                  </PairItem>
                  <PairItem>
                    <PairLabel>Response</PairLabel>
                    <EventPath>{pair.response?.filePath}</EventPath>
                    <EventMeta>
                      {formatTime(pair.response?.timestamp || '')}
                      {pair.response?.size !== undefined && ` • ${formatSize(pair.response.size)}`}
                    </EventMeta>
                  </PairItem>
                </PairContent>
              </PairContainer>
            ))}

            {/* Unpaired Individual Events */}
            {unpairedEvents.map((event, idx) => (
              <EventItem key={`unpaired-${idx}`}>
                <EventHeader>
                  <EventType $type={event.eventType}>{event.eventType}</EventType>
                  <EventTime>{formatTime(event.timestamp)}</EventTime>
                </EventHeader>
                <EventPath>{event.filePath}</EventPath>
                <EventMeta>
                  Watch: {event.watchName}
                  {event.size !== undefined && ` • Size: ${formatSize(event.size)}`}
                </EventMeta>
              </EventItem>
            ))}
          </EventList>
        )}
      </MainContent>

      {showAddModal && (
        <Modal onClick={() => setShowAddModal(false)}>
          <ModalContent onClick={(e) => e.stopPropagation()}>
            <ModalHeader>
              <h3>Add File Watch</h3>
            </ModalHeader>
            <ModalBody>
              <FormGroup>
                <label>Name *</label>
                <input
                  type="text"
                  placeholder="e.g., Application Logs"
                  value={newWatch.name}
                  onChange={e => setNewWatch({ ...newWatch, name: e.target.value })}
                />
              </FormGroup>
              <FormGroup>
                <label>Path *</label>
                <input
                  type="text"
                  placeholder="e.g., C:\logs or /var/log/app"
                  value={newWatch.path}
                  onChange={e => setNewWatch({ ...newWatch, path: e.target.value })}
                />
              </FormGroup>
              <FormGroup>
                <label>Pattern (optional)</label>
                <input
                  type="text"
                  placeholder="e.g., *.log, **/*.json"
                  value={newWatch.pattern}
                  onChange={e => setNewWatch({ ...newWatch, pattern: e.target.value })}
                />
              </FormGroup>
              <CheckboxGroup>
                <input
                  type="checkbox"
                  id="recursive"
                  checked={newWatch.recursive}
                  onChange={e => setNewWatch({ ...newWatch, recursive: e.target.checked })}
                />
                <label htmlFor="recursive">Watch subdirectories</label>
              </CheckboxGroup>
            </ModalBody>
            <ModalFooter>
              <SecondaryButton onClick={() => setShowAddModal(false)}>
                Cancel
              </SecondaryButton>
              <PrimaryButton onClick={handleAddWatch}>
                Add Watch
              </PrimaryButton>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </Container>
  );
};
