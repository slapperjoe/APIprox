import React, { useState } from 'react';
import { CertificateManager } from './CertificateManager';

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
        background: '#252526',
        borderRadius: '6px',
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
              <div style={{ fontSize: '12px', color: '#858585', marginTop: '4px' }}>
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
                <div style={{ fontSize: '12px', color: '#858585', marginTop: '4px' }}>
                  Automatically add APIprox CA certificate to system trust store
                </div>
              </div>
            </label>
          </div>
        )}

        <div style={{
          padding: '12px',
          background: '#1e1e1e',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#858585'
        }}>
          <strong style={{ color: '#cccccc' }}>Note:</strong> HTTPS interception requires installing
          a root certificate. This certificate will be automatically generated and can be exported
          for manual installation if needed.
        </div>
      </div>

      {/* Port Settings */}
      <div style={{
        background: '#252526',
        borderRadius: '6px',
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
              background: '#3c3c3c',
              border: '1px solid #555',
              borderRadius: '4px',
              color: '#cccccc',
              fontSize: '13px'
            }}
          />
          <span style={{ fontSize: '13px', color: '#858585' }}>
            Default proxy port for new sessions
          </span>
        </div>
      </div>

      {/* About */}
      <div style={{
        background: '#252526',
        borderRadius: '6px',
        padding: '20px'
      }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 500 }}>
          About APIprox
        </h3>
        
        <div style={{ fontSize: '13px', color: '#cccccc', lineHeight: '1.6' }}>
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
