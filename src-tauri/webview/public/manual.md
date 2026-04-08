# APIprox Quick Reference

## Starting the Server

1. Choose mode: **Proxy**, **Mock**, or **Both**
2. Set **port** (default: 8888)
3. For Proxy mode: Set **Target URL**
4. Click **Start Proxy**

## Modes

| Mode | Description |
|------|-------------|
| **Proxy** | Forward traffic to target URL while recording |
| **Mock** | Return predefined responses (no forwarding) |
| **Both** | Check mocks first, forward if no match |

## HTTPS Setup

1. Settings → Certificate Management
2. Click **Generate Certificate**
3. Click **Install to System Trust Store** (admin required)
4. Status shows "✓ Certificate is valid"

## Replace Rules

Modify traffic in real-time using XPath and text replacement. Found under the **Replace Rules** tab.

**Example: Mask SSN**
```
XPath: //Customer/SSN
Find: \d{3}-\d{2}-\d{4} (regex)
Replace: XXX-XX-XXXX
Target: Response
```

**Example: Change Environment**
```
XPath: //Environment
Find: development
Replace: production
Target: Request
```

## Mock Server

Return predefined responses for matching requests. Found under the **Mock Server** tab.

### Match Condition Types

| Type | What it matches |
|------|----------------|
| URL Path | Request URL contains/matches pattern |
| HTTP Method | HTTP verb (GET, POST, etc.) |
| Header | Named header value |
| Query Param | Named URL query parameter |
| XPath | XML element present in body |
| Body Contains | Raw body contains text |
| SOAP Action | SOAPAction header value |

All conditions in a rule must match (AND logic). Enable **Regex** on any condition.

### Response Options

- **Status Code** – HTTP status to return
- **Content-Type** – Preset dropdown (XML/JSON/text/HTML) or custom value
- **Response Headers** – Add custom key-value response headers
- **Response Body** – With syntax highlighting matching the content-type
- **Delay (ms)** – Simulate network latency
- **Passthrough** – Forward to target URL if no rule matches (Both mode)

### Example: Mock User API

```
Condition: URL contains /api/user, Method: GET
Response Status: 200
Content-Type: JSON
Response Body:
{
  "id": "123",
  "name": "Test User"
}
```

### Example: Mock SOAP Service

```
Condition: XPath //GetCustomer
Response Status: 200
Content-Type: XML
Response Body:
<soap:Envelope>
  <soap:Body>
    <GetCustomerResponse>
      <Name>John Doe</Name>
    </GetCustomerResponse>
  </soap:Body>
</soap:Envelope>
```

## Breakpoints

Pause and inspect live traffic before it is forwarded or returned. Found under the **Breakpoints** tab.

### How It Works

1. Create a breakpoint rule with a name and URL pattern
2. Choose when to pause: **Request**, **Response**, or **Both**
3. When traffic matches, it pauses and appears in the queue
4. Inspect and optionally edit headers/body
5. Click **Edit & Continue** to forward with modifications, **Continue** to pass through unchanged, or **Drop** to discard

### Breakpoint Timeout

Paused traffic auto-resolves after a timeout to prevent the proxy blocking indefinitely.

## File Watcher

Watch directories for XML request/response file pairs and view them side by side. Found under the **File Watcher** tab.

- Add a watch by specifying a folder path
- APIprox scans for paired request/response files automatically
- Click a pair to view the XML content in a split editor
- Useful for reviewing recorded SOAP traffic stored as files

## Traffic Viewer

- View all intercepted requests and responses
- Click a row to see headers and body in the detail panel below
- Request/Response shown with syntax highlighting (XML, JSON)
- Raw JSON view available via the **raw** tab

## Common Use Cases

### Debug API Calls
1. Start in Proxy mode
2. Set target to your API
3. Configure app to use proxy (`localhost:8888`)
4. View traffic in the Traffic tab

### Mock External APIs
1. Start in Mock mode
2. Create mock rules for endpoints
3. Point app to mock server
4. Develop offline

### Test Error Scenarios
1. Create mock rule with error status code
2. Add delay to simulate timeout
3. Test app error handling

### Intercept and Modify Live Traffic
1. Start in Proxy mode
2. Add a Breakpoint rule on the target URL
3. Trigger a request in your app
4. Edit the paused request/response and continue

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No traffic appearing | Check proxy settings in your app point to `localhost:<port>` |
| Certificate errors | Regenerate and reinstall certificate (Settings tab) |
| Mock not matching | Check rule is enabled, condition patterns, and rule order |
| Connection refused | Verify server is running and port is correct |
| Breakpoint not triggering | Ensure proxy is running and breakpoint rule is enabled |

## APInox Integration

APIprox and APInox share the `~/.apinox/` directory and integrate in two ways:

### Auto-sync proxy config

When **Settings → Auto-update APInox proxy config** is enabled (default: on), APIprox automatically sets `network.proxy` in `~/.apinox/config.jsonc` to `http://127.0.0.1:<port>` whenever the proxy starts, and clears it when the proxy stops. APInox picks this up on next request, routing all APInox traffic through the running APIprox proxy.

Toggle this in **Settings → APInox Integration**.

### Captured traffic project

Right-click any traffic entry and choose **Save to APInox** to push it into the `APIprox Captures` project inside APInox's project library (`~/.apinox/projects/APIprox Captures/`). APInox auto-loads this project on startup — no file picker required.

## Configuration Files

All stored in `~/.apinox/` (shared with APInox):

- **mock-rules.json** — Mock rule definitions
- **replace-rules.json** — Replace rule definitions
- **breakpoint-rules.json** — Breakpoint rule definitions
- **file-watches.json** — File watcher configurations
- **ca.crt** / **ca.key** — CA certificate and private key
- **config.jsonc** — APInox app settings (proxy config written here by APIprox)

## Tips

✓ Use specific XPath to avoid unintended changes  
✓ Test replace rules with sample traffic first  
✓ Clear breakpoints when done — they apply to all traffic  
✓ Export certificate before regenerating  
✓ Disable rules when not needed  
✓ Use Both mode to mock only specific endpoints  
✓ Keep **Auto-update APInox proxy config** on to route APInox traffic through APIprox without any manual setup  

## Security Notes

⚠️ CA certificate allows HTTPS interception  
⚠️ Only use on dev/test machines  
⚠️ APIprox sees all traffic (including secrets)  
⚠️ Use replace rules to mask sensitive data  
⚠️ Remove certificate from trust store when done testing  

---

For full documentation, see **Full Documentation** tab above.