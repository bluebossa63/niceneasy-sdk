# @niceneasy/agent-sdk

Shared TypeScript API and event contract package for niceneasy agent products.

This package is used by:

- `agent-command-center`
- `niceneasy-agents`
- future bounded widgets in `niceneasy`

Corporate design is defined outside this package in `../niceneasy/docs/corporate-design.md`.

This package owns API and domain contracts only:

- stream events
- run replay events
- agent/session/task DTOs
- permission DTOs
- API client behavior

It must not own logos, color tokens, React components, or VS Code-specific UI.
