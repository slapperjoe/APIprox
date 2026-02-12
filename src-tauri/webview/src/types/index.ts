export interface TrafficLog {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  status?: number;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  duration?: number;
}

export interface ProxyConfig {
  port: number;
  mode: 'off' | 'proxy' | 'mock' | 'both';
  httpsEnabled: boolean;
}

export interface ReplaceRule {
  id: string;
  name: string;
  enabled: boolean;
  xpath?: string;
  matchText: string;
  replaceWith: string;
  target: 'request' | 'response' | 'both';
  isRegex: boolean;
}

export interface MockRule {
  id: string;
  name: string;
  enabled: boolean;
  conditions: MockCondition[];
  statusCode: number;
  responseBody: string;
  delayMs?: number;
}

export interface MockCondition {
  type: 'url' | 'xpath' | 'method';
  pattern: string;
  isRegex: boolean;
}
