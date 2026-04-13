# Main Sequence AI Widgets

This folder owns widget modules shipped by the Main Sequence AI extension.

## Widgets

- `agent-terminal/`: terminal-style AgentSession widget that reuses the chat session endpoints.

## Maintenance Notes

- Keep widget ids stable so saved workspaces continue to resolve existing instances.
- Shared transport should stay in `../runtime/`; widget folders should focus on presentation and
  widget-specific state only.
