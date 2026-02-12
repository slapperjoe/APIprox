import express from 'express';
import { ProxyService, ServerMode } from './services/ProxyService';
import { MockService } from './services/MockService';
import { BreakpointService } from './services/BreakpointService';
import { FileWatcherService } from './services/FileWatcherService';
import { MockRule, BreakpointRule, FileWatch } from '../../shared/src/models';
import { INotificationService, IConfigService } from './interfaces';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const app = express();
const PORT = process.env.PORT || 0; // Random port

app.use(express.json());

// Add CORS headers for development
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Initialize services (but don't start yet)
let proxyService: ProxyService | null = null;
let mockService: MockService | null = null;
let breakpointService: BreakpointService | null = null;
let fileWatcherService: FileWatcherService | null = null;

// Persistence files
const MOCK_RULES_FILE = path.join(os.homedir(), '.apiprox', 'mock-rules.json');
const BREAKPOINT_RULES_FILE = path.join(os.homedir(), '.apiprox', 'breakpoint-rules.json');
const FILE_WATCHES_FILE = path.join(os.homedir(), '.apiprox', 'file-watches.json');

function loadMockRules(): MockRule[] {
    try {
        if (fs.existsSync(MOCK_RULES_FILE)) {
            const data = fs.readFileSync(MOCK_RULES_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('[Sidecar] Failed to load mock rules:', error);
    }
    return [];
}

function saveMockRules(rules: MockRule[]) {
    try {
        const dir = path.dirname(MOCK_RULES_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(MOCK_RULES_FILE, JSON.stringify(rules, null, 2));
        console.log('[Sidecar] Mock rules saved');
    } catch (error) {
        console.error('[Sidecar] Failed to save mock rules:', error);
    }
}

function loadBreakpointRules(): BreakpointRule[] {
    try {
        if (fs.existsSync(BREAKPOINT_RULES_FILE)) {
            const data = fs.readFileSync(BREAKPOINT_RULES_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('[Sidecar] Failed to load breakpoint rules:', error);
    }
    return [];
}

function saveBreakpointRules(rules: BreakpointRule[]) {
    try {
        const dir = path.dirname(BREAKPOINT_RULES_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(BREAKPOINT_RULES_FILE, JSON.stringify(rules, null, 2));
        console.log('[Sidecar] Breakpoint rules saved');
    } catch (error) {
        console.error('[Sidecar] Failed to save breakpoint rules:', error);
    }
}

function loadFileWatches(): FileWatch[] {
    try {
        if (fs.existsSync(FILE_WATCHES_FILE)) {
            const data = fs.readFileSync(FILE_WATCHES_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('[Sidecar] Failed to load file watches:', error);
    }
    return [];
}

function saveFileWatches(watches: FileWatch[]) {
    try {
        const dir = path.dirname(FILE_WATCHES_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(FILE_WATCHES_FILE, JSON.stringify(watches, null, 2));
        console.log('[Sidecar] File watches saved');
    } catch (error) {
        console.error('[Sidecar] Failed to save file watches:', error);
    }
}

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        version: '0.1.0',
        service: 'APIprox Sidecar',
        proxy: proxyService ? 'initialized' : 'not initialized',
        mock: mockService ? 'initialized' : 'not initialized'
    });
});

// Proxy control endpoints
app.post('/proxy/start', async (req, res) => {
    try {
        const { port, mode, targetUrl } = req.body;
        
        if (!targetUrl) {
            return res.status(400).json({ success: false, error: 'Target URL is required' });
        }
        
        if (!proxyService) {
            // Stub notification service
            const notificationService: INotificationService = {
                showInfo: (msg: string) => console.log('[INFO]', msg),
                showError: (msg: string) => console.error('[ERROR]', msg),
                showWarning: async (msg: string, ...actions: string[]) => { 
                    console.warn('[WARN]', msg); 
                    return undefined;
                },
                showInformationMessage: (msg: string) => console.log('[INFO]', msg),
                showWarningMessage: (msg: string) => console.warn('[WARN]', msg),
                showErrorMessage: (msg: string) => console.error('[ERROR]', msg)
            };
            
            // Stub config service
            const configService: IConfigService = {
                get: <T>(section: string, key: string, defaultValue?: T) => defaultValue,
                set: async (key: string, value: any) => {},
                has: (key: string) => false,
                getProxyUrl: () => undefined,
                getStrictSSL: () => false
            };
            
            proxyService = new ProxyService(
                { port: port || 8888, targetUrl, systemProxyEnabled: false },
                notificationService,
                configService,
                breakpointService || undefined
            );
        } else {
            // Update existing proxy service config
            proxyService.updateConfig({ port, targetUrl });
        }
        
        await proxyService.start();
        
        console.log(`[Sidecar] Proxy started on port ${port}, forwarding to ${targetUrl}`);
        
        res.json({ success: true, port, mode, targetUrl });
    } catch (error: any) {
        console.error('[Sidecar] Failed to start proxy:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/proxy/stop', async (req, res) => {
    try {
        if (proxyService) {
            await proxyService.stop();
        }
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/proxy/status', (req, res) => {
    if (!proxyService) {
        res.json({ enabled: false, port: null, mode: 'off' });
    } else {
        res.json({
            enabled: true,
            port: 8888, // TODO: Get actual port from proxy service
            mode: 'proxy' // TODO: Get actual mode
        });
    }
});

// Mock status endpoint
app.get('/mock/status', (req, res) => {
    const rules = mockService ? mockService.getRules() : loadMockRules();
    res.json({
        enabled: mockService?.isActive() || false,
        port: mockService?.getPort() || null,
        rules: rules
    });
});

// Mock rules CRUD endpoints
app.get('/mock/rules', (req, res) => {
    try {
        const rules = mockService ? mockService.getRules() : loadMockRules();
        res.json({ rules });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/mock/rules', (req, res) => {
    try {
        const newRule: MockRule = req.body;
        const rules = loadMockRules();
        rules.push(newRule);
        saveMockRules(rules);
        
        if (mockService) {
            mockService.setRules(rules);
        }
        
        res.json({ success: true, rule: newRule });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/mock/rules/:id', (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const rules = loadMockRules();
        const index = rules.findIndex(r => r.id === id);
        
        if (index === -1) {
            return res.status(404).json({ error: 'Rule not found' });
        }
        
        rules[index] = { ...rules[index], ...updates };
        saveMockRules(rules);
        
        if (mockService) {
            mockService.setRules(rules);
        }
        
        res.json({ success: true, rule: rules[index] });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/mock/rules/:id', (req, res) => {
    try {
        const { id } = req.params;
        const rules = loadMockRules();
        const filtered = rules.filter(r => r.id !== id);
        
        if (filtered.length === rules.length) {
            return res.status(404).json({ error: 'Rule not found' });
        }
        
        saveMockRules(filtered);
        
        if (mockService) {
            mockService.setRules(filtered);
        }
        
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Breakpoint rules CRUD endpoints
app.get('/breakpoint/rules', (req, res) => {
    try {
        const service = breakpointService as BreakpointService | null;
        const rules = service ? service.getRules() : loadBreakpointRules();
        res.json({ rules });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/breakpoint/rules', (req, res) => {
    try {
        const newRule: BreakpointRule = req.body;
        const rules = loadBreakpointRules();
        rules.push(newRule);
        saveBreakpointRules(rules);
        
        const service = breakpointService as BreakpointService | null;
        if (service) {
            service.setRules(rules);
        }
        
        res.json({ success: true, rule: newRule });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/breakpoint/rules/:id', (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const rules = loadBreakpointRules();
        const index = rules.findIndex(r => r.id === id);
        
        if (index === -1) {
            return res.status(404).json({ error: 'Rule not found' });
        }
        
        rules[index] = { ...rules[index], ...updates };
        saveBreakpointRules(rules);
        
        const service = breakpointService as BreakpointService | null;
        if (service) {
            service.setRules(rules);
        }
        
        res.json({ success: true, rule: rules[index] });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/breakpoint/rules/:id', (req, res) => {
    try {
        const { id } = req.params;
        const rules = loadBreakpointRules();
        const filtered = rules.filter(r => r.id !== id);
        
        if (filtered.length === rules.length) {
            return res.status(404).json({ error: 'Rule not found' });
        }
        
        saveBreakpointRules(filtered);
        
        const service = breakpointService as BreakpointService | null;
        if (service) {
            service.setRules(filtered);
        }
        
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Breakpoint traffic control endpoints
app.get('/breakpoint/queue', (req, res) => {
    try {
        const service = breakpointService as BreakpointService | null;
        const queue = service ? service.getPausedTraffic() : [];
        res.json({ queue });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/breakpoint/continue/:id', (req, res) => {
    try {
        const service = breakpointService as BreakpointService | null;
        if (!service) {
            return res.status(400).json({ error: 'Breakpoint service not initialized' });
        }
        
        const { id } = req.params;
        const modifications = req.body.modifications;
        
        service.continueTraffic(id, modifications);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/breakpoint/drop/:id', (req, res) => {
    try {
        const service = breakpointService as BreakpointService | null;
        if (!service) {
            return res.status(400).json({ error: 'Breakpoint service not initialized' });
        }
        
        const { id } = req.params;
        service.dropTraffic(id);
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Certificate management endpoints
app.get('/certificate/info', (req, res) => {
    try {
        const certDir = path.join(os.homedir(), '.apiprox');
        const certPath = path.join(certDir, 'cert.pem');
        const keyPath = path.join(certDir, 'key.pem');
        
        if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
            const certPem = fs.readFileSync(certPath, 'utf8');
            const forge = require('node-forge');
            const cert = forge.pki.certificateFromPem(certPem);
            
            res.json({
                exists: true,
                subject: cert.subject.attributes.find((a: any) => a.name === 'commonName')?.value || 'N/A',
                issuer: cert.issuer.attributes.find((a: any) => a.name === 'commonName')?.value || 'N/A',
                validFrom: cert.validity.notBefore,
                validTo: cert.validity.notAfter,
                serialNumber: cert.serialNumber,
                fingerprint: forge.md.sha256.create().update(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()).digest().toHex()
            });
        } else {
            res.json({ exists: false });
        }
    } catch (error: any) {
        res.status(500).json({ exists: false, error: error.message });
    }
});

app.post('/certificate/generate', (req, res) => {
    try {
        const certDir = path.join(os.homedir(), '.apiprox');
        if (!fs.existsSync(certDir)) {
            fs.mkdirSync(certDir, { recursive: true });
        }
        
        const forge = require('node-forge');
        const keys = forge.pki.rsa.generateKeyPair(2048);
        const cert = forge.pki.createCertificate();
        
        cert.publicKey = keys.publicKey;
        cert.serialNumber = '01' + Date.now().toString(16);
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date();
        cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);
        
        const attrs = [
            { name: 'commonName', value: 'APIprox CA' },
            { name: 'organizationName', value: 'APIprox' },
            { name: 'countryName', value: 'US' }
        ];
        
        cert.setSubject(attrs);
        cert.setIssuer(attrs);
        cert.setExtensions([
            { name: 'basicConstraints', cA: true },
            { name: 'keyUsage', keyCertSign: true, cRLSign: true }
        ]);
        
        cert.sign(keys.privateKey, forge.md.sha256.create());
        
        const pemCert = forge.pki.certificateToPem(cert);
        const pemKey = forge.pki.privateKeyToPem(keys.privateKey);
        
        fs.writeFileSync(path.join(certDir, 'cert.pem'), pemCert);
        fs.writeFileSync(path.join(certDir, 'key.pem'), pemKey);
        
        console.log('[Sidecar] Certificate generated successfully');
        res.json({ success: true, message: 'Certificate generated' });
    } catch (error: any) {
        console.error('[Sidecar] Failed to generate certificate:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/certificate/export', (req, res) => {
    try {
        const certPath = path.join(os.homedir(), '.apiprox', 'cert.pem');
        if (fs.existsSync(certPath)) {
            const certPem = fs.readFileSync(certPath, 'utf8');
            res.setHeader('Content-Type', 'application/x-pem-file');
            res.setHeader('Content-Disposition', 'attachment; filename="apiprox-ca.crt"');
            res.send(certPem);
        } else {
            res.status(404).json({ error: 'Certificate not found' });
        }
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/certificate/trust', (req, res) => {
    try {
        const certPath = path.join(os.homedir(), '.apiprox', 'cert.pem');
        if (!fs.existsSync(certPath)) {
            return res.status(404).json({ success: false, error: 'Certificate not found' });
        }
        
        // Platform-specific trust commands
        const platform = os.platform();
        const { execSync } = require('child_process');
        
        if (platform === 'win32') {
            // Windows: Add to Trusted Root Certification Authorities
            execSync(`certutil -addstore -user Root "${certPath}"`, { stdio: 'inherit' });
            res.json({ success: true, message: 'Certificate added to Windows trust store' });
        } else if (platform === 'darwin') {
            // macOS: Add to System keychain
            execSync(`sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "${certPath}"`, { stdio: 'inherit' });
            res.json({ success: true, message: 'Certificate added to macOS keychain' });
        } else if (platform === 'linux') {
            // Linux: Copy to ca-certificates
            const destPath = '/usr/local/share/ca-certificates/apiprox-ca.crt';
            execSync(`sudo cp "${certPath}" "${destPath}"`, { stdio: 'inherit' });
            execSync('sudo update-ca-certificates', { stdio: 'inherit' });
            res.json({ success: true, message: 'Certificate added to Linux trust store' });
        } else {
            res.status(400).json({ success: false, error: 'Unsupported platform' });
        }
    } catch (error: any) {
        console.error('[Sidecar] Failed to trust certificate:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// File Watcher Endpoints
// ============================================================================

// Get all file watches
app.get('/filewatcher/watches', (req, res) => {
    try {
        if (!fileWatcherService) {
            return res.json({ watches: [] });
        }
        const watches = fileWatcherService.getWatches();
        res.json({ watches });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Add file watch
app.post('/filewatcher/watches', (req, res) => {
    try {
        if (!fileWatcherService) {
            return res.status(400).json({ error: 'File watcher service not initialized' });
        }
        
        const watch: FileWatch = req.body;
        fileWatcherService.addWatch(watch);
        
        // Persist to disk
        const watches = fileWatcherService.getWatches();
        saveFileWatches(watches);
        
        res.json({ success: true, watch });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Update file watch (toggle enabled)
app.put('/filewatcher/watches/:id', (req, res) => {
    try {
        if (!fileWatcherService) {
            return res.status(400).json({ error: 'File watcher service not initialized' });
        }
        
        const { id } = req.params;
        const { enabled } = req.body;
        
        fileWatcherService.toggleWatch(id, enabled);
        
        // Persist to disk
        const watches = fileWatcherService.getWatches();
        saveFileWatches(watches);
        
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Delete file watch
app.delete('/filewatcher/watches/:id', (req, res) => {
    try {
        if (!fileWatcherService) {
            return res.status(400).json({ error: 'File watcher service not initialized' });
        }
        
        const { id } = req.params;
        fileWatcherService.removeWatch(id);
        
        // Persist to disk
        const watches = fileWatcherService.getWatches();
        saveFileWatches(watches);
        
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get recent file change events
app.get('/filewatcher/events', (req, res) => {
    try {
        if (!fileWatcherService) {
            return res.json({ events: [] });
        }
        
        const limit = parseInt(req.query.limit as string) || 100;
        const events = fileWatcherService.getRecentEvents(limit);
        res.json({ events });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Clear event history
app.post('/filewatcher/events/clear', (req, res) => {
    try {
        if (!fileWatcherService) {
            return res.status(400).json({ error: 'File watcher service not initialized' });
        }
        
        fileWatcherService.clearEvents();
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Start server
const server = app.listen(PORT, () => {
    const address = server.address();
    const actualPort = typeof address === 'object' && address ? address.port : PORT;
    console.log(`SIDECAR_PORT:${actualPort}`);
    console.log(`[Sidecar] APIprox sidecar running on http://127.0.0.1:${actualPort}`);
    console.log(`[Sidecar] Health check: http://127.0.0.1:${actualPort}/health`);
    console.log(`[Sidecar] Proxy services available`);
    
    // Initialize file watcher service and restore watches
    fileWatcherService = new FileWatcherService();
    const savedWatches = loadFileWatches();
    for (const watch of savedWatches) {
        try {
            fileWatcherService.addWatch(watch);
        } catch (error: any) {
            console.error(`[Sidecar] Failed to restore watch ${watch.name}:`, error.message);
        }
    }
    console.log(`[Sidecar] File watcher initialized with ${savedWatches.length} watches`);
});

export { app, proxyService, mockService, fileWatcherService };

