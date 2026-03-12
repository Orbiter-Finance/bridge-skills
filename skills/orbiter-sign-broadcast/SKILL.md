---
name: orbiter-sign-broadcast
description: Sign a tx template locally and broadcast it to the chain.
---

# Orbiter Sign Broadcast

Sign a transaction template with a local private key and broadcast it to the chain.

## When to Use
- You already have a transaction template (from `orbiter_sign_template` or external sources)
- You want a one-step sign + broadcast

## Inputs
- `template` (string, JSON)
- `templateFile` (string, file path)
- `privateKey` (string, optional, recommended via `ORBITER_PRIVATE_KEY`)
- `chainId` (string)
- `rpcUrl` (string, optional)
- `chain` (string, optional)

## Behavior
- If `nonce`/`gasLimit`/fee fields are missing, the command auto-enriches them when `rpcUrl` (or `chain`) is provided.
- If `from` is missing, it is derived from the private key.

## Outputs
- `txHash`

## Security Notes
The private key is only used for local signing. It is never written to disk or sent over the network.

## CLI Example
```bash
ORBITER_PRIVATE_KEY=... orbiter bridge sign-broadcast \
  --template-file ./template.json \
  --chain-id 42161 \
  --rpc-url https://arb1.arbitrum.io/rpc
```
