---
name: orbiter-wallet-portfolio
description: Query wallet portfolio by VM type and address.
---

# Orbiter Wallet Portfolio

Query wallet portfolio by VM type and address.

## When to Use
- You need a wallet asset overview by VM (e.g., EVM)

## Inputs
- `vm` (string, e.g. `EVM`)
- `address` (string)

## Outputs
- Portfolio data (as returned by the API)

## CLI Example
```bash
orbiter portfolio --vm EVM --address 0xabc...
```
