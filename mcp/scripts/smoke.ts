import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve } from "node:path";

const baseUrl = process.env.ORBITER_API_BASE_URL ?? "https://openapi.orbiter.finance";

const transport = new StdioClientTransport({
  command: "tsx",
  args: ["src/server.ts"],
  cwd: resolve(process.cwd()),
  env: {
    ...process.env,
    ORBITER_API_BASE_URL: baseUrl,
    ORBITER_API_KEY: process.env.ORBITER_API_KEY ?? ""
  },
  stderr: "inherit"
});

const client = new Client(
  {
    name: "orbiter-mcp-smoke",
    version: "0.1.0"
  },
  {
    capabilities: {}
  }
);

await client.connect(transport);

const tools = await client.listTools();
console.log("tools:", tools.tools.map((t) => t.name));

const chains = await client.callTool({ name: "orbiter_chains", arguments: {} });
console.log("chains:", chains.content?.[0]?.type ?? "ok");

const tokens = await client.callTool({
  name: "orbiter_tokens",
  arguments: { chainId: "42161", addressOrPrefix: "ETH" }
});
console.log("tokens:", tokens.content?.[0]?.type ?? "ok");

const rpcUrl = process.env.ORBITER_RPC_URL;
if (rpcUrl) {
  const health = await client.callTool({
    name: "orbiter_rpc_health",
    arguments: { rpcUrl }
  });
  console.log("rpc_health:", health.content?.[0]?.type ?? "ok");
}

if (process.env.ORBITER_SMOKE_QUOTE === "1") {
  const quote = await client.callTool({
    name: "orbiter_bridge_quote",
    arguments: {
      sourceChainId: "42161",
      destChainId: "8453",
      sourceToken: "0x0000000000000000000000000000000000000000",
      destToken: "0x0000000000000000000000000000000000000000",
      amount: "300000000000000",
      userAddress: "0xefc6089224068b20197156a91d50132b2a47b908",
      targetRecipient: "0xefc6089224068b20197156a91d50132b2a47b908"
    }
  });
  console.log("bridge_quote:", quote.content?.[0]?.type ?? "ok");
}

if (process.env.ORBITER_SMOKE_SIGN_TEMPLATE === "1") {
  const args: Record<string, string> = {
    sourceChainId: "42161",
    destChainId: "8453",
    sourceToken: "0x0000000000000000000000000000000000000000",
    destToken: "0x0000000000000000000000000000000000000000",
    amount: "300000000000000",
    userAddress: "0xefc6089224068b20197156a91d50132b2a47b908",
    targetRecipient: "0xefc6089224068b20197156a91d50132b2a47b908"
  };
  if (rpcUrl) {
    args.rpcUrl = rpcUrl;
  }
  const signTemplate = await client.callTool({
    name: "orbiter_sign_template",
    arguments: args
  });
  console.log("sign_template:", signTemplate.content?.[0]?.type ?? "ok");
}

if (process.env.ORBITER_SMOKE_FLOW === "1") {
  const flowArgs: Record<string, string | boolean> = {
    sourceChainId: "42161",
    destChainId: "8453",
    sourceToken: "0x0000000000000000000000000000000000000000",
    destToken: "0x0000000000000000000000000000000000000000",
    amount: "300000000000000",
    userAddress: "0xefc6089224068b20197156a91d50132b2a47b908",
    targetRecipient: "0xefc6089224068b20197156a91d50132b2a47b908"
  };
  if (rpcUrl) {
    flowArgs.rpcUrl = rpcUrl;
    flowArgs.simulate = true;
  }
  const flow = await client.callTool({
    name: "orbiter_bridge_flow",
    arguments: flowArgs
  });
  console.log("bridge_flow:", flow.content?.[0]?.type ?? "ok");
}

if (process.env.ORBITER_SMOKE_SIMULATE === "1") {
  if (!rpcUrl) {
    throw new Error("Missing ORBITER_RPC_URL for ORBITER_SMOKE_SIMULATE");
  }
  const sim = await client.callTool({
    name: "orbiter_tx_simulate",
    arguments: {
      rpcUrl,
      to: "0x0000000000000000000000000000000000000000",
      data: "0x"
    }
  });
  console.log("tx_simulate:", sim.content?.[0]?.type ?? "ok");
}

if (process.env.ORBITER_SMOKE_BROADCAST === "1") {
  if (!rpcUrl) {
    throw new Error("Missing ORBITER_RPC_URL for ORBITER_SMOKE_BROADCAST");
  }
  const signedTx = process.env.ORBITER_SMOKE_SIGNED_TX;
  if (!signedTx) {
    throw new Error("Missing ORBITER_SMOKE_SIGNED_TX for ORBITER_SMOKE_BROADCAST");
  }
  const broadcast = await client.callTool({
    name: "orbiter_tx_broadcast",
    arguments: { rpcUrl, signedTx }
  });
  console.log("tx_broadcast:", broadcast.content?.[0]?.type ?? "ok");
}

await client.close();
