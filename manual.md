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

## HTTPS Interception Setup

APIprox uses TLS MITM (Man-in-the-Middle) to decrypt HTTPS traffic. It generates signed certificates on-the-fly for each domain using a local CA that you install once.

### Step-by-step

1. **Generate the CA Certificate**
   - Go to **Settings → Certificate Management**
   - Click **"Generate New Certificate"**

2. **Trust the Certificate** (requires admin/sudo)
   - Click **"Trust Certificate"**
   - Enter your system password when prompted
   - Platform-specific:
     - **macOS**: Added to System Keychain via `security` command
     - **Windows**: Added to Trusted Root store via `certutil`
     - **Linux**: Copied to `/usr/local/share/ca-certificates/` and `update-ca-certificates` is run

3. **Firefox (always manual)**
   - Firefox uses its own certificate store
   - Settings → Export Certificate → save `ca.cer`
   - Firefox → Settings → Privacy & Security → View Certificates → Authorities → Import
   - Check "Trust this CA to identify websites"

4. **Verify**
   - Certificate status should show **✓ Trusted**
   - Start the proxy and browse — HTTPS traffic will appear in the Traffic tab

### How it works

When a client connects via CONNECT (HTTPS tunnel), APIprox:
1. Acknowledges the tunnel
2. Performs a TLS handshake with the client, presenting a certificate signed by the local CA for that domain
3. Connects upstream using a real TLS connection
4. Decrypts and re-encrypts traffic, applying replace rules and mock matching

## Replace Rules

Modify traffic in real-time using XPath and text replacement.

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

## Mock Rules

Return predefined responses for matching requests.

**Example: Mock User API**
```
Condition: URL contains /api/user
Response Status: 200
Response Body:
{
  "id": 123,
  "name": "Test User"
}
```

**Example: Mock SOAP Service**
```
Condition: XPath //GetCustomer
Response Status: 200
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
| Mock not matching | Check rule is enabled and URL matches |
| Connection refused | Verify server is running and port is correct |

## Configuration Files

- **Mock Rules**: `~/.apiprox/mock-rules.json`
- **Replace Rules**: `~/.apiprox/replace-rules.json`
- **Breakpoint Rules**: `~/.apiprox/breakpoint-rules.json`
- **CA Certificate**: `~/.apiprox/ca.cer`
- **CA Private Key**: `~/.apiprox/ca.key`

## Tips

✓ Use specific XPath to avoid unintended changes  
✓ Test replace rules with sample traffic first  
✓ Keep mock responses realistic  
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
