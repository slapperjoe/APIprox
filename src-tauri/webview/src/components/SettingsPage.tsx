import React, { useState } from 'react';
import { CertificateManager } from './CertificateManager';
import { tokens } from '../styles/tokens';

export function SettingsPage() {
  const [httpsEnabled, setHttpsEnabled] = useState(true);
  const [trustCertificate, setTrustCertificate] = useState(false);
  const [defaultPort, setDefaultPort] = useState(8888);

  return (
    <div style={{ padding: '20px', maxWidth: '800px' }}>
      <h2 style={{ margin: '0 0 24px 0', fontSize: '18px', fontWeight: 500 }}>
        Settings
      </h2>

      {/* Certificate Management Section */}
      <CertificateManager />

      {/* HTTPS Settings */}
      <div style={{
        background: tokens.surface.panel,
        borderRadius: tokens.radius.lg,
        padding: '20px',
        marginBottom: '20px'
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 500 }}>
          HTTPS Configuration
        </h3>
        
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={httpsEnabled}
              onChange={(e) => setHttpsEnabled(e.target.checked)}
              style={{ width: '18px', height: '18px' }}
            />
            <div>
              <div style={{ fontSize: '13px' }}>Enable HTTPS Interception</div>
              <div style={{ fontSize: '12px', color: tokens.text.muted, marginTop: '4px' }}>
                Allows proxying and modifying HTTPS traffic
              </div>
            </div>
          </label>
        </div>

        {httpsEnabled && (
          <div style={{ marginBottom: '16px', paddingLeft: '30px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={trustCertificate}
                onChange={(e) => setTrustCertificate(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              <div>
                <div style={{ fontSize: '13px' }}>Auto-trust generated certificates</div>
                <div style={{ fontSize: '12px', color: tokens.text.muted, marginTop: '4px' }}>
                  Automatically add APIprox CA certificate to system trust store
                </div>
              </div>
            </label>
          </div>
        )}

        <div style={{
          padding: '12px',
          background: tokens.surface.base,
          borderRadius: tokens.radius.md,
          fontSize: '12px',
          color: tokens.text.muted
        }}>
          <strong style={{ color: tokens.text.secondary }}>Note:</strong> HTTPS interception requires installing
          a root certificate. This certificate will be automatically generated and can be exported
          for manual installation if needed.
        </div>
      </div>

      {/* Port Settings */}
      <div style={{
        background: tokens.surface.panel,
        borderRadius: tokens.radius.lg,
        padding: '20px',
        marginBottom: '20px'
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 500 }}>
          Default Port
        </h3>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            type="number"
            value={defaultPort}
            onChange={(e) => setDefaultPort(parseInt(e.target.value))}
            style={{
              width: '100px',
              padding: '8px 12px',
              background: tokens.surface.input,
              border: `1px solid ${tokens.border.subtle}`,
              borderRadius: tokens.radius.md,
              color: tokens.text.secondary,
              fontSize: tokens.fontSize.base
            }}
          />
          <span style={{ fontSize: tokens.fontSize.base, color: tokens.text.muted }}>
            Default proxy port for new sessions
          </span>
        </div>
      </div>

      {/* About */}
      <div style={{
        background: tokens.surface.panel,
        borderRadius: tokens.radius.lg,
        padding: '20px'
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 500 }}>
          About APIprox
        </h3>
        
        <div style={{ fontSize: tokens.fontSize.base, color: tokens.text.secondary, lineHeight: '1.6' }}>
          <p style={{ margin: '0 0 12px 0' }}>
            <strong>Version:</strong> 0.1.0
          </p>
          <p style={{ margin: '0 0 12px 0' }}>
            <strong>Platform:</strong> Tauri Desktop Application
          </p>
          <p style={{ margin: '0' }}>
            HTTP/HTTPS Proxy and Mock Server for API Testing and Debugging
          </p>
        </div>
      </div>
    </div>
  );
}
