import { adaptLegacyEvents, sequenceStreamEvent, type SequencedStreamEvent, type StreamEvent, type StreamEventContext } from '../types/stream.js'

export interface StreamClientOptions {
  baseUrl?: string
  onEvent: (event: SequencedStreamEvent) => void
  onError?: (err: Error) => void
  onDone?: () => void
}

export interface StreamChatRequest {
  agent: string
  prompt: string
  session_id?: string
  timeout?: number
}

const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 250

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseSseBlock(block: string): Record<string, unknown> | null {
  const dataLines: string[] = []
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }
  }
  if (dataLines.length === 0) {
    return null
  }

  const data = dataLines.join('\n').trim()
  if (data === '' || data === '[DONE]') {
    return null
  }

  const parsed = JSON.parse(data) as unknown
  return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null
}

function emitAdapted(
  raw: Record<string, unknown>,
  options: StreamClientOptions,
  context: StreamEventContext,
): boolean {
  let done = false
  for (const event of adaptLegacyEvents(raw, context)) {
    const sequenced = sequenceStreamEvent(event, context.seq ?? 0)
    context.seq = sequenced.seq + 1
    if (sequenced.run_id) context.run_id = sequenced.run_id
    if (sequenced.session_id) context.session_id = sequenced.session_id
    if (sequenced.message_id) context.message_id = sequenced.message_id
    if (sequenced.tool_call_id) context.tool_call_id = sequenced.tool_call_id
    options.onEvent(sequenced)
    if (event.type === 'finish') {
      done = true
    }
  }
  return done
}

async function readStream(response: Response, options: StreamClientOptions): Promise<boolean> {
  if (!response.body) {
    throw new Error('stream response has no body')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let done = false
  const context: StreamEventContext = { seq: 0, defaultMessageId: 'main' }

  for (;;) {
    const result = await reader.read()
    if (result.done) {
      break
    }
    buffer += decoder.decode(result.value, { stream: true })

    for (;;) {
      const separatorIndex = buffer.search(/\r?\n\r?\n/)
      if (separatorIndex < 0) {
        break
      }

      const block = buffer.slice(0, separatorIndex)
      const separatorLength = buffer.startsWith('\r\n\r\n', separatorIndex) ? 4 : 2
      buffer = buffer.slice(separatorIndex + separatorLength)
      const raw = parseSseBlock(block)
      if (raw) {
        done = emitAdapted(raw, options, context) || done
      }
    }
  }

  const tail = buffer.trim()
  if (tail !== '') {
    const raw = parseSseBlock(tail)
    if (raw) {
      done = emitAdapted(raw, options, context) || done
    }
  }

  return done
}

function streamUrl(baseUrl: string | undefined): URL {
  const browserOrigin = (globalThis as { location?: { origin: string } }).location?.origin
  const origin = baseUrl ? `${baseUrl.replace(/\/+$/, '')}/` : browserOrigin
  if (!origin) {
    throw new Error('baseUrl is required when no browser location is available')
  }
  return new URL('/api/chat/stream', origin)
}

export async function streamChat(
  request: StreamChatRequest,
  options: StreamClientOptions,
): Promise<void> {
  let attempt = 0
  let lastError: Error | undefined

  while (attempt <= MAX_RETRIES) {
    try {
      const response = await fetch(streamUrl(options.baseUrl), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        const detail = await response.text()
        throw new Error(`HTTP ${response.status}: ${detail || response.statusText}`)
      }

      const finished = await readStream(response, options)
      if (finished) {
        options.onDone?.()
      }
      return
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt === MAX_RETRIES) {
        options.onError?.(lastError)
        throw lastError
      }
      await sleep(INITIAL_BACKOFF_MS * 2 ** attempt)
      attempt += 1
    }
  }

  if (lastError) {
    options.onError?.(lastError)
    throw lastError
  }
}
