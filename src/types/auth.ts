export type AuthProvider = 'basic' | 'oidc' | 'bearer' | 'none'
export type AuthSessionState = 'authenticated' | 'anonymous' | 'expired'

export interface AuthSession {
  authenticated: boolean
  state?: AuthSessionState
  user?: string
  email?: string
  displayName?: string
  provider?: AuthProvider
  expiresAt?: string
}

export interface LoginRoute {
  provider: AuthProvider
  label: string
  href: string
}

export interface AuthConfig {
  mode: AuthProvider
  loginRoutes: LoginRoute[]
  logoutHref?: string
}
