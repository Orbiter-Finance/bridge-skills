# Orbiter Finance MCP Server

An MCP (Model Context Protocol) server that exposes Orbiter Finance tools over stdio.

## Build and Run

```bash
pnpm -C .. install
pnpm -C . run build
pnpm -C . run dev
```

## Environment Variables
- `ORBITER_API_BASE_URL` (optional, default `https://openapi.orbiter.finance`)
- `ORBITER_API_KEY` (optional)
- `ORBITER_RPC_MAP` (optional, JSON string mapping chain ID to RPC URL)
- `ORBITER_RPC_MAP_PATH` (optional, default reads `rpc-map.json` at repo root)
- `ORBITER_RPC_MAP_URL` (optional, default `https://cdn.orbiter.finance/config/chains-explore.json`)

## Tools
- `orbiter_chains`
- `orbiter_tokens`
- `orbiter_bridge_quote`
- `orbiter_bridge_tx`
- `orbiter_bridge_flow`
- `orbiter_sign_template`
- `orbiter_sign_broadcast`
- `orbiter_transaction`
- `orbiter_tx_simulate`
- `orbiter_tx_broadcast`
- `orbiter_rpc_health`

## MCP Inspector

`inspector.json` is provided for stdio mode:

```json
{
  "command": "tsx",
  "args": ["src/server.ts"],
  "env": {
    "ORBITER_API_BASE_URL": "https://openapi.orbiter.finance",
    "ORBITER_API_KEY": "demo"
  }
}
```

## Publish

```bash
pnpm --filter @orbiter-finance/mcp-server publish --access public
```
