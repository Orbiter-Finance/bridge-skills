---
name: orbiter-bridge-tx
description: Derive the bridge transaction step from quote input (skips approve).
---

# Orbiter Bridge Tx

Derive the bridge transaction step from quote input so it can be signed and broadcast directly.

## When to Use
- You want tx data without parsing the `quote` response
- You want the actual bridge tx (not the approve or swap tx)

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

## Outputs
- `tx` (data/to/value/gasLimit)
- `quote` (original quote, including fees and details)

## CLI Example
```bash
orbiter bridge tx \
  --source-chain 42161 \
  --dest-chain 8453 \
  --source-token 0x0000000000000000000000000000000000000000 \
  --dest-token 0x0000000000000000000000000000000000000000 \
  --amount 300000000000000 \
  --user 0xabc... \
  --recipient 0xabc...
```
