import React, { useState, useEffect } from 'react';
import { bridge } from '../utils/bridge';

interface CertInfo {
  exists: boolean;
  subject?: string;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  serialNumber?: string;
  fingerprint?: string;
  error?: string;
}

export function CertificateManager() {
  const [certInfo, setCertInfo] = useState<CertInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadCertInfo();
  }, []);

  async function loadCertInfo() {
    try {
      const info = await bridge.getCertificateInfo();
      setCertInfo(info);
    } catch (err: any) {
      console.error('Failed to load certificate info:', err);
      setCertInfo({ exists: false, error: err.message });
    }
  }

  async function handleGenerate() {
    setLoading(true);
    setMessage(null);
    try {
      const result = await bridge.generateCertificate();
      if (result.success) {
        setMessage({ type: 'success', text: 'Certificate generated successfully!' });
        await loadCertInfo();
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to generate certificate' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleTrust() {
    setLoading(true);
    setMessage(null);
    try {
      const result = await bridge.trustCertificate();
      if (result.success) {
        setMessage({ type: 'success', text: result.message || 'Certificate trusted successfully!' });
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to trust certificate' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    try {
      const url = await bridge.getExportCertificateUrl();
      window.open(url, '_blank');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  function formatDate(dateStr?: string): string {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString();
  }

  function isExpired(dateStr?: string): boolean {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px' }}>
      <h2 style={{ margin: '0 0 24px 0', fontSize: '18px', fontWeight: 500 }}>
        Certificate Management
      </h2>

      {/* Certificate Status */}
      <div style={{
        background: '#252526',
        borderRadius: '6px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 500 }}>
          Certificate Status
        </h3>

        {certInfo?.exists ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: '#858585' }}>Subject:</span>
              <span style={{ color: '#cccccc' }}>{certInfo.subject}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: '#858585' }}>Issuer:</span>
              <span style={{ color: '#cccccc' }}>{certInfo.issuer}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: '#858585' }}>Valid From:</span>
              <span style={{ color: '#cccccc' }}>{formatDate(certInfo.validFrom)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: '#858585' }}>Valid To:</span>
              <span style={{ 
                color: isExpired(certInfo.validTo) ? '#bf6f6f' : '#6fbf6f' 
              }}>
                {formatDate(certInfo.validTo)}
                {isExpired(certInfo.validTo) && ' (EXPIRED)'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: '#858585' }}>Serial Number:</span>
              <span style={{ color: '#cccccc', fontFamily: 'monospace', fontSize: '11px' }}>
                {certInfo.serialNumber}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: '#858585' }}>Fingerprint (SHA-256):</span>
              <span style={{ color: '#cccccc', fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all' }}>
                {certInfo.fingerprint}
              </span>
            </div>

            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: isExpired(certInfo.validTo) ? '#3d1a1a' : '#1a3d1a',
              border: `1px solid ${isExpired(certInfo.validTo) ? '#6a2d2d' : '#2d6a2d'}`,
              borderRadius: '4px',
              fontSize: '12px',
              color: isExpired(certInfo.validTo) ? '#bf6f6f' : '#6fbf6f'
            }}>
              {isExpired(certInfo.validTo) 
                ? '⚠️ Certificate has expired. Generate a new one.'
                : '✓ Certificate is valid'
              }
            </div>
          </div>
        ) : (
          <div style={{
            padding: '16px',
            background: '#3d3d1a',
            border: '1px solid #6a6a2d',
            borderRadius: '4px',
            fontSize: '13px',
            color: '#d4d4a0',
            textAlign: 'center'
          }}>
            ⚠️ No certificate found. Generate one to enable HTTPS interception.
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{
        background: '#252526',
        borderRadius: '6px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 500 }}>
          Actions
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={handleGenerate}
            disabled={loading}
            style={{
              padding: '10px 20px',
              background: '#0e639c',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              fontSize: '13px',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            {certInfo?.exists ? 'Regenerate Certificate' : 'Generate Certificate'}
          </button>

          {certInfo?.exists && (
            <>
              <button
                onClick={handleTrust}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  background: '#107c10',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1
                }}
              >
                Trust Certificate (Install to System)
              </button>

              <button
                onClick={handleExport}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  background: '#5c2d91',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1
                }}
              >
                Export Certificate (.crt)
              </button>
            </>
          )}
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div style={{
          padding: '12px 16px',
          background: message.type === 'success' ? '#1a3d1a' : '#3d1a1a',
          border: `1px solid ${message.type === 'success' ? '#2d6a2d' : '#6a2d2d'}`,
          borderRadius: '4px',
          fontSize: '13px',
          color: message.type === 'success' ? '#6fbf6f' : '#bf6f6f'
        }}>
          {message.type === 'success' ? '✓' : '❌'} {message.text}
        </div>
      )}

      {/* Info */}
      <div style={{
        background: '#1e1e1e',
        borderRadius: '6px',
        padding: '16px',
        fontSize: '12px',
        color: '#858585',
        lineHeight: '1.6'
      }}>
        <strong style={{ color: '#cccccc' }}>How to use:</strong>
        <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
          <li>Generate a certificate if you don't have one</li>
          <li>Click "Trust Certificate" to install it to your system (requires admin/sudo)</li>
          <li>Configure your browser/application to trust the certificate</li>
          <li>Start the proxy with HTTPS interception enabled</li>
        </ol>
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #3e3e42' }}>
          <strong style={{ color: '#cccccc' }}>Note:</strong> The certificate is stored in <code style={{ 
            background: '#252526',
            padding: '2px 6px',
            borderRadius: '3px',
            color: '#d4d4d4'
          }}>~/.apiprox/</code>
        </div>
      </div>
    </div>
  );
}
