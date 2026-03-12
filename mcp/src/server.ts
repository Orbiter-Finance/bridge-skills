import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  OrbiterClient,
  buildSignableTx,
  extractApproveQuoteTx,
  extractBridgeQuoteTx,
  extractFirstQuoteTx,
  erc20Allowance,
  parseApproveData,
  fromHexQuantity,
  parseRevertReason,
  rpcChainId,
  rpcClientVersion,
  rpcCallContract,
  rpcEstimateGas,
  rpcFeeHistory,
  rpcGasPrice,
  rpcGetTransactionCount,
  rpcMaxPriorityFeePerGas,
  resolveRpcUrl,
  rpcSendRawTransaction,
  toHexQuantity,
  withHexValue
} from "@orbiter-finance/orbiter-api";
import { Wallet } from "ethers";

const baseUrl = process.env.ORBITER_API_BASE_URL ?? "https://openapi.orbiter.finance";

const client = new OrbiterClient({
  baseUrl,
  apiKey: process.env.ORBITER_API_KEY
});


async function buildSignTemplate(opts: {
  rpcUrl: string;
  from: string;
  to: string;
  data?: string;
  value?: string;
  gasLimit?: string;
}): Promise<Record<string, string>> {
  const [nonceHex, gasPriceHex] = await Promise.all([
    rpcGetTransactionCount(opts.rpcUrl, opts.from, "pending"),
    rpcGasPrice(opts.rpcUrl)
  ]);
  let maxPriorityFeePerGasHex: string | undefined;
  let maxFeePerGasHex: string | undefined;
  try {
    maxPriorityFeePerGasHex = await rpcMaxPriorityFeePerGas(opts.rpcUrl);
    const feeHistory = await rpcFeeHistory(opts.rpcUrl, 1, "latest", []);
    const baseFeeHex = feeHistory.baseFeePerGas?.slice(-1)[0];
    if (baseFeeHex && maxPriorityFeePerGasHex) {
      const base = fromHexQuantity(baseFeeHex) ?? 0n;
      const prio = fromHexQuantity(maxPriorityFeePerGasHex) ?? 0n;
      maxFeePerGasHex = toHexQuantity((base * 2n + prio).toString());
    }
  } catch {
    // ignore, fallback to gasPrice only
  }

  let gasLimitHex = opts.gasLimit ? toHexQuantity(opts.gasLimit) : undefined;
  if (!gasLimitHex) {
    const estimateHex = await rpcEstimateGas(
      opts.rpcUrl,
      withHexValue({
        from: opts.from,
        to: opts.to,
        data: opts.data,
        value: opts.value
      })
    );
    const estimate = fromHexQuantity(estimateHex) ?? 0n;
    const buffered = estimate + estimate / 5n;
    gasLimitHex = toHexQuantity(buffered.toString());
  }

  const template: Record<string, string> = {
    from: opts.from,
    to: opts.to,
    data: opts.data ?? "0x"
  };
  if (opts.value) template.value = toHexQuantity(opts.value) ?? "0x0";
  if (gasLimitHex) template.gasLimit = gasLimitHex;
  template.nonce = nonceHex;
  if (maxFeePerGasHex && maxPriorityFeePerGasHex) {
    template.maxFeePerGas = maxFeePerGasHex;
    template.maxPriorityFeePerGas = maxPriorityFeePerGasHex;
  } else {
    template.gasPrice = gasPriceHex;
  }
  return template;
}

const server = new McpServer({
  name: "orbiter-mcp",
  version: "0.1.1"
});

server.registerTool(
  "orbiter_chains",
  {
    description: "List supported chains for bridging.",
    inputSchema: z.object({})
  },
  async () => {
    const result = await client.chains();
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

server.registerTool(
  "orbiter_tokens",
  {
    description: "Query tokens by chain and symbol/address prefix.",
    inputSchema: z.object({
      chainId: z.string().optional(),
      addressOrPrefix: z.string().optional()
    })
  },
  async ({ chainId, addressOrPrefix }) => {
    const result = await client.tokens({ chainId, addressOrPrefix });
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

server.registerTool(
  "orbiter_bridge_quote",
  {
    description: "Get bridge quote and transaction steps for a cross-chain transfer.",
    inputSchema: z.object({
      sourceChainId: z.string(),
      destChainId: z.string(),
      sourceToken: z.string(),
      destToken: z.string(),
      amount: z.string(),
      userAddress: z.string(),
      targetRecipient: z.string(),
      slippage: z.number().optional(),
      feeConfig: z
        .object({
          feeRecipient: z.string(),
          feePercent: z.string()
        })
        .optional(),
      channel: z.string().optional()
    })
  },
  async (input) => {
    const result = await client.quote(input);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

server.registerTool(
  "orbiter_bridge_tx",
  {
    description:
      "Derive the first transaction step from a quote input. Uses /quote then extracts steps[0].tx.",
    inputSchema: z.object({
      sourceChainId: z.string(),
      destChainId: z.string(),
      sourceToken: z.string(),
      destToken: z.string(),
      amount: z.string(),
      userAddress: z.string(),
      targetRecipient: z.string(),
      slippage: z.number().optional(),
      feeConfig: z
        .object({
          feeRecipient: z.string(),
          feePercent: z.string()
        })
        .optional(),
      channel: z.string().optional()
    })
  },
  async (input) => {
    const quote = await client.quote(input);
    const tx = extractFirstQuoteTx(quote);
    return {
      content: [{ type: "text", text: JSON.stringify({ tx, quote }) }]
    };
  }
);

server.registerTool(
  "orbiter_bridge_flow",
  {
    description:
      "Full bridge flow: quote, derive signable tx, optional simulate via RPC. Does not sign or broadcast.",
    inputSchema: z.object({
      sourceChainId: z.string(),
      destChainId: z.string(),
      sourceToken: z.string(),
      destToken: z.string(),
      amount: z.string(),
      userAddress: z.string(),
      targetRecipient: z.string(),
      slippage: z.number().optional(),
      feeConfig: z
        .object({
          feeRecipient: z.string(),
          feePercent: z.string()
        })
        .optional(),
      channel: z.string().optional(),
      rpcUrl: z.string().optional(),
      chainId: z.string().optional(),
      simulate: z.boolean().optional(),
      callOnFail: z.boolean().optional(),
      autoApprove: z.boolean().optional(),
      privateKey: z.string().optional()
    })
  },
  async (input) => {
    const quote = await client.quote(input);
    const signableTx = buildSignableTx(quote, input.sourceChainId);
    const approveTx = extractApproveQuoteTx(quote);
    let approveInfo: Record<string, unknown> | undefined;
    let simulateResult: Record<string, unknown> | undefined;
    const shouldSimulate = input.simulate !== false;
    if (shouldSimulate) {
      const url = await resolveRpcUrl({
        rpcUrl: input.rpcUrl,
        chainId: input.chainId,
        fallbackChainId: input.sourceChainId
      });
      const tx = signableTx ?? extractBridgeQuoteTx(quote) ?? extractFirstQuoteTx(quote);
      if (!tx) {
        throw new Error("Missing tx in quote");
      }
      try {
        const gasEstimate = await rpcEstimateGas(
          url,
          withHexValue({
          from: input.userAddress,
          to: tx.to,
          data: tx.data,
          value: tx.value
          })
        );
        simulateResult = { ok: true, gasEstimate };
      } catch (err) {
        if (!input.callOnFail) {
          simulateResult = { ok: false, reason: String(err) };
        } else {
          try {
            const revertData = await rpcCallContract(
              url,
              withHexValue({
              from: input.userAddress,
              to: tx.to,
              data: tx.data,
              value: tx.value
              })
            );
            const reason = parseRevertReason(revertData) ?? "Unknown revert";
            simulateResult = { ok: false, reason, revertData };
          } catch (err2) {
            simulateResult = { ok: false, reason: String(err2) };
          }
        }
      }
    }
    if (approveTx) {
      try {
        const url = await resolveRpcUrl({
          rpcUrl: input.rpcUrl,
          chainId: input.chainId,
          fallbackChainId: input.sourceChainId
        });
        const parsed = parseApproveData(approveTx.data);
        if (parsed) {
          const allowance = await erc20Allowance(
            url,
            approveTx.to,
            input.userAddress,
            parsed.spender
          );
          const approveRequired = allowance < parsed.amount;
          approveInfo = {
            approveRequired,
            allowance: allowance.toString(),
            spender: parsed.spender,
            amount: parsed.amount.toString(),
            tx: approveTx
          };
          if (approveRequired && input.autoApprove) {
            if (!input.privateKey) {
              throw new Error("Missing privateKey for autoApprove");
            }
            const wallet = new Wallet(input.privateKey);
            if (wallet.address.toLowerCase() !== input.userAddress.toLowerCase()) {
              throw new Error("privateKey does not match userAddress");
            }
            const template = await buildSignTemplate({
              rpcUrl: url,
              from: input.userAddress,
              to: approveTx.to,
              data: approveTx.data,
              value: approveTx.value
            });
            const signedApprove = await wallet.signTransaction({
              ...template,
              chainId: Number(input.sourceChainId)
            });
            const approveTxHash = await rpcSendRawTransaction(url, signedApprove);
            approveInfo = { ...approveInfo, approveTxHash };
          }
        }
      } catch {
        // ignore allowance failures
      }
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ quote, signableTx, approve: approveInfo, simulate: simulateResult })
        }
      ]
    };
  }
);

server.registerTool(
  "orbiter_sign_template",
  {
    description:
      "Build a signable tx template from a quote. Optionally enrich with nonce and fee data via RPC.",
    inputSchema: z.object({
      sourceChainId: z.string(),
      destChainId: z.string(),
      sourceToken: z.string(),
      destToken: z.string(),
      amount: z.string(),
      userAddress: z.string(),
      targetRecipient: z.string(),
      slippage: z.number().optional(),
      feeConfig: z
        .object({
          feeRecipient: z.string(),
          feePercent: z.string()
        })
        .optional(),
      channel: z.string().optional(),
      rpcUrl: z.string().optional(),
      chainId: z.string().optional()
    })
  },
  async (input) => {
    const quote = await client.quote(input);
    const tx = extractBridgeQuoteTx(quote) ?? extractFirstQuoteTx(quote);
    if (!tx) {
      throw new Error("Missing tx in quote");
    }
    const url = await resolveRpcUrl({
      rpcUrl: input.rpcUrl,
      chainId: input.chainId,
      fallbackChainId: input.sourceChainId
    });
    const template = await buildSignTemplate({
      rpcUrl: url,
      from: input.userAddress,
      to: tx.to,
      data: tx.data,
      value: tx.value,
      gasLimit: tx.gasLimit
    });
    return {
      content: [{ type: "text", text: JSON.stringify({ tx, quote, template }) }]
    };
  }
);

server.registerTool(
  "orbiter_transaction",
  {
    description: "Query a bridge transaction by hash.",
    inputSchema: z.object({
      hash: z.string()
    })
  },
  async ({ hash }) => {
    const result = await client.transaction(hash);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

server.registerTool(
  "orbiter_wallet_portfolio",
  {
    description: "Query a wallet portfolio by VM and address.",
    inputSchema: z.object({
      vm: z.string(),
      address: z.string()
    })
  },
  async ({ vm, address }) => {
    const result = await client.walletPortfolio(vm, address);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

server.registerTool(
  "orbiter_rpc_health",
  {
    description: "Check a JSON-RPC endpoint health via eth_chainId and client version.",
    inputSchema: z.object({
      rpcUrl: z.string().optional(),
      chainId: z.string().optional()
    })
  },
  async ({ rpcUrl, chainId }) => {
    const url = await resolveRpcUrl({ rpcUrl, chainId });
    const started = Date.now();
    const [rpcChainIdHex, clientVersion] = await Promise.all([
      rpcChainId(url),
      rpcClientVersion(url)
    ]);
    const rpcChainIdValue = rpcChainIdHex.startsWith("0x")
      ? String(parseInt(rpcChainIdHex, 16))
      : rpcChainIdHex;
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            ok: true,
            rpcChainId: rpcChainIdValue,
            clientVersion,
            latencyMs: Date.now() - started
          })
        }
      ]
    };
  }
);

server.registerTool(
  "orbiter_tx_simulate",
  {
    description:
      "Simulate a transaction via JSON-RPC using eth_estimateGas, with optional eth_call for revert reason.",
    inputSchema: z.object({
      rpcUrl: z.string().optional(),
      chainId: z.string().optional(),
      from: z.string().optional(),
      to: z.string(),
      data: z.string().optional(),
      value: z.string().optional(),
      callOnFail: z.boolean().optional()
    })
  },
  async ({ rpcUrl, chainId, from, to, data, value, callOnFail }) => {
    const url = await resolveRpcUrl({ rpcUrl, chainId });
    try {
    const gasEstimate = await rpcEstimateGas(url, withHexValue({ from, to, data, value }));
      return {
        content: [{ type: "text", text: JSON.stringify({ ok: true, gasEstimate }) }]
      };
    } catch (err) {
      if (!callOnFail) {
        return {
          content: [
            { type: "text", text: JSON.stringify({ ok: false, reason: String(err) }) }
          ]
        };
      }
      try {
        const revertData = await rpcCallContract(
          url,
          withHexValue({ from, to, data, value })
        );
        const reason = parseRevertReason(revertData) ?? "Unknown revert";
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: false, reason, revertData })
            }
          ]
        };
      } catch (err2) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: false, reason: String(err2) })
            }
          ]
        };
      }
    }
  }
);

server.registerTool(
  "orbiter_tx_broadcast",
  {
    description: "Broadcast a signed transaction via JSON-RPC eth_sendRawTransaction.",
    inputSchema: z.object({
      rpcUrl: z.string().optional(),
      chainId: z.string().optional(),
      signedTx: z.string()
    })
  },
  async ({ rpcUrl, chainId, signedTx }) => {
    const url = await resolveRpcUrl({ rpcUrl, chainId });
    const txHash = await rpcSendRawTransaction(url, signedTx);
    return {
      content: [{ type: "text", text: JSON.stringify({ txHash }) }]
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
