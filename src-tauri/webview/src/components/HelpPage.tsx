import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { tokens } from '../styles/tokens';

const HelpContainer = styled.div`
  padding: 20px;
  max-width: 900px;
  margin: 0 auto;
`;

const HelpContent = styled.div`
  background: ${tokens.surface.panel};
  border-radius: ${tokens.radius.lg};
  padding: 30px;
  color: ${tokens.text.primary};
  
  h1, h2, h3 {
    color: ${tokens.text.white};
    margin-top: 24px;
    margin-bottom: 12px;
  }
  
  h1 {
    font-size: 28px;
    border-bottom: 2px solid ${tokens.status.accent};
    padding-bottom: 8px;
  }
  
  h2 {
    font-size: 22px;
    border-bottom: 1px solid ${tokens.border.default};
    padding-bottom: 6px;
  }
  
  h3 {
    font-size: 18px;
  }
  
  p {
    line-height: 1.6;
    margin-bottom: 12px;
  }
  
  code {
    background: ${tokens.surface.base};
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 13px;
  }
  
  pre {
    background: ${tokens.surface.base};
    padding: 12px;
    border-radius: 4px;
    overflow-x: auto;
    border-left: 3px solid ${tokens.status.accent};
    
    code {
      background: none;
      padding: 0;
    }
  }
  
  ul, ol {
    margin-left: 20px;
    margin-bottom: 12px;
    
    li {
      margin-bottom: 6px;
      line-height: 1.5;
    }
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
    
    th, td {
      border: 1px solid ${tokens.border.default};
      padding: 8px 12px;
      text-align: left;
    }
    
    th {
      background: ${tokens.surface.base};
      font-weight: 600;
    }
  }
  
  a {
    color: ${tokens.status.accent};
    text-decoration: none;
    
    &:hover {
      text-decoration: underline;
    }
  }
  
  blockquote {
    border-left: 4px solid ${tokens.status.accent};
    padding-left: 16px;
    margin-left: 0;
    color: #a0a0a0;
    font-style: italic;
  }
`;

const TabButtons = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
`;

const TabButton = styled.button<{ $active: boolean }>`
  padding: 8px 16px;
  background: ${props => props.$active ? tokens.status.accent : tokens.border.default};
  color: ${tokens.text.white};
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: background 0.2s;
  
  &:hover {
    background: ${props => props.$active ? '#005a9e' : '#4e4e52'};
  }
`;

const LoadingMessage = styled.div`
  text-align: center;
  padding: 40px;
  color: #a0a0a0;
  font-size: 14px;
`;

type HelpDoc = 'manual' | 'readme';

export const HelpPage: React.FC = () => {
  const [activeDoc, setActiveDoc] = useState<HelpDoc>('manual');
  const [manualContent, setManualContent] = useState<string>('');
  const [readmeContent, setReadmeContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDocumentation();
  }, []);

  const loadDocumentation = async () => {
    try {
      // Load manual.md
      const manualResponse = await fetch('/manual.md');
      const manualText = await manualResponse.text();
      setManualContent(manualText);

      // Load README.md
      const readmeResponse = await fetch('/README.md');
      const readmeText = await readmeResponse.text();
      setReadmeContent(readmeText);
      
      setLoading(false);
    } catch (error) {
      console.error('[HelpPage] Failed to load documentation:', error);
      setManualContent('# Error\n\nFailed to load documentation.');
      setReadmeContent('# Error\n\nFailed to load documentation.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <HelpContainer>
        <LoadingMessage>Loading documentation...</LoadingMessage>
      </HelpContainer>
    );
  }

  return (
    <HelpContainer>
      <TabButtons>
        <TabButton 
          $active={activeDoc === 'manual'} 
          onClick={() => setActiveDoc('manual')}
        >
          Quick Reference
        </TabButton>
        <TabButton 
          $active={activeDoc === 'readme'} 
          onClick={() => setActiveDoc('readme')}
        >
          Full Documentation
        </TabButton>
      </TabButtons>
      
      <HelpContent>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {activeDoc === 'manual' ? manualContent : readmeContent}
        </ReactMarkdown>
      </HelpContent>
    </HelpContainer>
  );
};
