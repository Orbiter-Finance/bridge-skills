---
name: orbiter-tokens
description: Query tokens by chain and symbol/address prefix.
---

# Orbiter Tokens

Query token lists by chain and symbol/address prefix for discovery or validation.

## When to Use
- The user is unsure about a token symbol or address
- You need to search and confirm a token

## Inputs
- `chainId` (string, optional)
- `addressOrPrefix` (string, optional)

## Outputs
- Token list (as returned by the API)

## CLI Example
```bash
orbiter tokens --chain 42161 --prefix ETH
```
