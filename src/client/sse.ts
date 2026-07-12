export interface SseMessage {
  event?: string
  data: string
  id?: string
  retry?: number
}

export interface SseParseResult {
  messages: SseMessage[]
  rest: string
}

export type SseJsonParser<T> = (value: unknown, message: SseMessage) => T | null

export class SseJsonParseError extends Error {
  constructor(
    public readonly data: string,
    public readonly cause: unknown,
  ) {
    const preview = data.length > 240 ? `${data.slice(0, 240)}...` : data
    super(`Failed to parse SSE JSON data: ${preview}`)
    this.name = 'SseJsonParseError'
  }
}

function findSseSeparator(input: string): { index: number; length: number } | null {
  const lf = input.indexOf('\n\n')
  const crlf = input.indexOf('\r\n\r\n')

  if (lf < 0 && crlf < 0) {
    return null
  }
  if (lf < 0) {
    return { index: crlf, length: 4 }
  }
  if (crlf < 0) {
    return { index: lf, length: 2 }
  }
  return crlf < lf ? { index: crlf, length: 4 } : { index: lf, length: 2 }
}

function parseSseField(line: string): { field: string; value: string } {
  const colon = line.indexOf(':')
  if (colon < 0) {
    return { field: line, value: '' }
  }

  const rawValue = line.slice(colon + 1)
  return {
    field: line.slice(0, colon),
    value: rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue,
  }
}

export function parseSseMessage(block: string): SseMessage | null {
  const data: string[] = []
  let event: string | undefined
  let id: string | undefined
  let retry: number | undefined

  for (const line of block.split(/\r?\n/)) {
    if (line === '' || line.startsWith(':')) {
      continue
    }

    const { field, value } = parseSseField(line)
    switch (field) {
      case 'event':
        event = value
        break
      case 'data':
        data.push(value)
        break
      case 'id':
        id = value
        break
      case 'retry': {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) {
          retry = parsed
        }
        break
      }
    }
  }

  if (data.length === 0) {
    return null
  }

  return { event, data: data.join('\n'), id, retry }
}

export function parseSseMessages(input: string): SseParseResult {
  const messages: SseMessage[] = []
  let rest = input

  for (;;) {
    const separator = findSseSeparator(rest)
    if (!separator) {
      break
    }

    const block = rest.slice(0, separator.index)
    rest = rest.slice(separator.index + separator.length)
    const message = parseSseMessage(block)
    if (message) {
      messages.push(message)
    }
  }

  return { messages, rest }
}

export function parseSseJson<T = Record<string, unknown>>(
  input: string,
  parser: SseJsonParser<T> = (value) => (value && typeof value === 'object' ? value as T : null),
  onParseError?: (error: SseJsonParseError, message: SseMessage) => void,
): { events: T[]; rest: string } {
  const { messages, rest } = parseSseMessages(input)
  const events = messages
    .map((message) => parseSseJsonMessage(message, parser, onParseError))
    .filter((event): event is T => event !== null)

  return { events, rest }
}

function parseSseJsonMessage<T>(
  message: SseMessage,
  parser: SseJsonParser<T>,
  onParseError?: (error: SseJsonParseError, message: SseMessage) => void,
): T | null {
  const data = message.data.trim()
  if (data === '' || data === '[DONE]') {
    return null
  }

  let value: unknown
  try {
    value = parseJsonData(data)
  } catch (err) {
    // Recovery path: one malformed message must not abort later messages.
    // Without a handler, direct parseSseJson callers keep legacy throwing behavior.
    if (onParseError && err instanceof SseJsonParseError) {
      onParseError(err, message)
      return null
    }
    throw err
  }

  return parser(value, message)
}

function parseJsonData(data: string): unknown {
  try {
    return JSON.parse(data) as unknown
  } catch (err) {
    throw new SseJsonParseError(data, err)
  }
}

export interface SseParserOptions {
  /**
   * Called when a message's JSON payload is malformed. The parser skips the
   * message, keeps its buffer consistent, and continues with the rest of the
   * stream (S33-03). Defaults to a console warning so failures stay visible.
   */
  onParseError?: (error: SseJsonParseError, message: SseMessage) => void
}

function defaultParseErrorHandler(error: SseJsonParseError): void {
  console.warn(`[niceneasy-sdk] skipped malformed SSE message: ${error.message}`)
}

export function createSseParser<T = Record<string, unknown>>(
  parser?: SseJsonParser<T>,
  options?: SseParserOptions,
): {
  push(chunk: string): T[]
  flush(): T[]
  reset(): void
} {
  let buffer = ''
  const onParseError = options?.onParseError ?? defaultParseErrorHandler

  return {
    push(chunk: string): T[] {
      buffer += chunk
      const parsed = parseSseJson<T>(buffer, parser, onParseError)
      buffer = parsed.rest
      return parsed.events
    },
    flush(): T[] {
      if (buffer.trim() === '') {
        buffer = ''
        return []
      }

      const message = parseSseMessage(buffer)
      buffer = ''
      if (!message) {
        return []
      }

      const event = parseSseJsonMessage(
        message,
        parser ?? ((value) => (value && typeof value === 'object' ? value as T : null)),
        onParseError,
      )
      return event ? [event] : []
    },
    reset(): void {
      buffer = ''
    },
  }
}
