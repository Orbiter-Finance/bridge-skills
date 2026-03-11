# Orbiter Bridge Flow

A one-click flow that combines quote, tx build, and optional simulation. Does not include signing or broadcasting.

## When to Use
- You want a quote and a signable transaction in one step
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
- `simulate`

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
