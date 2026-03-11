# Orbiter Tx Track (Deprecated)

The public API does not provide order ID queries. Use `orbiter_transaction` with a transaction hash.

## When to Use
- A transaction has been broadcast
- You need to confirm success, failure, or timeout

## Inputs
- `hash` (string)

## Outputs
- `status` (2=success, 3=failure)
- `opStatus`

## CLI Example
```bash
orbiter transaction --hash 0x...
```
