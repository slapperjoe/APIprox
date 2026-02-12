import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

export interface FileWatch {
    id: string;
    name: string;
    path: string;
    pattern?: string; // glob pattern (e.g., "*.log", "**/*.json")
    enabled: boolean;
    recursive: boolean;
    createdAt: string;
}

export interface FileChangeEvent {
    watchId: string;
    watchName: string;
    eventType: 'created' | 'modified' | 'deleted' | 'renamed';
    filePath: string;
    timestamp: string;
    size?: number;
    content?: string;
    pairingKey?: string; // Extracted from content for pairing
    messageType?: 'request' | 'response'; // Detected from content
}

export class FileWatcherService extends EventEmitter {
    private watches: Map<string, FileWatch> = new Map();
    private watchers: Map<string, fs.FSWatcher> = new Map();
    private recentEvents: FileChangeEvent[] = [];
    private maxEvents = 1000;

    constructor() {
        super();
        this.log('[FileWatcher] Service initialized');
    }

    /**
     * Add a new file watch
     */
    addWatch(watch: FileWatch): void {
        if (this.watches.has(watch.id)) {
            throw new Error(`Watch with id ${watch.id} already exists`);
        }

        // Validate path exists
        if (!fs.existsSync(watch.path)) {
            throw new Error(`Path does not exist: ${watch.path}`);
        }

        this.watches.set(watch.id, watch);

        if (watch.enabled) {
            this.startWatch(watch);
        }

        this.log(`[FileWatcher] Added watch: ${watch.name} (${watch.path})`);
    }

    /**
     * Remove a file watch
     */
    removeWatch(watchId: string): void {
        const watch = this.watches.get(watchId);
        if (!watch) {
            throw new Error(`Watch not found: ${watchId}`);
        }

        this.stopWatch(watchId);
        this.watches.delete(watchId);

        this.log(`[FileWatcher] Removed watch: ${watch.name}`);
    }

    /**
     * Enable/disable a watch
     */
    toggleWatch(watchId: string, enabled: boolean): void {
        const watch = this.watches.get(watchId);
        if (!watch) {
            throw new Error(`Watch not found: ${watchId}`);
        }

        watch.enabled = enabled;

        if (enabled) {
            this.startWatch(watch);
        } else {
            this.stopWatch(watchId);
        }

        this.log(`[FileWatcher] ${enabled ? 'Enabled' : 'Disabled'} watch: ${watch.name}`);
    }

    /**
     * Get all watches
     */
    getWatches(): FileWatch[] {
        return Array.from(this.watches.values());
    }

    /**
     * Get recent file change events
     */
    getRecentEvents(limit: number = 100): FileChangeEvent[] {
        return this.recentEvents.slice(-limit);
    }

    /**
     * Clear event history
     */
    clearEvents(): void {
        this.recentEvents = [];
        this.log('[FileWatcher] Cleared event history');
    }

    /**
     * Start watching a path
     */
    private startWatch(watch: FileWatch): void {
        if (this.watchers.has(watch.id)) {
            return; // Already watching
        }

        try {
            const watcher = fs.watch(
                watch.path,
                { recursive: watch.recursive },
                (eventType, filename) => {
                    if (filename) {
                        this.handleFileChange(watch, eventType, filename);
                    }
                }
            );

            watcher.on('error', (error) => {
                this.log(`[FileWatcher] Error on watch ${watch.name}: ${error.message}`);
            });

            this.watchers.set(watch.id, watcher);
            this.log(`[FileWatcher] Started watching: ${watch.path}`);
        } catch (error: any) {
            this.log(`[FileWatcher] Failed to start watch ${watch.name}: ${error.message}`);
        }
    }

    /**
     * Stop watching a path
     */
    private stopWatch(watchId: string): void {
        const watcher = this.watchers.get(watchId);
        if (watcher) {
            watcher.close();
            this.watchers.delete(watchId);
        }
    }

    /**
     * Handle file system change event
     */
    private handleFileChange(watch: FileWatch, eventType: string, filename: string): void {
        const filePath = path.join(watch.path, filename);

        // Apply pattern filter if specified
        if (watch.pattern) {
            const matches = this.matchesPattern(filename, watch.pattern);
            if (!matches) {
                return;
            }
        }

        // Determine event type
        let changeType: 'created' | 'modified' | 'deleted' | 'renamed' = 'modified';
        if (eventType === 'rename') {
            // Check if file still exists to distinguish create/delete
            if (fs.existsSync(filePath)) {
                changeType = 'created';
            } else {
                changeType = 'deleted';
            }
        } else if (eventType === 'change') {
            changeType = 'modified';
        }

        // Get file size and content if exists
        let size: number | undefined;
        let content: string | undefined;
        let pairingKey: string | undefined;
        let messageType: 'request' | 'response' | undefined;
        
        try {
            if (fs.existsSync(filePath) && changeType !== 'deleted') {
                const stats = fs.statSync(filePath);
                size = stats.size;
                
                // Read content for pairing (limit to 100KB for performance)
                if (size < 100 * 1024) {
                    content = fs.readFileSync(filePath, 'utf8');
                    const parseResult = this.parseContentForPairing(content);
                    pairingKey = parseResult.pairingKey;
                    messageType = parseResult.messageType;
                }
            }
        } catch (error) {
            // Ignore errors getting size/content
        }

        const event: FileChangeEvent = {
            watchId: watch.id,
            watchName: watch.name,
            eventType: changeType,
            filePath,
            timestamp: new Date().toISOString(),
            size,
            content,
            pairingKey,
            messageType
        };

        // Add to recent events
        this.recentEvents.push(event);
        if (this.recentEvents.length > this.maxEvents) {
            this.recentEvents.shift();
        }

        // Emit event
        this.emit('fileChange', event);

        this.log(`[FileWatcher] ${changeType.toUpperCase()}: ${filePath}`);
    }

    /**
     * Match filename against glob pattern
     */
    private matchesPattern(filename: string, pattern: string): boolean {
        // Simple glob matching (can be enhanced with a proper glob library)
        if (pattern === '*' || pattern === '**/*') {
            return true;
        }

        // Convert glob pattern to regex
        const regexPattern = pattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');

        const regex = new RegExp(`^${regexPattern}$`, 'i');
        return regex.test(filename);
    }

    /**
     * Parse file content to extract pairing information
     */
    private parseContentForPairing(content: string): { pairingKey?: string; messageType?: 'request' | 'response' } {
        try {
            // Try XML parsing first (SOAP)
            if (content.includes('<?xml') || content.includes('<soap:') || content.includes('<Envelope')) {
                return this.parseXmlForPairing(content);
            }
            
            // Try JSON parsing
            if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
                return this.parseJsonForPairing(content);
            }
        } catch (error) {
            // Ignore parsing errors
        }
        
        return {};
    }

    /**
     * Extract pairing info from XML/SOAP content
     */
    private parseXmlForPairing(xml: string): { pairingKey?: string; messageType?: 'request' | 'response' } {
        let messageType: 'request' | 'response' | undefined;
        let pairingKey: string | undefined;

        // Detect message type from common patterns
        if (xml.includes('Request>') || xml.includes(':Request>') || xml.includes('request>')) {
            messageType = 'request';
        } else if (xml.includes('Response>') || xml.includes(':Response>') || xml.includes('response>')) {
            messageType = 'response';
        }

        // Extract operation name (common pairing key)
        const operationMatch = xml.match(/<([^:>\s]+:)?(\w+)(Request|Response)>/);
        if (operationMatch) {
            pairingKey = operationMatch[2]; // Operation name without suffix
        }

        // Try to extract correlation ID if present
        const correlationMatch = xml.match(/<(?:[^:]+:)?(?:CorrelationId|MessageId|RequestId|TransactionId)[^>]*>([^<]+)</i);
        if (correlationMatch) {
            pairingKey = correlationMatch[1];
        }

        // Fallback: extract timestamp if present
        if (!pairingKey) {
            const timestampMatch = xml.match(/<(?:[^:]+:)?(?:Timestamp|DateTime|Time)[^>]*>([^<]+)</i);
            if (timestampMatch) {
                pairingKey = timestampMatch[1];
            }
        }

        return { pairingKey, messageType };
    }

    /**
     * Extract pairing info from JSON content
     */
    private parseJsonForPairing(jsonStr: string): { pairingKey?: string; messageType?: 'request' | 'response' } {
        try {
            const json = JSON.parse(jsonStr);
            let messageType: 'request' | 'response' | undefined;
            let pairingKey: string | undefined;

            // Detect message type
            if (json.request || json.method || json.params) {
                messageType = 'request';
            } else if (json.response || json.result || json.data) {
                messageType = 'response';
            }

            // Extract pairing key from common fields
            pairingKey = json.id || json.correlationId || json.requestId || json.transactionId || json.messageId;

            // Fallback to timestamp
            if (!pairingKey) {
                pairingKey = json.timestamp || json.time || json.date;
            }

            return { pairingKey, messageType };
        } catch (error) {
            return {};
        }
    }

    /**
     * Stop all watches and cleanup
     */
    stop(): void {
        for (const [watchId] of this.watchers) {
            this.stopWatch(watchId);
        }
        this.watches.clear();
        this.log('[FileWatcher] Service stopped');
    }

    private log(message: string): void {
        console.log(message);
    }
}
