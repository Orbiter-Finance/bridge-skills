# Orbiter Chain Status (Deprecated)

The public API does not provide a chain congestion status endpoint. Use `orbiter_chains` for a basic chain list.

## When to Use
- You need to display chain status or latency hints

## Inputs
- `chainId` (number)

## Outputs
- `status` (ok | degraded | down)
- `congestion`

## CLI Example
```bash
orbiter chain-status --chain 42161
```
