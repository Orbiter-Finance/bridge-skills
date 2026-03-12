---
name: orbiter-bridge-flow
description: One-click flow combining quote, signable tx, approval check, and optional simulation (no signing/broadcast).
---

# Orbiter Bridge Flow

A one-click flow that combines quote, tx build, approval check, and optional simulation. Does not include signing or broadcasting.

## When to Use
- You want a quote and a signable transaction in one step
- You need to know whether an ERC20 approve is required
- You want an RPC preflight before submitting

## Inputs
- `sourceChainId` (string)
- `destChainId` (string)
- `sourceToken` (string)
- `destToken` (string)
- `amount` (string)
- `userAddress` (string)
- `targetRecipient` (string)
- `slippage` (number, optional)
- `feeConfig` (object, optional)
- `channel` (string, optional)
- `rpcUrl` (string, optional)
- `chainId` (string, optional)
- `simulate` (boolean, optional)
- `callOnFail` (boolean, optional)

## Outputs
- `quote`
- `signableTx`
- `approve` (only when an approve step exists)
  - `approveRequired` (boolean)
  - `allowance` (string)
  - `spender` (string)
  - `amount` (string)
  - `tx` (approve transaction)
- `simulate`

## Notes
- If the route includes a swap, the `quote.steps` array will include a `swap` step.
- `signableTx` always points to the bridge step when available.

## CLI Example
```bash
orbiter bridge flow \
  --source-chain 42161 \
  --dest-chain 8453 \
  --source-token 0x0000000000000000000000000000000000000000 \
  --dest-token 0x0000000000000000000000000000000000000000 \
  --amount 300000000000000 \
  --user 0xabc... \
  --recipient 0xabc... \
  --chain 42161 \
  --call-on-fail
```
