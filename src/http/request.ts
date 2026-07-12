export class ApiError extends Error {
  public readonly status: number
  public readonly statusText: string

  constructor(
    status: number,
    statusText: string,
    message?: string,
  ) {
    super(message ?? `API error: ${status} ${statusText}`)
    this.name = 'ApiError'
    this.status = status
    this.statusText = statusText
  }
}

export interface ApiClientOptions {
  baseUrl: string
  headers?: Record<string, string>
  timeoutMs?: number
  fetch?: typeof fetch
}

const DEFAULT_TIMEOUT_MS = 15_000
export const CHAT_TRANSPORT_GRACE_MS = 15_000

export function chatTransportTimeoutMs(timeoutSeconds: number | undefined): number | undefined {
  return timeoutSeconds && timeoutSeconds > 0
    ? timeoutSeconds * 1000 + CHAT_TRANSPORT_GRACE_MS
    : undefined
}

function resolveFetch(fetchImpl?: typeof fetch): typeof fetch | undefined {
  if (fetchImpl) {
    return fetchImpl
  }
  if (typeof globalThis.fetch === 'function') {
    return globalThis.fetch.bind(globalThis)
  }
  return undefined
}

function parseJsonBody<T>(body: string): T | undefined {
  if (!body.trim()) {
    return undefined
  }
  return JSON.parse(body) as T
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const out = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

export class HttpJsonClient {
  private readonly baseUrl: string
  private readonly headers: Record<string, string>
  private readonly timeoutMs: number
  private readonly fetchImpl?: typeof fetch

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.headers = options.headers ?? {}
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.fetchImpl = resolveFetch(options.fetch)
  }

  async request<T>(path: string, options?: RequestInit & { timeoutMs?: number | null }): Promise<T> {
    const url = new URL(path, `${this.baseUrl}/`)
    const timeoutMs = options?.timeoutMs === null ? undefined : options?.timeoutMs ?? this.timeoutMs
    const headers = {
      'Content-Type': 'application/json',
      ...this.headers,
      ...(options?.headers ?? {}),
    } as Record<string, string>

    if (!this.fetchImpl) {
      return this.nodeRequest<T>(url, { ...options, headers, timeoutMs })
    }

    const controller = new AbortController()
    const timeout = timeoutMs === undefined ? undefined : setTimeout(() => controller.abort(), timeoutMs)
    const signal = options?.signal ?? controller.signal
    try {
      const response = await this.fetchImpl(url, { ...options, headers, signal })
      const text = await response.text()
      if (!response.ok) {
        throw new ApiError(response.status, response.statusText, text || undefined)
      }
      return parseJsonBody<T>(text) as T
    } finally {
      if (timeout) {
        clearTimeout(timeout)
      }
    }
  }

  private async nodeRequest<T>(
    url: URL,
    init: RequestInit & { timeoutMs?: number },
  ): Promise<T> {
    const importNodeModule = new Function('specifier', 'return import(specifier)') as (
      specifier: string,
    ) => Promise<{
      request: (...args: unknown[]) => {
        on: (event: string, listener: (...args: any[]) => void) => void
        write: (body: string) => void
        end: () => void
        destroy: (err?: Error) => void
      }
    }>
    const protocol = await importNodeModule(url.protocol === 'https:' ? 'node:https' : 'node:http')
    const body = typeof init.body === 'string' ? init.body : undefined
    const headers = { ...(init.headers as Record<string, string> | undefined) }
    if (body !== undefined && !('Content-Length' in headers) && !('content-length' in headers)) {
      headers['Content-Length'] = new TextEncoder().encode(body).length.toString()
    }

    return await new Promise<T>((resolve, reject) => {
      const req = protocol.request(url, { method: init.method ?? 'GET', headers })
      const timer = init.timeoutMs === undefined ? undefined : setTimeout(() => {
        req.destroy(new Error(`Request timed out after ${init.timeoutMs}ms`))
      }, init.timeoutMs)

      req.on('response', (res) => {
        const chunks: Uint8Array[] = []
        res.on('data', (chunk: unknown) => {
          chunks.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk as Uint8Array)
        })
        res.on('end', () => {
          if (timer) {
            clearTimeout(timer)
          }
          const responseBody = new TextDecoder().decode(concatUint8Arrays(chunks))
          const status = res.statusCode ?? 500
          const statusText = res.statusMessage ?? 'Unknown Error'
          if (status < 200 || status >= 300) {
            reject(new ApiError(status, statusText, responseBody || undefined))
            return
          }
          try {
            resolve(parseJsonBody<T>(responseBody) as T)
          } catch (err) {
            reject(err)
          }
        })
      })
      req.on('error', (err) => {
        if (timer) {
          clearTimeout(timer)
        }
        reject(err)
      })
      if (init.signal) {
        if (init.signal.aborted) {
          req.destroy(new Error('Request aborted'))
          return
        }
        init.signal.addEventListener('abort', () => req.destroy(new Error('Request aborted')), { once: true })
      }
      if (body !== undefined) {
        req.write(body)
      }
      req.end()
    })
  }
}
