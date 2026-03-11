# Orbiter Finance API SDK

A TypeScript SDK for Orbiter Finance OpenAPI and supporting RPC helpers.

## Install (Workspace)

```bash
pnpm -C .. install
```

## Usage

```ts
import { OrbiterClient } from "@orbiter-finance/orbiter-api";

const client = new OrbiterClient({
  baseUrl: "https://openapi.orbiter.finance",
  apiKey: process.env.ORBITER_API_KEY
});

const chains = await client.chains();
const tokens = await client.tokens({ chainId: "42161", addressOrPrefix: "ETH" });
```

## RPC Helpers

The SDK also exports RPC helpers used by CLI and MCP:
- `rpcEstimateGas`
- `rpcCallContract`
- `rpcSendRawTransaction`
- `rpcChainId`
- `rpcClientVersion`
- `rpcGetTransactionCount`
- `rpcGasPrice`
- `rpcMaxPriorityFeePerGas`
- `rpcFeeHistory`

## Publish

```bash
pnpm --filter @orbiter-finance/orbiter-api publish --access public
```
