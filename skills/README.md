# Orbiter Finance Skills

This folder contains MCP skill docs for Orbiter Finance tools. Each skill has its own `SKILL.md` with inputs, outputs, and examples.

## Index
- `orbiter-bridge-flow`
- `orbiter-bridge-quote`
- `orbiter-bridge-tx`
- `orbiter-chain-status`
- `orbiter-chains`
- `orbiter-rpc-health`
- `orbiter-sign-broadcast`
- `orbiter-sign-template`
- `orbiter-tokens`
- `orbiter-transaction`
- `orbiter-tx-broadcast`
- `orbiter-tx-simulate`
- `orbiter-tx-track`
- `orbiter-wallet-portfolio`

## Conventions
- Each `SKILL.md` is the single source of truth for that tool's behavior.
- Inputs and outputs mirror MCP tool schemas.
- CLI examples use the `orbiter` binary.
- Quotes can include `approve`, `swap`, and `bridge` steps depending on the route.
- `orbiter_bridge_flow` can optionally auto-approve when `autoApprove` is true and `ORBITER_PRIVATE_KEY` is set on the MCP server (never pass keys via tool arguments).
