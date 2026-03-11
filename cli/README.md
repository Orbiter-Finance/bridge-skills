# Orbiter Finance CLI

A command-line interface for Orbiter Finance bridging, transaction construction, signing, simulation, and RPC health checks.

## Install (Global)

```bash
npm i -g @orbiter-finance/cli
# or
pnpm add -g @orbiter-finance/cli
```

## Run in Dev (Repo)

```bash
pnpm -C .. install
pnpm -C .. run build
pnpm -C . run dev -- --help
```

## Environment Variables
- `ORBITER_API_BASE_URL` (optional, default `https://openapi.orbiter.finance`)
- `ORBITER_API_KEY` (optional)
- `ORBITER_RPC_MAP` (optional, JSON string mapping chain ID to RPC URL)
- `ORBITER_RPC_MAP_PATH` (optional, default reads `rpc-map.json` at repo root)
- `ORBITER_PRIVATE_KEY` (optional, only used for local signing)

## Common Commands

```bash
# Chains and tokens
orbiter chains
orbiter tokens --chain 42161 --prefix ETH

# Quote and tx
orbiter bridge quote --source-chain 42161 --dest-chain 8453 --source-token 0x0000000000000000000000000000000000000000 --dest-token 0x0000000000000000000000000000000000000000 --amount 300000000000000 --user 0xabc... --recipient 0xabc...
orbiter bridge tx --source-chain 42161 --dest-chain 8453 --source-token 0x0000000000000000000000000000000000000000 --dest-token 0x0000000000000000000000000000000000000000 --amount 300000000000000 --user 0xabc... --recipient 0xabc...

# Flow (quote + signable tx + simulate)
orbiter bridge flow --source-chain 42161 --dest-chain 8453 --source-token 0x0000000000000000000000000000000000000000 --dest-token 0x0000000000000000000000000000000000000000 --amount 300000000000000 --user 0xabc... --recipient 0xabc... --chain 42161 --call-on-fail

# Sign template and broadcast
orbiter bridge sign-template --source-chain 42161 --dest-chain 8453 --source-token 0x0000000000000000000000000000000000000000 --dest-token 0x0000000000000000000000000000000000000000 --amount 300000000000000 --user 0xabc... --recipient 0xabc... --chain 42161
orbiter bridge sign --template-file ./template.json --chain-id 42161
orbiter bridge sign-broadcast --template-file ./template.json --chain-id 42161 --chain 42161

# RPC health
orbiter rpc health --chain 42161
```

## Publish

```bash
pnpm --filter @orbiter-finance/cli publish --access public
```
