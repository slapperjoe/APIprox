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
