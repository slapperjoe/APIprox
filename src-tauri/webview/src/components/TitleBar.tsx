import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { platform } from '@tauri-apps/plugin-os';

const TitleBarContainer = styled.div<{ $isMac: boolean }>`
  display: flex;
  align-items: center;
  height: 32px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  -webkit-app-region: drag;
  user-select: none;
  position: relative;
`;

const TitleBarContent = styled.div<{ $isMac: boolean }>`
  display: flex;
  align-items: center;
  justify-content: ${props => props.$isMac ? 'center' : 'space-between'};
  width: 100%;
  padding: 0 ${props => props.$isMac ? '80px' : '12px'};
`;

const Title = styled.div`
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
`;

const StatusIndicator = styled.div<{ $isMac: boolean }>`
  position: absolute;
  right: ${props => props.$isMac ? '12px' : '150px'};
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-secondary);
  -webkit-app-region: no-drag;
  
  .status-dot {
    font-size: 8px;
  }
  
  .status-text {
    color: var(--text-primary);
  }
  
  .port {
    color: var(--text-secondary);
  }
`;

const WindowControls = styled.div<{ $isMac: boolean }>`
  display: flex;
  align-items: center;
  gap: ${props => props.$isMac ? '8px' : '0'};
  position: ${props => props.$isMac ? 'absolute' : 'relative'};
  left: ${props => props.$isMac ? '12px' : 'auto'};
  -webkit-app-region: no-drag;
`;

const MacButton = styled.button<{ $color: string }>`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: none;
  background: ${props => props.$color};
  cursor: pointer;
  transition: filter 0.2s;

  &:hover {
    filter: brightness(0.85);
  }

  &:active {
    filter: brightness(0.7);
  }
`;

const WindowsButton = styled.button`
  width: 46px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;

  &:hover {
    background: var(--hover-bg);
  }

  &:active {
    background: var(--active-bg);
  }

  svg {
    width: 10px;
    height: 10px;
  }
`;

const CloseButton = styled(WindowsButton)`
  &:hover {
    background: #e81123;
    color: white;
  }
`;

interface TitleBarProps {
  title?: string;
  proxyRunning?: boolean;
  proxyPort?: number;
  proxyMode?: string;
}

export const TitleBar: React.FC<TitleBarProps> = ({ 
  title = 'APIprox',
  proxyRunning,
  proxyPort,
  proxyMode,
}) => {
  const [isMac, setIsMac] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const getPlatform = async () => {
      const p = await platform();
      console.log('[TitleBar] Platform detected:', p);
      setIsMac(p === 'macos');
      console.log('[TitleBar] isMac set to:', p === 'macos');
    };
    getPlatform();
    
    const checkMaximized = async () => {
      const appWindow = getCurrentWindow();
      const maximized = await appWindow.isMaximized();
      setIsMaximized(maximized);
    };
    
    checkMaximized();
  }, []);

  const handleMinimize = async () => {
    const appWindow = getCurrentWindow();
    await appWindow.minimize();
  };

  const handleMaximize = async () => {
    const appWindow = getCurrentWindow();
    await appWindow.toggleMaximize();
    setIsMaximized(!isMaximized);
  };

  const handleClose = async () => {
    const appWindow = getCurrentWindow();
    await appWindow.close();
  };

  if (isMac) {
    console.log('[TitleBar] Rendering Mac controls');
    return (
      <TitleBarContainer $isMac={true}>
        <WindowControls $isMac={true}>
          <MacButton $color="#ff5f57" onClick={handleClose} />
          <MacButton $color="#febc2e" onClick={handleMinimize} />
          <MacButton $color="#28c840" onClick={handleMaximize} />
        </WindowControls>
        <TitleBarContent $isMac={true}>
          <Title>{title}</Title>
        </TitleBarContent>
        <StatusIndicator $isMac={true}>
          {proxyRunning ? (
            <>
              <span className="status-dot">🟢</span>
              <span className="status-text">
                {proxyMode === 'both' ? 'Proxy + Mock' : proxyMode === 'mock' ? 'Mock' : 'Proxy'}
              </span>
              {proxyPort && <span className="port">:{proxyPort}</span>}
            </>
          ) : (
            <>
              <span className="status-dot">⚫</span>
              <span className="status-text">Stopped</span>
            </>
          )}
        </StatusIndicator>
      </TitleBarContainer>
    );
  }

  console.log('[TitleBar] Rendering Windows controls');
  return (
    <TitleBarContainer $isMac={false}>
      <TitleBarContent $isMac={false}>
        <Title>{title}</Title>
        <StatusIndicator $isMac={false}>
          {proxyRunning ? (
            <>
              <span className="status-dot">🟢</span>
              <span className="status-text">
                {proxyMode === 'both' ? 'Proxy + Mock' : proxyMode === 'mock' ? 'Mock' : 'Proxy'}
              </span>
              {proxyPort && <span className="port">:{proxyPort}</span>}
            </>
          ) : (
            <>
              <span className="status-dot">⚫</span>
              <span className="status-text">Stopped</span>
            </>
          )}
        </StatusIndicator>
        <WindowControls $isMac={false}>
          <WindowsButton onClick={handleMinimize}>
            <svg viewBox="0 0 10 1" fill="currentColor">
              <rect width="10" height="1" />
            </svg>
          </WindowsButton>
          <WindowsButton onClick={handleMaximize}>
            {isMaximized ? (
              <svg viewBox="0 0 10 10" fill="currentColor">
                <path d="M2,0 L2,2 L0,2 L0,10 L8,10 L8,8 L10,8 L10,0 Z M3,1 L9,1 L9,7 L8,7 L8,2 L3,2 Z M1,3 L7,3 L7,9 L1,9 Z" />
              </svg>
            ) : (
              <svg viewBox="0 0 10 10" fill="currentColor">
                <rect width="10" height="10" strokeWidth="1" stroke="currentColor" fill="none" />
              </svg>
            )}
          </WindowsButton>
          <CloseButton onClick={handleClose}>
            <svg viewBox="0 0 10 10" fill="currentColor">
              <path d="M0,0 L10,10 M10,0 L0,10" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </CloseButton>
        </WindowControls>
      </TitleBarContent>
    </TitleBarContainer>
  );
};
