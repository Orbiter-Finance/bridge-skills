# Testing

This file records verified CLI tests and recommended MCP test steps.

## CLI Tests (Executed)

```bash
# CLI help
pnpm -C cli run dev -- --help

# RPC health
pnpm -C cli run dev -- rpc health --chain 42161

# OpenAPI basics
ORBITER_API_BASE_URL=https://openapi.orbiter.finance ORBITER_API_KEY=demo pnpm -C cli run dev -- chains
ORBITER_API_BASE_URL=https://openapi.orbiter.finance ORBITER_API_KEY=demo pnpm -C cli run dev -- tokens --chain 42161 --prefix ETH

# Quote / tx build
ORBITER_API_BASE_URL=https://openapi.orbiter.finance ORBITER_API_KEY=demo pnpm -C cli run dev -- bridge quote --source-chain 42161 --dest-chain 8453 --source-token 0x0000000000000000000000000000000000000000 --dest-token 0x0000000000000000000000000000000000000000 --amount 300000000000000 --user 0xefc6089224068b20197156a91d50132b2a47b908 --recipient 0xefc6089224068b20197156a91d50132b2a47b908
ORBITER_API_BASE_URL=https://openapi.orbiter.finance ORBITER_API_KEY=demo pnpm -C cli run dev -- bridge tx --source-chain 42161 --dest-chain 8453 --source-token 0x0000000000000000000000000000000000000000 --dest-token 0x0000000000000000000000000000000000000000 --amount 300000000000000 --user 0xefc6089224068b20197156a91d50132b2a47b908 --recipient 0xefc6089224068b20197156a91d50132b2a47b908

# Flow (simulate may fail due to insufficient balance)
ORBITER_API_BASE_URL=https://openapi.orbiter.finance ORBITER_API_KEY=demo pnpm -C cli run dev -- bridge flow --source-chain 42161 --dest-chain 8453 --source-token 0x0000000000000000000000000000000000000000 --dest-token 0x0000000000000000000000000000000000000000 --amount 300000000000000 --user 0xefc6089224068b20197156a91d50132b2a47b908 --recipient 0xefc6089224068b20197156a91d50132b2a47b908 --chain 42161 --call-on-fail

# Simulate / broadcast
pnpm -C cli run dev -- bridge simulate --chain 42161 --to 0x0000000000000000000000000000000000000000 --data 0x
pnpm -C cli run dev -- bridge broadcast --chain 42161 --signed-tx <rawTx>

# Real cross-chain transaction query
ORBITER_API_BASE_URL=https://openapi.orbiter.finance ORBITER_API_KEY=demo pnpm -C cli run dev -- transaction --hash 0xec0980a8bfcacee293151349aea8648163239cb20f21cba9259ebd6f0862d4e8
```

## MCP Test Recommendations

The current MCP runs in stdio mode. Use an MCP-capable client for integration testing. If using MCP Inspector or a custom client, verify each tool from the list below.

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

## MCP Smoke Test Script

```bash
# Optional: test RPC health
ORBITER_SMOKE_RPC=1 ORBITER_RPC_URL=https://arb1.arbitrum.io/rpc pnpm -C mcp run smoke

# Optional: include quote/sign-template
ORBITER_SMOKE_QUOTE=1 ORBITER_SMOKE_SIGN_TEMPLATE=1 pnpm -C mcp run smoke

# Optional: include flow / simulate / broadcast
ORBITER_SMOKE_FLOW=1 ORBITER_SMOKE_SIMULATE=1 ORBITER_SMOKE_BROADCAST=1 pnpm -C mcp run smoke
```

## MCP Inspector Config

`mcp/inspector.json` is provided and can be imported into MCP Inspector:

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
