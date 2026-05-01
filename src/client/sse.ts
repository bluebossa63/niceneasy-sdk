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
): { events: T[]; rest: string } {
  const { messages, rest } = parseSseMessages(input)
  const events: T[] = []

  for (const message of messages) {
    const data = message.data.trim()
    if (data === '' || data === '[DONE]') {
      continue
    }
    events.push(parser(parseJsonData(data), message) as T)
  }

  return { events: events.filter((event): event is T => event !== null), rest }
}

function parseJsonData(data: string): unknown {
  try {
    return JSON.parse(data) as unknown
  } catch (err) {
    throw new SseJsonParseError(data, err)
  }
}

export function createSseParser<T = Record<string, unknown>>(
  parser?: SseJsonParser<T>,
): {
  push(chunk: string): T[]
  flush(): T[]
  reset(): void
} {
  let buffer = ''

  return {
    push(chunk: string): T[] {
      buffer += chunk
      const parsed = parseSseJson<T>(buffer, parser)
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
      if (!message || message.data.trim() === '' || message.data.trim() === '[DONE]') {
        return []
      }

      const value = parseJsonData(message.data)
      const event = parser ? parser(value, message) : (value && typeof value === 'object' ? value as T : null)
      return event ? [event] : []
    },
    reset(): void {
      buffer = ''
    },
  }
}
