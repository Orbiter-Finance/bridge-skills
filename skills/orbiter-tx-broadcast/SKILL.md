# Orbiter Tx Broadcast

Broadcast a signed transaction via JSON-RPC `eth_sendRawTransaction`.

## When to Use
- Signing is complete
- You need to broadcast on-chain

## Inputs
- `rpcUrl` (string, optional)
- `chainId` (string, optional, for rpc-map lookup)
- `signedTx` (string)

## Outputs
- `txHash`

## CLI Example
```bash
orbiter bridge broadcast \
  --rpc-url https://rpc.example \
  --signed-tx 0x...
```
