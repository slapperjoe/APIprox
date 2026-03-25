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
- **Rule-Based Matching**: Match requests by URL patterns, HTTP methods, headers, XPath, and more
- **Flexible Responses**: Configure status codes, headers, response bodies, and delays
- **Priority System**: Control which rules match first

### 3. Replace Rules (Traffic Manipulation)
- **XPath-Based Replacement**: Modify specific XML elements in requests/responses
- **Text/Regex Replacement**: Find and replace text patterns
- **Request/Response Targeting**: Apply rules to requests, responses, or both
- **Real-Time Modification**: Changes applied transparently as traffic flows through

### 4. Breakpoints
- **Pause Live Traffic**: Intercept and inspect individual requests or responses before forwarding
- **Edit in Flight**: Modify headers and body before forwarding or returning
- **Continue or Drop**: Resume traffic unchanged or discard it entirely

### 5. File Watcher
- **Watch XML Files**: Monitor directories for request/response XML file pairs
- **Side-by-Side View**: View matched pairs in a split editor
- **SOAP Workflow Support**: Useful when test tools write request/response XML to disk

### 6. Certificate Management
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
   - Click "Start Proxy"

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
   - Click "Generate Certificate"

2. **Install to Trust Store**:
   - Click "Install to System Trust Store" (requires admin/sudo)
   - Or export and install manually

3. **Verify**:
   - Status should show "✓ Certificate is valid"
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

1. **Go to the Replace Rules tab**
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

## Mock Server

The **Mock Server** tab lets you define rules that return predefined responses for matching requests.

### Creating a Mock Rule

1. **Go to the Mock Server tab**
2. **Click "Add Rule"**
3. **Configure:**
   - **Name**: Descriptive name
   - **Conditions**: How to match requests (see below)
   - **Status Code**: HTTP status to return (e.g. `200`, `404`, `500`)
   - **Content-Type**: Select from XML, JSON, plain text, HTML, or enter a custom value
   - **Response Headers**: Add any custom response headers as key-value pairs
   - **Response Body**: Enter the response body; syntax highlighting matches the selected content-type
   - **Delay**: Optional latency in milliseconds to simulate slow responses

### Match Conditions

All conditions in a rule must match (AND logic). Supported types:

| Condition Type | Matches on | Example pattern |
|---|---|---|
| **URL Path** | Request URL (path + query) | `/api/users` or `^/api/users/\d+$` |
| **HTTP Method** | HTTP verb | `GET` or `POST` |
| **Header** | Named request header value | Name: `content-type`, Value: `application/json` |
| **Query Param** | Named URL query parameter | Name: `env`, Value: `prod` |
| **XPath** | XML element exists in body | `//GetCustomer/CustomerId` |
| **Body Contains** | Raw body contains text | `TemplateName` |
| **SOAP Action** | `SOAPAction` header | `urn:GetUser` |

Enable **Regex** on any condition to match the pattern as a regular expression.

### Example Mock Rules

**Mock User API:**
```
Name: Get User Success
Conditions:
  - URL contains: /api/user
  - Method: GET
Response:
  Status: 200
  Content-Type: JSON
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
  Content-Type: XML
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

## Breakpoints

The **Breakpoints** tab lets you pause live traffic at a specific phase for inspection and modification.

### Creating a Breakpoint Rule

1. **Go to the Breakpoints tab**
2. **Click "Add Breakpoint"**
3. **Configure:**
   - **Name**: Descriptive label for the rule
   - **Pause On**: Request, Response, or Both
   - **Conditions**: URL, Method, Header, or Body Contains patterns to match

### Handling Paused Traffic

When a rule matches, the paused item appears in the queue. For each item you can:

- **Edit & Continue**: Modify headers and/or body in the editor, then forward
- **Continue**: Pass through unchanged
- **Drop**: Discard the request entirely

> Paused items auto-resolve after a timeout to prevent the proxy from blocking indefinitely.

## File Watcher

The **File Watcher** tab monitors directories for XML request/response file pairs.

### Adding a Watch

1. **Go to the File Watcher tab**
2. **Click "Add Watch"**
3. **Select a directory path** to monitor

### How It Works

- APIprox scans the watched directory for paired request/response XML files automatically
- Matched pairs appear in the panel
- Click a pair to view the XML content side by side in a split editor

This is particularly useful for SOAP development workflows where test tools write request and response XML to disk.

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
- **Raw**: Complete HTTP messages as JSON

## Settings

### Certificate Management
- **Generate Certificate**: Create new self-signed CA certificate
- **Install to System Trust Store**: Install certificate to system trust store (requires admin)
- **Export Certificate**: Download certificate file

### HTTPS Configuration
- **Enable HTTPS Interception**: Toggle HTTPS traffic decryption on/off
- **Auto-trust generated certificates**: Automatically add new CA certificates to system trust store

### Default Port
- Set the default proxy port used for new sessions (default: 8888)

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

### Performance Testing
1. Create mock rules with various delays
2. Test how your app handles slow responses
3. Simulate timeouts and errors
4. Measure impact on user experience

### Intercepting and Modifying Live Traffic
1. Start APIprox in Proxy mode
2. Add a Breakpoint rule targeting the URL of interest
3. Trigger a request in your app
4. Edit the paused request/response and click Edit & Continue

## Troubleshooting

### Certificate Not Trusted
**Symptom**: HTTPS traffic shows certificate errors

**Solutions:**
- Re-generate certificate in Settings
- Manually install certificate (Settings → Export Certificate)
- Check system trust store
- Restart browser/application after installing

### No Traffic Appearing
**Symptom**: Traffic viewer is empty

**Solutions:**
- Verify proxy settings in your application point to `localhost:<port>`
- Check server is running (green status indicator)
- Ensure port is not blocked by firewall
- Try HTTP endpoint first (no certificate needed)

### Mock Rules Not Matching
**Symptom**: Requests hit real server instead of mock

**Solutions:**
- Check rule is enabled (checkbox on the rule card)
- Verify condition patterns match the actual request (check Traffic tab for real URLs)
- Check rule order – first matching rule wins
- Test each condition individually before combining them
- For query-param conditions, make sure the param name field is filled in

### Proxy Connection Refused
**Symptom**: "Connection refused" errors

**Solutions:**
- Verify server is started
- Check port number matches proxy configuration
- Ensure port is not already in use
- Try different port number

### Breakpoint Not Triggering
**Symptom**: Traffic passes through without pausing

**Solutions:**
- Ensure the proxy server is running
- Verify the breakpoint rule is enabled
- Check condition patterns match the target request

## Best Practices

### Replace Rules
- Use specific XPath expressions to avoid unintended replacements
- Test rules with representative traffic first
- Document complex regex patterns with descriptive names
- Disable rules when not needed

### Mock Server
- Keep mock responses realistic
- Set the correct Content-Type for your response (XML, JSON, etc.)
- Include appropriate response headers when needed
- Use delays to simulate real network conditions
- Version your mock data
- Organize rules by feature/module

### Breakpoints
- Clear breakpoint rules when done — they apply to all matching traffic
- Use specific URL conditions to avoid pausing unintended requests
- Remember paused traffic auto-expires; don't leave breakpoints active unattended

### Certificate Management
- Export certificate before regenerating
- Document installation process for team
- Remove certificate from system trust store when no longer needed
- Test with multiple browsers/applications

### Traffic Recording
- Filter traffic to reduce noise
- Use replace rules to sanitize logs before sharing

## Security Considerations

### Certificate Security
- The CA certificate generated by APIprox is **self-signed**
- Installing it to system trust store allows **any application** to intercept HTTPS
- Only use on development/test machines
- Never install on production systems
- Remove certificate from trust store when not needed

### Data Privacy
- APIprox sees all traffic passing through it (including passwords, tokens, etc.)
- Use replace rules to mask sensitive data in logs
- Clear traffic logs after debugging
- Don't share raw traffic logs

### Network Security
- APIprox runs a local server (localhost only by default)
- Ensure firewall rules are appropriate
- Don't expose proxy port to network

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
A: Yes, rules are stored in configuration files and persist between sessions.

**Q: Does APIprox support WebSocket?**
A: Not currently. APIprox focuses on HTTP/HTTPS REST and SOAP traffic.

**Q: Can I automate rule creation?**
A: Rules are stored in JSON format in `~/.apiprox/` and can be created/modified programmatically.

## Configuration Files

All stored in `~/.apiprox/`:

- **mock-rules.json** — Mock rule definitions
- **replace-rules.json** — Replace rule definitions
- **breakpoint-rules.json** — Breakpoint rule configurations
- **file-watches.json** — File watcher configurations
- **ca.crt** / **ca.key** — CA certificate and private key

## Support & Resources

- **GitHub Issues**: Report bugs and request features
- **APInox Integration**: Use together for complete API testing workflow

## License

[Your License Here]

---

**Version**: 0.1.0  
**Last Updated**: 2026-03-26