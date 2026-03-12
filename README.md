# Orbiter Finance MCP + Skills + CLI

A toolkit skeleton for "one-click cross-chain" onboarding. Includes:
- MCP Server
- AI Skills (`skills/`)
- CLI
- Unified API SDK

## Environment Variables
- `ORBITER_API_BASE_URL` (optional, default `https://openapi.orbiter.finance`)
- `ORBITER_API_KEY` (optional)
- `ORBITER_PRIVATE_KEY` (optional, only used for local signing in `bridge sign` / `bridge sign-broadcast`)

Security note:
The private key is only used for local signing. It is never written to disk or sent over the network.

## Local Development
```bash
pnpm install
pnpm -r run build
pnpm -C mcp run dev
pnpm -C cli run dev -- bridge quote --source-chain 42161 --dest-chain 8453 --source-token 0x0000000000000000000000000000000000000000 --dest-token 0x0000000000000000000000000000000000000000 --amount 300000000000000 --user 0xabc... --recipient 0xabc...
pnpm -C cli run dev -- bridge tx --source-chain 42161 --dest-chain 8453 --source-token 0x0000000000000000000000000000000000000000 --dest-token 0x0000000000000000000000000000000000000000 --amount 300000000000000 --user 0xabc... --recipient 0xabc...
pnpm -C cli run dev -- bridge flow --source-chain 42161 --dest-chain 8453 --source-token 0x0000000000000000000000000000000000000000 --dest-token 0x0000000000000000000000000000000000000000 --amount 300000000000000 --user 0xabc... --recipient 0xabc... --chain 42161 --call-on-fail
pnpm -C cli run dev -- bridge sign-template --source-chain 42161 --dest-chain 8453 --source-token 0x0000000000000000000000000000000000000000 --dest-token 0x0000000000000000000000000000000000000000 --amount 300000000000000 --user 0xabc... --recipient 0xabc... --chain 42161
pnpm -C cli run dev -- bridge sign --template-file ./template.json --chain-id 42161
pnpm -C cli run dev -- bridge sign-broadcast --template-file ./template.json --chain-id 42161 --chain 42161
ORBITER_PRIVATE_KEY=... pnpm -C cli run dev -- bridge e2e --source-chain 42161 --dest-chain 8453 --source-token 0x0000000000000000000000000000000000000000 --dest-token 0x0000000000000000000000000000000000000000 --amount 300000000000000 --user 0xabc... --recipient 0xabc... --chain 42161
pnpm -C cli run dev -- bridge simulate --chain 42161 --to 0xdef... --data 0x1234
pnpm -C cli run dev -- bridge broadcast --chain 42161 --signed-tx 0x...
pnpm -C cli run dev -- bridge simulate --chain 42161 --to 0xdef... --data 0x1234
pnpm -C cli run dev -- bridge broadcast --chain 42161 --signed-tx 0x...
pnpm -C cli run dev -- bridge simulate --chain 42161 --to 0xdef... --data 0x1234 --call-on-fail
pnpm -C cli run dev -- rpc health --chain 42161
pnpm -C cli run dev -- rpc health --all
```

## Installation

### One Command

```bash
curl -fsSL https://raw.githubusercontent.com/Orbiter-Finance/bridge-skills/main/install.sh | sh
```

### Skills CLI (If You Use It)

```bash
npx skills add Orbiter-Finance/bridge-skills
```

### Client-Specific Guides
- [Codex](.codex/INSTALL.md)
- [OpenCode](.opencode/INSTALL.md)
- [Cursor](.cursor-plugin/INSTALL.md)
- [Claude](.claude-plugin/INSTALL.md)
- [OpenClaw](.openclaw/INSTALL.md)

### Supported MCP Clients
- Claude Code
- Cursor
- OpenClaw
- Any MCP-compatible client (use the stdio command above)

## MCP Tools
- `orbiter_chains`
- `orbiter_tokens`
- `orbiter_bridge_quote`
- `orbiter_bridge_tx`
- `orbiter_bridge_flow`
- `orbiter_sign_template`
- `orbiter_sign_broadcast`
- `orbiter_transaction`
- `orbiter_wallet_portfolio`
- `orbiter_tx_simulate`
- `orbiter_tx_broadcast`
- `orbiter_rpc_health`

## RPC Map
By default, reads `rpc-map.json` with a mapping from chain ID to RPC URL (values can be a string or an array of URLs; the first available value is used). If not found, it fetches from `https://cdn.orbiter.finance/config/chains-explore.json`.

```json
{
  "42161": "https://arb1.arbitrum.io/rpc"
}
```

## Notes on ERC20 Approve and Swap
- If the quote contains an `approve` step, `bridge flow` returns an `approve` object that reports
  whether allowance is sufficient, plus the approve transaction data.
- For swap-only routes, the first step is usually `action = "swap"`. For cross-chain swap, routes may include
  `swap` then `bridge`. Use `bridge flow` to see both the swap tx and the final signable bridge tx.
- CLI supports `--amount-human` with `--amount-decimals` and `--format summary` for concise output.
- `bridge tx` supports `--action swap|bridge|approve` to select the desired step.
- `sign-broadcast` validates RPC chainId by default (disable with `--skip-chain-check`).

## MCP Smoke Tests
```bash
ORBITER_API_BASE_URL=https://openapi.orbiter.finance ORBITER_API_KEY=demo pnpm -C mcp run smoke
ORBITER_API_BASE_URL=https://openapi.orbiter.finance ORBITER_API_KEY=demo ORBITER_SMOKE_QUOTE=1 pnpm -C mcp run smoke
ORBITER_API_BASE_URL=https://openapi.orbiter.finance ORBITER_API_KEY=demo ORBITER_SMOKE_SIGN_TEMPLATE=1 ORBITER_RPC_URL=https://arb1.arbitrum.io/rpc pnpm -C mcp run smoke
ORBITER_API_BASE_URL=https://openapi.orbiter.finance ORBITER_API_KEY=demo ORBITER_SMOKE_FLOW=1 ORBITER_RPC_URL=https://arb1.arbitrum.io/rpc pnpm -C mcp run smoke
ORBITER_API_BASE_URL=https://openapi.orbiter.finance ORBITER_API_KEY=demo ORBITER_SMOKE_SIMULATE=1 ORBITER_RPC_URL=https://arb1.arbitrum.io/rpc pnpm -C mcp run smoke
ORBITER_API_BASE_URL=https://openapi.orbiter.finance ORBITER_API_KEY=demo ORBITER_SMOKE_BROADCAST=1 ORBITER_RPC_URL=https://arb1.arbitrum.io/rpc ORBITER_SMOKE_SIGNED_TX=0x... pnpm -C mcp run smoke
```

## MCP Inspector
`mcp/inspector.json` is provided and can be used directly with MCP Inspector (stdio mode):
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

## Release
See `RELEASE.md`.

## Test Records
Summary of real executed test commands and results (2026-03-11, Asia/Shanghai):

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

Test results:
- CLI help / RPC health passed
- `chains` / `tokens` / `quote` / `tx` / `transaction` passed
- `simulate` passed (RPC returned gasEstimate)
- `broadcast` passed (requires a valid raw tx)
