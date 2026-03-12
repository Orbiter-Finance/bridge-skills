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
- `ORBITER_PRIVATE_KEY` (optional, only used for local signing)

## Common Commands

```bash
# Chains and tokens
orbiter chains
orbiter chains --raw
orbiter tokens --chain 42161 --prefix ETH
orbiter tokens --chain 42161 --prefix USDC --bridgeable --limit 5

# Quote and tx
orbiter bridge quote --source-chain 42161 --dest-chain 8453 --source-token 0x0000000000000000000000000000000000000000 --dest-token 0x0000000000000000000000000000000000000000 --amount 300000000000000 --user 0xabc... --recipient 0xabc...
orbiter bridge quote --source-chain 42161 --dest-chain 8453 --source-token 0x0000000000000000000000000000000000000000 --dest-token 0x0000000000000000000000000000000000000000 --amount-human 0.0006 --amount-decimals 18 --user 0xabc... --recipient 0xabc... --format summary
orbiter bridge tx --source-chain 42161 --dest-chain 8453 --source-token 0x0000000000000000000000000000000000000000 --dest-token 0x0000000000000000000000000000000000000000 --amount 300000000000000 --user 0xabc... --recipient 0xabc...
orbiter bridge tx --source-chain 42161 --dest-chain 42161 --source-token 0x0000000000000000000000000000000000000000 --dest-token 0xaf88d065e77c8cc2239327c5edb3a432268e5831 --amount 600000000000000 --user 0xabc... --recipient 0xabc... --action swap

# Flow (quote + signable tx + simulate)
orbiter bridge flow --source-chain 42161 --dest-chain 8453 --source-token 0x0000000000000000000000000000000000000000 --dest-token 0x0000000000000000000000000000000000000000 --amount 300000000000000 --user 0xabc... --recipient 0xabc... --chain 42161 --call-on-fail
orbiter bridge flow --source-chain 42161 --dest-chain 8453 --source-token 0x0000000000000000000000000000000000000000 --dest-token 0x0000000000000000000000000000000000000000 --amount-human 0.0006 --amount-decimals 18 --user 0xabc... --recipient 0xabc... --format summary

# Auto-approve ERC20 (if allowance is insufficient)
ORBITER_PRIVATE_KEY=... orbiter bridge flow --source-chain 42161 --dest-chain 8453 --source-token 0x... --dest-token 0x... --amount 1000000 --user 0xabc... --recipient 0xabc... --chain 42161 --auto-approve

# Same-chain swap (ETH -> USDC on Arbitrum)
orbiter bridge quote --source-chain 42161 --dest-chain 42161 --source-token 0x0000000000000000000000000000000000000000 --dest-token 0xaf88d065e77c8cc2239327c5edb3a432268e5831 --amount 600000000000000 --user 0xabc... --recipient 0xabc...

# Sign template and broadcast
orbiter bridge sign-template --source-chain 42161 --dest-chain 8453 --source-token 0x0000000000000000000000000000000000000000 --dest-token 0x0000000000000000000000000000000000000000 --amount 300000000000000 --user 0xabc... --recipient 0xabc... --chain 42161
orbiter bridge sign --template-file ./template.json --chain-id 42161
orbiter bridge sign-broadcast --template-file ./template.json --chain-id 42161 --chain 42161

# RPC health
orbiter rpc health --chain 42161
```

## Wallet Portfolio

```bash
orbiter portfolio --vm EVM --address 0xabc...
orbiter portfolio --vm EVM --address 0xabc... --raw
```

## Sign-Broadcast Auto Enrichment

If the template is missing `nonce`/`gasLimit`/fee fields, `sign-broadcast` will auto-enrich them
when `--rpc-url` (or `--chain`) is provided. If `from` is missing, it is derived from the private key.

By default, `sign-broadcast` validates the RPC chainId. Use `--skip-chain-check` to disable.

## Publish

```bash
pnpm --filter @orbiter-finance/cli publish --access public
```
