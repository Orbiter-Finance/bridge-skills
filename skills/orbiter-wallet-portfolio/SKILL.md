---
name: orbiter-wallet-portfolio
description: Deprecated: cross-chain portfolio is not available from public API.
---

# Orbiter Wallet Portfolio (Deprecated)

The public API does not provide cross-chain portfolio aggregation.

## When to Use
- The user has not clarified asset sources
- You need to show a cross-chain portfolio overview

## Inputs
- `address` (string)

## Outputs
- `totalUsd`
- `assets[]`

## CLI Example
```bash
orbiter portfolio --address 0xabc...
```
