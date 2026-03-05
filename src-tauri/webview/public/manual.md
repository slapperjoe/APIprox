# APIprox Quick Reference

## Starting the Server

1. Choose mode: **Proxy**, **Mock**, or **Both**
2. Set **port** (default: 8888)
3. For Proxy mode: Set **Target URL**
4. Click **Start Server**

## Modes

| Mode | Description |
|------|-------------|
| **Proxy** | Forward traffic to target URL while recording |
| **Mock** | Return predefined responses (no forwarding) |
| **Both** | Check mocks first, forward if no match |

## HTTPS Setup

1. Settings → Certificate Management
2. Click "Generate New Certificate"
3. Click "Trust Certificate" (admin required)
4. Verify status shows "✓ Trusted"

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

### Template Helpers

Use these inside the response body for dynamic values:

| Helper | Output |
|--------|--------|
| `{{now}}` | ISO-8601 timestamp |
| `{{now 'timestamp'}}` | Unix ms |
| `{{now 'date'}}` / `{{now 'time'}}` | Locale date / time |
| `{{uuid}}` | Random UUID v4 |
| `{{randomInt 1 100}}` | Random integer 1–100 |
| `{{randomElement a b c}}` | Random pick |
| `{{requestHeader 'name'}}` | Incoming header value |
| `{{requestBody}}` | Raw request body |

**Example:**
```json
{
  "id": "{{uuid}}",
  "at": "{{now}}",
  "score": {{randomInt 1 100}}
}
```

**Example: Mock User API**
```
Condition: URL contains /api/user, Method: GET
Response Status: 200
Content-Type: JSON
Response Body:
{
  "id": "{{uuid}}",
  "name": "Test User"
}
```

**Example: Mock SOAP Service**
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

## Traffic Viewer

- View all intercepted requests/responses
- Click row to see details
- Search/filter traffic
- Clear log with "Clear" button

## Common Use Cases

### Debug API Calls
1. Start in Proxy mode
2. Set target to your API
3. Configure app to use proxy (localhost:8888)
4. View traffic in Traffic tab

### Mock External APIs
1. Start in Mock mode
2. Create mock rules for endpoints
3. Point app to mock server
4. Develop offline

### Test Error Scenarios
1. Create mock rule with error response
2. Add delay to simulate timeout
3. Test app error handling

## Keyboard Shortcuts

- `Ctrl+R` - Toggle recording
- `Ctrl+K` - Clear traffic
- `Ctrl+,` - Settings
- `Escape` - Close modal

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No traffic appearing | Check proxy settings in your app |
| Certificate errors | Regenerate and trust certificate |
| Mock not matching | Check rule is enabled, condition patterns, and rule order |
| Connection refused | Verify server is running and port is correct |

## Configuration Files

- **Mock Rules**: `~/.apiprox/mock-rules.jsonc`
- **Replace Rules**: `~/.apiprox/config.jsonc` → `replaceRules`
- **Certificate**: `~/.apiprox/certs/apiprox-ca.crt`
- **Settings**: `~/.apiprox/config.jsonc`

## Tips

✓ Use specific XPath to avoid unintended changes  
✓ Test replace rules with sample traffic first  
✓ Use template helpers for realistic dynamic mock responses  
✓ Clear traffic logs regularly  
✓ Export certificate before regenerating  
✓ Disable rules when not needed  

## Security Notes

⚠️ CA certificate allows HTTPS interception  
⚠️ Only use on dev/test machines  
⚠️ APIprox sees all traffic (including secrets)  
⚠️ Use replace rules to mask sensitive data  
⚠️ Remove certificate when done testing  

---

For complete documentation, see **README.md**
