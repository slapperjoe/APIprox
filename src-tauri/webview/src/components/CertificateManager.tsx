import React, { useState, useEffect } from 'react';
import { bridge } from '../utils/bridge';

interface CertInfo {
  exists: boolean;
  certPath: string;
  keyPath: string;
  subject?: string;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  fingerprint?: string;
}

interface TrustResult {
  success: boolean;
  message: string;
  firefoxNote: string;
  manualSteps: string[];
}

export function CertificateManager() {
  const [certInfo, setCertInfo] = useState<CertInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [trustResult, setTrustResult] = useState<TrustResult | null>(null);
  const [genMessage, setGenMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadCertInfo();
  }, []);

  async function loadCertInfo() {
    try {
      const info = await bridge.getCertificateInfo() as CertInfo;
      setCertInfo(info);
    } catch (err: any) {
      console.error('Failed to load certificate info:', err);
      setCertInfo({ exists: false, certPath: '', keyPath: '' });
    }
  }

  async function handleGenerate() {
    setLoading(true);
    setGenMessage(null);
    setTrustResult(null);
    try {
      await bridge.generateCertificate();
      setGenMessage({ type: 'success', text: 'Certificate generated successfully.' });
      await loadCertInfo();
    } catch (err: any) {
      setGenMessage({ type: 'error', text: String(err) });
    } finally {
      setLoading(false);
    }
  }

  async function handleTrust() {
    setLoading(true);
    setTrustResult(null);
    try {
      const result = await bridge.trustCertificate() as TrustResult;
      setTrustResult(result);
    } catch (err: any) {
      setTrustResult({
        success: false,
        message: String(err),
        firefoxNote: '',
        manualSteps: [],
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    const path = certInfo?.certPath ?? '';
    setGenMessage({ type: 'success', text: `Certificate file: ${path}` });
  }

  function formatDate(dateStr?: string): string {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }

  function isExpired(dateStr?: string): boolean {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  }

  const expired = isExpired(certInfo?.validTo);

  return (
    <div style={{ padding: '20px', maxWidth: '800px' }}>
      <h2 style={{ margin: '0 0 24px 0', fontSize: '18px', fontWeight: 500 }}>
        Certificate Management
      </h2>

      {/* Status ------------------------------------------------------------ */}
      <div style={{ background: '#252526', borderRadius: '6px', padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', color: '#858585', letterSpacing: '0.05em' }}>
          CA Certificate Status
        </h3>

        {certInfo?.exists ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                ['Subject', certInfo.subject],
                ['Issuer', certInfo.issuer],
                ['Valid From', formatDate(certInfo.validFrom)],
                ['Valid To', formatDate(certInfo.validTo)],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#858585', flexShrink: 0, marginRight: '16px' }}>{label}</span>
                  <span style={{ color: label === 'Valid To' && expired ? '#bf6f6f' : '#cccccc', textAlign: 'right' }}>
                    {value ?? 'N/A'}
                    {label === 'Valid To' && expired && ' ⚠ EXPIRED'}
                  </span>
                </div>
              ))}

              {certInfo.fingerprint && (
                <div style={{ fontSize: '13px', marginTop: '4px' }}>
                  <div style={{ color: '#858585', marginBottom: '4px' }}>SHA-256 Fingerprint</div>
                  <div style={{
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    color: '#cccccc',
                    wordBreak: 'break-all',
                    background: '#1e1e1e',
                    padding: '8px',
                    borderRadius: '4px',
                  }}>
                    {certInfo.fingerprint}
                  </div>
                </div>
              )}
            </div>

            <div style={{
              marginTop: '16px',
              padding: '10px 12px',
              background: expired ? '#3d1a1a' : '#1a3d1a',
              border: `1px solid ${expired ? '#6a2d2d' : '#2d6a2d'}`,
              borderRadius: '4px',
              fontSize: '12px',
              color: expired ? '#bf6f6f' : '#6fbf6f',
            }}>
              {expired
                ? '⚠ Certificate has expired. Regenerate it.'
                : '✓ Certificate is valid'}
            </div>
          </>
        ) : (
          <div style={{
            padding: '16px',
            background: '#3d3d1a',
            border: '1px solid #6a6a2d',
            borderRadius: '4px',
            fontSize: '13px',
            color: '#d4d4a0',
            textAlign: 'center',
          }}>
            No certificate found. Generate one to enable HTTPS inspection.
          </div>
        )}
      </div>

      {/* Actions ----------------------------------------------------------- */}
      <div style={{ background: '#252526', borderRadius: '6px', padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', color: '#858585', letterSpacing: '0.05em' }}>
          Actions
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button onClick={handleGenerate} disabled={loading} style={btnStyle('#0e639c', loading)}>
            {certInfo?.exists ? 'Regenerate Certificate' : 'Generate Certificate'}
          </button>

          {certInfo?.exists && (
            <>
              <button onClick={handleTrust} disabled={loading} style={btnStyle('#107c10', loading)}>
                Install to System Trust Store
              </button>
              <button onClick={handleExport} disabled={loading} style={btnStyle('#5c2d91', loading)}>
                Show Certificate Path
              </button>
            </>
          )}
        </div>

        {genMessage && (
          <div style={{
            marginTop: '12px',
            padding: '10px 12px',
            background: genMessage.type === 'success' ? '#1a3d1a' : '#3d1a1a',
            border: `1px solid ${genMessage.type === 'success' ? '#2d6a2d' : '#6a2d2d'}`,
            borderRadius: '4px',
            fontSize: '13px',
            color: genMessage.type === 'success' ? '#6fbf6f' : '#bf6f6f',
          }}>
            {genMessage.type === 'success' ? '✓ ' : '✗ '}{genMessage.text}
          </div>
        )}
      </div>

      {/* Trust result ------------------------------------------------------- */}
      {trustResult && (
        <div style={{ background: '#252526', borderRadius: '6px', padding: '20px', marginBottom: '16px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', color: '#858585', letterSpacing: '0.05em' }}>
            Trust Installation Result
          </h3>

          <div style={{
            padding: '10px 12px',
            background: trustResult.success ? '#1a3d1a' : '#3d1a1a',
            border: `1px solid ${trustResult.success ? '#2d6a2d' : '#6a2d2d'}`,
            borderRadius: '4px',
            fontSize: '13px',
            color: trustResult.success ? '#6fbf6f' : '#bf6f6f',
            marginBottom: '12px',
          }}>
            {trustResult.success ? '✓ ' : '✗ '}{trustResult.message}
          </div>

          {/* Firefox note — always shown */}
          {trustResult.firefoxNote && (
            <div style={{
              padding: '10px 12px',
              background: '#2d2d1a',
              border: '1px solid #6a6a2d',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#d4d4a0',
              marginBottom: '12px',
            }}>
              <strong style={{ color: '#e8d44d' }}>Firefox: </strong>{trustResult.firefoxNote}
            </div>
          )}

          {/* Manual steps on failure */}
          {trustResult.manualSteps.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '12px', color: '#858585', marginBottom: '8px', fontWeight: 600 }}>
                Manual installation steps:
              </div>
              <div style={{
                background: '#1e1e1e',
                borderRadius: '4px',
                padding: '12px',
                fontSize: '12px',
                color: '#cccccc',
                fontFamily: 'monospace',
                lineHeight: '1.8',
                whiteSpace: 'pre-wrap',
              }}>
                {trustResult.manualSteps.join('\n')}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info box ---------------------------------------------------------- */}
      <div style={{
        background: '#1e1e1e',
        borderRadius: '6px',
        padding: '16px',
        fontSize: '12px',
        color: '#858585',
        lineHeight: '1.7',
      }}>
        <strong style={{ color: '#cccccc' }}>How HTTPS inspection works:</strong>
        <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
          <li>Generate the CA certificate (done once per installation)</li>
          <li>Install it to your system trust store so your browser trusts it</li>
          <li>Configure your HTTP client to use the proxy</li>
          <li>APIprox will sign per-domain certificates on the fly using this CA</li>
        </ol>
        <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #3e3e42' }}>
          <strong style={{ color: '#e8d44d' }}>Firefox note:</strong>{' '}
          Firefox maintains its own certificate store. You must import the CA manually
          via Preferences → Privacy & Security → Certificates → View Certificates → Authorities → Import.
        </div>
        <div style={{ marginTop: '8px' }}>
          Certificate files are stored in{' '}
          <code style={{ background: '#252526', padding: '2px 6px', borderRadius: '3px', color: '#d4d4d4' }}>
            ~/.apiprox/
          </code>
        </div>
      </div>
    </div>
  );
}

function btnStyle(bg: string, disabled: boolean): React.CSSProperties {
  return {
    padding: '9px 18px',
    background: bg,
    border: 'none',
    borderRadius: '4px',
    color: 'white',
    fontSize: '13px',
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    textAlign: 'left',
  };
}
