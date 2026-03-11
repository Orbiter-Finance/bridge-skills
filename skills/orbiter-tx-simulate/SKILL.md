# Orbiter Tx Simulate

Preflight a transaction via JSON-RPC `eth_estimateGas`.

## When to Use
- You already have `to/data/value`
- You need a risk preflight

## Inputs
- `rpcUrl` (string, optional)
- `chainId` (string, optional, for rpc-map lookup)
- `from` (string, optional)
- `to` (string)
- `data` (string, optional)
- `value` (string, optional)
- `callOnFail` (boolean, optional)

## Outputs
- `ok`
- `gasEstimate`
- `warnings[]`
- `reason` (failure reason)

## CLI Example
```bash
orbiter bridge simulate \
  --rpc-url https://rpc.example \
  --from 0xabc... \
  --to 0xdef... \
  --data 0x1234 \
  --call-on-fail
```
