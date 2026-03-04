# APIprox - HTTP/HTTPS Proxy & Mock Server

## Overview
APIprox is a standalone desktop application for intercepting, inspecting, and mocking HTTP/HTTPS traffic. It functions as a transparent proxy server with advanced traffic manipulation capabilities, mock server features, and certificate management for HTTPS interception.

## Key Features

### 1. HTTP/HTTPS Proxy
- **Transparent Proxy**: Route application traffic through APIprox to inspect requests and responses
- **HTTPS Interception**: Decrypt and inspect HTTPS traffic with custom CA certificate
- **Traffic Recording**: Capture all HTTP/HTTPS traffic in real-time
- **Request/Response Inspection**: View headers, bodies, status codes, timing information

### 2. Mock Server
- **Mock API Responses**: Return predefined responses without hitting real servers
- **Rule-Based Matching**: Match requests by URL patterns, HTTP methods, headers, or XPath
- **Flexible Responses**: Configure status codes, headers, response bodies, and delays
- **Priority System**: Control which rules match first

### 3. Replace Rules (Traffic Manipulation)
- **XPath-Based Replacement**: Modify specific XML elements in requests/responses
- **Text/Regex Replacement**: Find and replace text patterns
- **Request/Response Targeting**: Apply rules to requests, responses, or both
- **Real-Time Modification**: Changes applied transparently as traffic flows through

### 4. Certificate Management
- **Self-Signed CA Certificate**: Generate custom root certificate for HTTPS interception
- **Easy Installation**: One-click trust installation (Windows/macOS/Linux)
- **Certificate Export**: Download certificate for manual installation
- **Certificate Information**: View certificate details (validity, fingerprint, issuer)

## Getting Started

### Basic Setup

1. **Launch APIprox**
2. **Start the Server**:
   - Choose mode: Proxy, Mock, or Both
   - Set proxy port (default: 8888)
   - Configure target URL (for proxy mode)
   - Click "Start Server"

3. **Configure Your Application**:
   - Set HTTP proxy to `localhost:8888`
   - Or use system-wide proxy settings

4. **View Traffic**:
   - Navigate to "Traffic" tab
   - See all intercepted requests and responses

### HTTPS Interception Setup

To intercept HTTPS traffic, you need to trust APIprox's certificate:

1. **Generate Certificate**:
   - Go to Settings → Certificate Management
   - Click "Generate New Certificate"

2. **Trust Certificate**:
   - Click "Trust Certificate" (requires admin/sudo)
   - Or export and install manually

3. **Verify**:
   - Status should show "✓ Trusted"
   - HTTPS traffic will now be decryptable

**Platform-Specific Notes:**
- **Windows**: Uses `certutil` to install to Trusted Root
- **macOS**: Uses `security` command to add to System keychain
- **Linux**: Copies to `/usr/local/share/ca-certificates/`

## Modes

### Proxy Mode
Routes traffic to a target URL while recording and optionally modifying it.

**Use Cases:**
- Debug API calls from your application
- Inspect production traffic
- Test API changes without modifying code
- Replace sensitive data in requests/responses

**Configuration:**
- Target URL: Where to forward requests (e.g., `https://api.example.com`)
- Port: Local proxy port (default: 8888)

### Mock Mode
Returns predefined responses without forwarding to real servers.

**Use Cases:**
- Offline development
- Testing error scenarios
- Simulating slow servers
- Providing consistent test data

**Configuration:**
- Port: Local mock server port (default: 8888)
- Mock rules define what responses to return

### Both Mode
Combines proxy and mock - checks mock rules first, forwards to target if no match.

**Use Cases:**
- Mock specific endpoints while proxying others
- Gradually migrate from real API to mocks
- Override production responses for testing

## Replace Rules

Replace rules modify traffic as it flows through the proxy.

### Creating a Replace Rule

1. **Go to Rules Tab** → Replace Rules
2. **Click "Add Rule"**
3. **Configure:**
   - **Name**: Descriptive name for the rule
   - **XPath**: Target element (e.g., `//Customer/SSN`)
   - **Find**: Text or regex pattern to match
   - **Replace**: Replacement text
   - **Target**: Request, Response, or Both
   - **Regex**: Enable for regex pattern matching

### Example Replace Rules

**Mask Social Security Numbers:**
```
Name: Mask SSN
XPath: //Customer/SSN
Find: \d{3}-\d{2}-\d{4}
Replace: XXX-XX-XXXX
Target: Response
Regex: ✓
```

**Replace Environment:**
```
Name: Dev to Prod Env
XPath: //Environment
Find: development
Replace: production
Target: Request
Regex: ✗
```

**Inject Test User ID:**
```
Name: Test User Override
XPath: //Request/UserId
Find: .*
Replace: TEST_USER_12345
Target: Request
Regex: ✓
```

### XPath Scope

Replace rules only modify text within the element matched by XPath. For example:
- XPath: `//Price`
- Matches: `<Price>100.00</Price>`
- Replaces text inside `<Price>` tags only

## Mock Rules

Mock rules define responses to return for matching requests.

### Creating a Mock Rule

1. **Go to Rules Tab** → Mock Rules
2. **Click "Add Rule"**
3. **Configure:**
   - **Name**: Descriptive name
   - **Conditions**: How to match requests (URL, XPath, method)
   - **Response**: Status code, headers, body
   - **Delay**: Optional response delay in milliseconds

### Match Conditions

**URL Matching:**
- Simple contains: `/api/users`
- Regex: `^/api/users/\d+$`

**XPath Matching:**
- Match XML content: `//Request/Action[text()='GetUser']`

**HTTP Method:**
- GET, POST, PUT, DELETE, etc.

### Example Mock Rules

**Mock User API:**
```
Name: Get User Success
Conditions:
  - URL contains: /api/user
  - Method: GET
Response:
  Status: 200
  Body:
    {
      "id": 123,
      "name": "Test User",
      "email": "test@example.com"
    }
Delay: 100ms
```

**Mock SOAP Service:**
```
Name: GetCustomer Success
Conditions:
  - XPath: //GetCustomer/CustomerId
Response:
  Status: 200
  Body:
    <soap:Envelope>
      <soap:Body>
        <GetCustomerResponse>
          <Name>John Doe</Name>
          <Balance>1000.00</Balance>
        </GetCustomerResponse>
      </soap:Body>
    </soap:Envelope>
```

**Mock Error Scenario:**
```
Name: Simulate Timeout
Conditions:
  - URL contains: /api/slow-endpoint
Response:
  Status: 504
  Body: Gateway Timeout
Delay: 30000ms (30 seconds)
```

## Traffic Viewer

The traffic viewer shows all intercepted HTTP/HTTPS requests and responses.

### Traffic Table Columns

- **Time**: When the request was made
- **Method**: HTTP method (GET, POST, etc.)
- **URL**: Request URL/path
- **Status**: Response status code
- **Duration**: Time to complete request
- **Size**: Response body size

### Viewing Details

Click any row to see:
- **Request**: Headers, body, timing
- **Response**: Status, headers, body, timing
- **Raw Data**: Complete HTTP messages

### Filtering Traffic

Use the search box to filter by:
- URL patterns
- HTTP methods
- Status codes
- Request/response content

### Clearing Traffic

Click "Clear" to remove all traffic entries from the viewer.

## Settings

### Server Settings
- **Proxy Port**: Port to listen on (default: 8888)
- **Target URL**: Where to forward proxied requests
- **Auto-start**: Launch server on app startup

### Certificate Management
- **Generate Certificate**: Create new self-signed CA certificate
- **Trust Certificate**: Install certificate to system trust store
- **Export Certificate**: Download certificate file
- **View Certificate Info**: See certificate details

### Advanced Options
- **Log Level**: Control verbosity of logs
- **Request Timeout**: Maximum time to wait for responses
- **Max Body Size**: Maximum request/response body size to capture

## Configuration Files

Rules and certificates are stored in `~/.apiprox/`:

| File | Contents |
|------|----------|
| `mock-rules.json` | Mock response rules |
| `replace-rules.json` | XPath/regex replace rules |
| `breakpoint-rules.json` | Traffic breakpoint rules |
| `ca.cer` | Root CA certificate (PEM) |
| `ca.key` | CA private key (PEM) |

## Architecture

APIprox is built with **Tauri 2** (Rust backend) and **React/TypeScript** (webview frontend).

- All proxy, mock, and certificate logic runs in Rust — no Node.js or external server
- The proxy listens on a configurable port and handles HTTP/HTTPS (with TLS MITM)
- Frontend communicates with the Rust backend via Tauri `invoke()` commands
- Traffic events are streamed to the UI via Tauri event emitter

## Building from Source

```bash
# Development (hot-reload)
npm run tauri:dev

# Production build
npm run tauri:build
```

Requires: Rust toolchain, Node.js 18+, platform build tools (Xcode / Visual Studio Build Tools).

## Common Use Cases

### Testing API Integration
1. Start APIprox in Proxy mode
2. Point your app to proxy (`localhost:8888`)
3. Set target URL to your API server
4. Run your app and view traffic
5. Create replace rules to modify requests

### Mocking External Dependencies
1. Start APIprox in Mock mode
2. Create mock rules for endpoints your app calls
3. Point your app to mock server
4. Develop offline with consistent responses

### Debugging Production Issues
1. Start APIprox in Proxy mode
2. Set target to production API
3. Add replace rules to sanitize sensitive data
4. Capture traffic for analysis
5. Export traffic logs for review

### Performance Testing
1. Create mock rules with various delays
2. Test how your app handles slow responses
3. Simulate timeouts and errors
4. Measure impact on user experience

## Troubleshooting

### Certificate Not Trusted
**Symptom**: HTTPS traffic shows certificate errors

**Solutions:**
- Re-generate certificate in Settings
- Manually install certificate (Settings → Export)
- Check system trust store
- Restart browser/application after installing

### No Traffic Appearing
**Symptom**: Traffic viewer is empty

**Solutions:**
- Verify proxy settings in your application
- Check server is running (green status indicator)
- Ensure port is not blocked by firewall
- Try HTTP endpoint first (no certificate needed)

### Mock Rules Not Matching
**Symptom**: Requests hit real server instead of mock

**Solutions:**
- Check rule is enabled
- Verify URL pattern matches request
- Check rule priority order
- Test conditions individually
- View traffic log to see actual URLs

### Proxy Connection Refused
**Symptom**: "Connection refused" errors

**Solutions:**
- Verify server is started
- Check port number matches proxy configuration
- Ensure port is not already in use
- Try different port number

## Best Practices

### Replace Rules
- Use specific XPath expressions to avoid unintended replacements
- Test rules with representative traffic first
- Document complex regex patterns
- Use descriptive names
- Disable rules when not needed

### Mock Rules
- Keep mock responses realistic
- Include appropriate headers (Content-Type, etc.)
- Use delays to simulate real network conditions
- Version your mock data
- Organize rules by feature/module

### Certificate Management
- Generate new certificates periodically
- Keep certificate private key secure
- Export certificate before regenerating
- Document installation process for team
- Test with multiple browsers/applications

### Traffic Recording
- Clear logs regularly to save memory
- Filter traffic to reduce noise
- Export important traffic sessions
- Use replace rules to sanitize logs before sharing
- Archive traffic logs for debugging

## Security Considerations

### Certificate Security
- The CA certificate generated by APIprox is **self-signed**
- Installing it to system trust store allows **any application** to intercept HTTPS
- Only use on development/test machines
- Never install on production systems
- Remove certificate when not needed

### Data Privacy
- APIprox sees all traffic passing through it (including passwords, tokens, etc.)
- Use replace rules to mask sensitive data in logs
- Clear traffic logs after debugging
- Don't share raw traffic logs
- Export functionality redacts secrets

### Network Security
- APIprox runs a local server (localhost only by default)
- Ensure firewall rules are appropriate
- Don't expose proxy port to network
- Use strong passwords if authentication is added

## FAQ

**Q: Can APIprox intercept traffic from any application?**
A: Yes, any application that supports HTTP proxy configuration can use APIprox. System-wide proxy settings will route all traffic.

**Q: Does APIprox modify my applications?**
A: No, APIprox is a transparent proxy. Applications are unmodified and unaware of interception.

**Q: Can I use APIprox with mobile apps?**
A: Yes, configure your mobile device's WiFi proxy settings to point to your computer running APIprox.

**Q: What's the difference between APIprox and APInox?**
A: **APIprox** is for HTTP/HTTPS traffic interception and mocking. **APInox** is for SOAP API testing and development. Both can work together - APIprox can intercept traffic from APInox.

**Q: Can I save and load mock rule sets?**
A: Yes, rules are stored in configuration files and persist between sessions. You can export/import rule sets.

**Q: Does APIprox support WebSocket?**
A: Not currently. APIprox focuses on HTTP/HTTPS REST and SOAP traffic.

**Q: Can I automate rule creation?**
A: Rules are stored in JSON format and can be created/modified programmatically.

## Support & Resources

- **GitHub Issues**: Report bugs and request features
- **Documentation**: Full docs at [github.com/yourusername/apiprox/docs]
- **Community**: Discussions and Q&A
- **APInox Integration**: Use together for complete API testing workflow

## License

[Your License Here]

---

**Version**: 0.2.0  
**Last Updated**: 2026-03-04
