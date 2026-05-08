import { adaptLegacyEvent, sequenceStreamEvent } from '../types/index.js';
export class ApiError extends Error {
    status;
    statusText;
    constructor(status, statusText, message) {
        super(message ?? `API error: ${status} ${statusText}`);
        this.name = 'ApiError';
        this.status = status;
        this.statusText = statusText;
    }
}
const DEFAULT_TIMEOUT_MS = 15_000;
const CHAT_TIMEOUT_MS = 120_000;
function resolveFetch(fetchImpl) {
    if (fetchImpl) {
        return fetchImpl;
    }
    if (typeof globalThis.fetch === 'function') {
        return globalThis.fetch.bind(globalThis);
    }
    return undefined;
}
function parseJsonBody(body) {
    if (!body.trim()) {
        return undefined;
    }
    return JSON.parse(body);
}
function concatUint8Arrays(chunks) {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const out = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.length;
    }
    return out;
}
export class ApiClient {
    baseUrl;
    headers;
    timeoutMs;
    fetchImpl;
    constructor(options) {
        this.baseUrl = options.baseUrl.replace(/\/+$/, '');
        this.headers = options.headers ?? {};
        this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        this.fetchImpl = resolveFetch(options.fetch);
    }
    async request(path, options) {
        const url = new URL(path, `${this.baseUrl}/`);
        const timeoutMs = options?.timeoutMs ?? this.timeoutMs;
        const headers = {
            'Content-Type': 'application/json',
            ...this.headers,
            ...(options?.headers ?? {}),
        };
        if (!this.fetchImpl) {
            return this.nodeRequest(url, { ...options, headers, timeoutMs });
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        const signal = options?.signal ?? controller.signal;
        try {
            const response = await this.fetchImpl(url, { ...options, headers, signal });
            const text = await response.text();
            if (!response.ok) {
                throw new ApiError(response.status, response.statusText, text || undefined);
            }
            return parseJsonBody(text);
        }
        finally {
            clearTimeout(timeout);
        }
    }
    async nodeRequest(url, init) {
        const importNodeModule = new Function('specifier', 'return import(specifier)');
        const protocol = await importNodeModule(url.protocol === 'https:' ? 'node:https' : 'node:http');
        const body = typeof init.body === 'string' ? init.body : undefined;
        const headers = { ...init.headers };
        if (body !== undefined && !('Content-Length' in headers) && !('content-length' in headers)) {
            headers['Content-Length'] = new TextEncoder().encode(body).length.toString();
        }
        return await new Promise((resolve, reject) => {
            const req = protocol.request(url, { method: init.method ?? 'GET', headers });
            const timer = setTimeout(() => {
                req.destroy(new Error(`Request timed out after ${init.timeoutMs}ms`));
            }, init.timeoutMs);
            req.on('response', (res) => {
                const chunks = [];
                res.on('data', (chunk) => {
                    chunks.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk);
                });
                res.on('end', () => {
                    clearTimeout(timer);
                    const responseBody = new TextDecoder().decode(concatUint8Arrays(chunks));
                    const status = res.statusCode ?? 500;
                    const statusText = res.statusMessage ?? 'Unknown Error';
                    if (status < 200 || status >= 300) {
                        reject(new ApiError(status, statusText, responseBody || undefined));
                        return;
                    }
                    try {
                        resolve(parseJsonBody(responseBody));
                    }
                    catch (err) {
                        reject(err);
                    }
                });
            });
            req.on('error', (err) => {
                clearTimeout(timer);
                reject(err);
            });
            if (init.signal) {
                if (init.signal.aborted) {
                    req.destroy(new Error('Request aborted'));
                    return;
                }
                init.signal.addEventListener('abort', () => req.destroy(new Error('Request aborted')), { once: true });
            }
            if (body !== undefined) {
                req.write(body);
            }
            req.end();
        });
    }
    healthCheck() {
        return this.request('/healthz');
    }
    readyCheck() {
        return this.request('/readyz');
    }
    listAgents() {
        return this.request('/api/agents');
    }
    getAgent(name) {
        return this.request(`/api/agents/${encodeURIComponent(name)}`);
    }
    getModels() {
        return this.request('/api/models');
    }
    getTools(agent) {
        const query = agent ? `?agent=${encodeURIComponent(agent)}` : '';
        return this.request(`/api/tools${query}`);
    }
    chat(req, signal) {
        return this.request('/api/chat', {
            method: 'POST',
            body: JSON.stringify(req),
            timeoutMs: CHAT_TIMEOUT_MS,
            signal,
        });
    }
    createTask(req) {
        return this.request('/api/tasks', { method: 'POST', body: JSON.stringify(req) });
    }
    listTasks() {
        return this.request('/api/tasks');
    }
    getPendingTasks() {
        return this.request('/api/tasks/pending');
    }
    getCommandCenterTask(taskId) {
        return this.request(`/api/command-center/tasks/${encodeURIComponent(taskId)}`);
    }
    getCommandCenterTaskChildren(taskId) {
        return this.request(`/api/command-center/tasks/${encodeURIComponent(taskId)}/children`);
    }
    getCommandCenterTaskLineage(taskId) {
        return this.request(`/api/command-center/tasks/${encodeURIComponent(taskId)}/lineage`);
    }
    getCommandCenterProjectTasks(projectId) {
        return this.request(`/api/command-center/projects/${encodeURIComponent(projectId)}/tasks`);
    }
    getCosts() {
        return this.request('/api/costs');
    }
    getAgentCosts(agent) {
        return this.request(`/api/costs/${encodeURIComponent(agent)}`);
    }
    listConversations() {
        return this.request('/api/conversations');
    }
    getConversationMessages(sessionId) {
        return this.request(`/api/conversations/${encodeURIComponent(sessionId)}`);
    }
    listNotifications() {
        return this.request('/api/notifications');
    }
    ackNotification(id) {
        return this.request(`/api/notifications/${encodeURIComponent(id)}/ack`, { method: 'POST' });
    }
    getOverview() {
        return this.request('/api/overview');
    }
    getErrors() {
        return this.request('/api/errors');
    }
    getWorkspace() {
        return this.request('/api/workspace');
    }
    getCommandCenterSummary() {
        return this.request('/api/workspace/summary');
    }
    async getProjects() {
        const envelope = await this.request('/api/projects');
        return envelope.items;
    }
    getProject(projectId) {
        return this.request(`/api/projects/${encodeURIComponent(projectId)}`);
    }
    createProjectDraft(input) {
        return this.request('/api/projects', {
            method: 'POST',
            body: JSON.stringify(input),
        });
    }
    moveWorkItem(projectId, itemId, targetStatus) {
        return this.request(`/api/projects/${encodeURIComponent(projectId)}/work-items/${encodeURIComponent(itemId)}/status`, {
            method: 'POST',
            body: JSON.stringify({ status: targetStatus }),
        });
    }
    async getApprovals() {
        const envelope = await this.request('/api/approvals');
        return envelope.items;
    }
    getApproval(approvalId) {
        return this.request(`/api/approvals/${encodeURIComponent(approvalId)}`);
    }
    decideApproval(approvalId, decision, comment) {
        const input = comment !== undefined ? { decision, comment } : { decision };
        return this.request(`/api/approvals/${encodeURIComponent(approvalId)}/decision`, {
            method: 'POST',
            body: JSON.stringify(input),
        });
    }
    getFleets() {
        return this.request('/api/fleets');
    }
    getPermissions() {
        return this.request('/api/permissions');
    }
    resolvePermission(resolution) {
        return this.request(`/api/permissions/${encodeURIComponent(resolution.id)}/decision`, {
            method: 'POST',
            body: JSON.stringify(resolution),
        });
    }
    getRequestEvaluations(limit = 20) {
        return this.request(`/api/request_evaluations?limit=${encodeURIComponent(String(limit))}`);
    }
    getRequestEvaluation(id) {
        return this.request(`/api/request_evaluations/${encodeURIComponent(id)}`);
    }
    getLoopInvocations(limit = 20) {
        return this.request(`/api/loop/invocations?limit=${encodeURIComponent(String(limit))}`);
    }
    getLoopStatus() {
        return this.request('/api/loop/status');
    }
    async fetchRunEvents(runId, options) {
        const response = await this.request(`/api/runs/${encodeURIComponent(runId)}/events`, options);
        return response.events.map((event) => {
            const rawPayload = event.event ?? JSON.parse(event.payload);
            const payload = adaptLegacyEvent(rawPayload, {
                seq: event.seq,
                ts: event.ts,
            });
            if (!payload) {
                throw new Error(`Unsupported run event payload type: ${event.event_type}`);
            }
            return { ...event, payload: sequenceStreamEvent(payload, event.seq, event.ts) };
        });
    }
    async fetchRuns(options) {
        const limit = options?.limit ?? 20;
        const response = await this.request(`/api/runs?limit=${encodeURIComponent(String(limit))}`, options);
        return response.runs;
    }
}
