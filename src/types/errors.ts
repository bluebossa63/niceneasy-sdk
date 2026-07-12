export interface UnknownBackendErrorEntry {
  [key: string]: unknown
}

/** @deprecated Use UnknownBackendErrorEntry to make the opaque backend shape explicit. */
export type ErrorEntry = UnknownBackendErrorEntry

export interface ErrorOverview {
  recent_errors: UnknownBackendErrorEntry[]
  disabled_models: Record<string, unknown>
}
