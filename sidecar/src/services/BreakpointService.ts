import { EventEmitter } from 'events';
import * as http from 'http';
import { BreakpointRule, BreakpointCondition, PausedTraffic } from '../../../shared/src/models';

interface PendingRequest {
    id: string;
    timestamp: number;
    pauseType: 'request' | 'response';
    method: string;
    url: string;
    requestHeaders: Record<string, string>;
    requestBody: string;
    statusCode?: number;
    responseHeaders?: Record<string, string>;
    responseBody?: string;
    matchedRule: string;
    resolve: (action: { action: 'continue' | 'drop', modified?: any }) => void;
}

export class BreakpointService extends EventEmitter {
    private rules: BreakpointRule[] = [];
    private pausedRequests: Map<string, PendingRequest> = new Map();

    constructor() {
        super();
    }

    public setRules(rules: BreakpointRule[]) {
        this.rules = rules;
        console.log(`[BreakpointService] Loaded ${rules.length} breakpoint rules`);
    }

    public getRules(): BreakpointRule[] {
        return this.rules;
    }

    public getPausedTraffic(): PausedTraffic[] {
        return Array.from(this.pausedRequests.values()).map(req => ({
            id: req.id,
            timestamp: req.timestamp,
            pauseType: req.pauseType,
            method: req.method,
            url: req.url,
            requestHeaders: req.requestHeaders,
            requestBody: req.requestBody,
            statusCode: req.statusCode,
            responseHeaders: req.responseHeaders,
            responseBody: req.responseBody,
            matchedRule: req.matchedRule
        }));
    }

    /**
     * Check if request should be paused. Returns a promise that resolves
     * when user continues/drops the request.
     */
    public async checkRequestBreakpoint(
        method: string,
        url: string,
        headers: Record<string, string>,
        body: string
    ): Promise<{ action: 'continue' | 'drop', modified?: { headers?: Record<string, string>, body?: string } }> {
        const matchedRule = this.findMatchingRule('request', method, url, headers, body);
        if (!matchedRule) {
            return { action: 'continue' };
        }

        return new Promise((resolve) => {
            const id = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const pending: PendingRequest = {
                id,
                timestamp: Date.now(),
                pauseType: 'request',
                method,
                url,
                requestHeaders: headers,
                requestBody: body,
                matchedRule: matchedRule.name,
                resolve
            };

            this.pausedRequests.set(id, pending);
            this.emit('trafficPaused', this.getPausedTraffic());
            console.log(`[BreakpointService] Paused request: ${method} ${url} (rule: ${matchedRule.name})`);
        });
    }

    /**
     * Check if response should be paused.
     */
    public async checkResponseBreakpoint(
        method: string,
        url: string,
        requestHeaders: Record<string, string>,
        requestBody: string,
        statusCode: number,
        responseHeaders: Record<string, string>,
        responseBody: string
    ): Promise<{ action: 'continue' | 'drop', modified?: { statusCode?: number, headers?: Record<string, string>, body?: string } }> {
        const matchedRule = this.findMatchingRule('response', method, url, requestHeaders, requestBody, statusCode);
        if (!matchedRule) {
            return { action: 'continue' };
        }

        return new Promise((resolve) => {
            const id = `res-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const pending: PendingRequest = {
                id,
                timestamp: Date.now(),
                pauseType: 'response',
                method,
                url,
                requestHeaders,
                requestBody,
                statusCode,
                responseHeaders,
                responseBody,
                matchedRule: matchedRule.name,
                resolve
            };

            this.pausedRequests.set(id, pending);
            this.emit('trafficPaused', this.getPausedTraffic());
            console.log(`[BreakpointService] Paused response: ${method} ${url} (rule: ${matchedRule.name})`);
        });
    }

    /**
     * Continue a paused request/response (optionally with modifications)
     */
    public continueTraffic(id: string, modifications?: any) {
        const pending = this.pausedRequests.get(id);
        if (!pending) {
            throw new Error(`Paused traffic not found: ${id}`);
        }

        pending.resolve({ action: 'continue', modified: modifications });
        this.pausedRequests.delete(id);
        this.emit('trafficPaused', this.getPausedTraffic());
        console.log(`[BreakpointService] Continued traffic: ${id}`);
    }

    /**
     * Drop a paused request/response (don't forward)
     */
    public dropTraffic(id: string) {
        const pending = this.pausedRequests.get(id);
        if (!pending) {
            throw new Error(`Paused traffic not found: ${id}`);
        }

        pending.resolve({ action: 'drop' });
        this.pausedRequests.delete(id);
        this.emit('trafficPaused', this.getPausedTraffic());
        console.log(`[BreakpointService] Dropped traffic: ${id}`);
    }

    private findMatchingRule(
        target: 'request' | 'response',
        method: string,
        url: string,
        headers: Record<string, string>,
        body: string,
        statusCode?: number
    ): BreakpointRule | null {
        const enabledRules = this.rules.filter(r => r.enabled && (r.target === target || r.target === 'both'));

        for (const rule of enabledRules) {
            if (this.matchesAllConditions(rule.conditions, method, url, headers, body, statusCode)) {
                return rule;
            }
        }

        return null;
    }

    private matchesAllConditions(
        conditions: BreakpointCondition[],
        method: string,
        url: string,
        headers: Record<string, string>,
        body: string,
        statusCode?: number
    ): boolean {
        for (const condition of conditions) {
            if (!this.matchesCondition(condition, method, url, headers, body, statusCode)) {
                return false;
            }
        }
        return true;
    }

    private matchesCondition(
        condition: BreakpointCondition,
        method: string,
        url: string,
        headers: Record<string, string>,
        body: string,
        statusCode?: number
    ): boolean {
        try {
            switch (condition.type) {
                case 'url': {
                    if (condition.isRegex) {
                        const regex = new RegExp(condition.pattern);
                        return regex.test(url);
                    } else {
                        // Simple wildcard matching
                        const pattern = condition.pattern.replace(/\*/g, '.*');
                        const regex = new RegExp(`^${pattern}$`);
                        return regex.test(url);
                    }
                }

                case 'method': {
                    return method.toUpperCase() === condition.pattern.toUpperCase();
                }

                case 'statusCode': {
                    if (statusCode === undefined) return false;
                    if (condition.isRegex) {
                        const regex = new RegExp(condition.pattern);
                        return regex.test(statusCode.toString());
                    } else {
                        return statusCode.toString() === condition.pattern;
                    }
                }

                case 'header': {
                    if (!condition.headerName) return false;
                    const headerValue = headers[condition.headerName.toLowerCase()];
                    if (!headerValue) return false;

                    if (condition.isRegex) {
                        const regex = new RegExp(condition.pattern);
                        return regex.test(headerValue);
                    } else {
                        return headerValue.includes(condition.pattern);
                    }
                }

                case 'contains': {
                    if (condition.isRegex) {
                        const regex = new RegExp(condition.pattern);
                        return regex.test(body);
                    } else {
                        return body.includes(condition.pattern);
                    }
                }

                default:
                    return false;
            }
        } catch (error) {
            console.error(`[BreakpointService] Error matching condition:`, error);
            return false;
        }
    }
}
