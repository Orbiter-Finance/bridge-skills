#!/usr/bin/env node
import { Command } from "commander";
import {
  OrbiterClient,
  buildSignableTx,
  extractFirstQuoteTx,
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
  loadRpcMap,
  rpcSendRawTransaction,
  toHexQuantity,
  withHexValue
} from "@orbiter-finance/orbiter-api";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { inspect } from "node:util";
import { Wallet } from "ethers";

const program = new Command();

function reportError(err: unknown): void {
  console.error(inspect(err, { depth: 6, colors: false }));
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
}

process.on("unhandledRejection", (err) => {
  reportError(err);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  reportError(err);
  process.exit(1);
});

function getClient(): OrbiterClient {
  const baseUrl = process.env.ORBITER_API_BASE_URL ?? "https://openapi.orbiter.finance";
  return new OrbiterClient({
    baseUrl,
    apiKey: process.env.ORBITER_API_KEY
  });
}

function normalizeChainIdHex(hex: string): string {
  if (!hex.startsWith("0x")) return hex;
  return String(parseInt(hex, 16));
}

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

async function readTemplate(input?: string): Promise<Record<string, string>> {
  if (!input) {
    throw new Error("Missing --template or --template-file");
  }
  if (input.trim().startsWith("{")) {
    return JSON.parse(input) as Record<string, string>;
  }
  const path = resolve(process.cwd(), input);
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as Record<string, string>;
}

function requirePrivateKey(cliKey?: string): string {
  const key = cliKey ?? process.env.ORBITER_PRIVATE_KEY;
  if (!key) {
    throw new Error("Missing private key. Set ORBITER_PRIVATE_KEY or pass --private-key.");
  }
  if (!key.startsWith("0x") && key.length === 64) {
    return `0x${key}`;
  }
  return key;
}

program.name("orbiter").description("Orbiter Finance CLI").version("0.1.0");

const bridge = program.command("bridge").description("Bridge operations");

bridge
  .command("quote")
  .requiredOption("--source-chain <id>", "Source chain id")
  .requiredOption("--dest-chain <id>", "Destination chain id")
  .requiredOption("--source-token <addr>", "Source token address")
  .requiredOption("--dest-token <addr>", "Destination token address")
  .requiredOption("--amount <amount>", "Amount to send")
  .requiredOption("--user <address>", "User wallet address")
  .requiredOption("--recipient <address>", "Recipient address")
  .option("--slippage <number>", "Slippage tolerance, e.g. 0.02")
  .option("--fee-recipient <address>", "Fee recipient address")
  .option("--fee-percent <number>", "Fee percent, e.g. 0.1")
  .option("--channel <string>", "Dapp name or commission wallet address")
  .action(async (opts) => {
    const client = getClient();
    const result = await client.quote({
      sourceChainId: String(opts.sourceChain),
      destChainId: String(opts.destChain),
      sourceToken: opts.sourceToken,
      destToken: opts.destToken,
      amount: opts.amount,
      userAddress: opts.user,
      targetRecipient: opts.recipient,
      slippage: opts.slippage ? Number(opts.slippage) : undefined,
      feeConfig:
        opts.feeRecipient && opts.feePercent
          ? { feeRecipient: opts.feeRecipient, feePercent: String(opts.feePercent) }
          : undefined,
      channel: opts.channel
    });
    console.log(JSON.stringify(result, null, 2));
  });

bridge
  .command("tx")
  .requiredOption("--source-chain <id>", "Source chain id")
  .requiredOption("--dest-chain <id>", "Destination chain id")
  .requiredOption("--source-token <addr>", "Source token address")
  .requiredOption("--dest-token <addr>", "Destination token address")
  .requiredOption("--amount <amount>", "Amount to send")
  .requiredOption("--user <address>", "User wallet address")
  .requiredOption("--recipient <address>", "Recipient address")
  .option("--slippage <number>", "Slippage tolerance, e.g. 0.02")
  .option("--fee-recipient <address>", "Fee recipient address")
  .option("--fee-percent <number>", "Fee percent, e.g. 0.1")
  .option("--channel <string>", "Dapp name or commission wallet address")
  .action(async (opts) => {
    const client = getClient();
    const quote = await client.quote({
      sourceChainId: String(opts.sourceChain),
      destChainId: String(opts.destChain),
      sourceToken: opts.sourceToken,
      destToken: opts.destToken,
      amount: opts.amount,
      userAddress: opts.user,
      targetRecipient: opts.recipient,
      slippage: opts.slippage ? Number(opts.slippage) : undefined,
      feeConfig:
        opts.feeRecipient && opts.feePercent
          ? { feeRecipient: opts.feeRecipient, feePercent: String(opts.feePercent) }
          : undefined,
      channel: opts.channel
    });
    const tx = extractFirstQuoteTx(quote);
    console.log(JSON.stringify({ tx, quote }, null, 2));
  });

bridge
  .command("flow")
  .requiredOption("--source-chain <id>", "Source chain id")
  .requiredOption("--dest-chain <id>", "Destination chain id")
  .requiredOption("--source-token <addr>", "Source token address")
  .requiredOption("--dest-token <addr>", "Destination token address")
  .requiredOption("--amount <amount>", "Amount to send")
  .requiredOption("--user <address>", "User wallet address")
  .requiredOption("--recipient <address>", "Recipient address")
  .option("--slippage <number>", "Slippage tolerance, e.g. 0.02")
  .option("--fee-recipient <address>", "Fee recipient address")
  .option("--fee-percent <number>", "Fee percent, e.g. 0.1")
  .option("--channel <string>", "Dapp name or commission wallet address")
  .option("--rpc-url <url>", "JSON-RPC URL (for simulate)")
  .option("--chain <id>", "Chain id for rpc-map lookup (for simulate)")
  .option("--call-on-fail", "Run eth_call to extract revert reason on failure")
  .option("--no-simulate", "Skip simulation")
  .action(async (opts) => {
    const client = getClient();
    const quote = await client.quote({
      sourceChainId: String(opts.sourceChain),
      destChainId: String(opts.destChain),
      sourceToken: opts.sourceToken,
      destToken: opts.destToken,
      amount: opts.amount,
      userAddress: opts.user,
      targetRecipient: opts.recipient,
      slippage: opts.slippage ? Number(opts.slippage) : undefined,
      feeConfig:
        opts.feeRecipient && opts.feePercent
          ? { feeRecipient: opts.feeRecipient, feePercent: String(opts.feePercent) }
          : undefined,
      channel: opts.channel
    });
    const signableTx = buildSignableTx(quote, String(opts.sourceChain));
    let simulateResult: Record<string, unknown> | undefined;
    if (opts.simulate) {
      const rpcUrl = await resolveRpcUrl({
        rpcUrl: opts.rpcUrl,
        chainId: opts.chain,
        fallbackChainId: String(opts.sourceChain)
      });
      const tx = signableTx ?? extractFirstQuoteTx(quote);
      if (!tx) {
        throw new Error("Missing tx in quote");
      }
      try {
        const gasEstimate = await rpcEstimateGas(
          rpcUrl,
          withHexValue({
            from: opts.user,
            to: tx.to,
            data: tx.data,
            value: tx.value
          })
        );
        simulateResult = { ok: true, gasEstimate };
      } catch (err) {
        if (!opts.callOnFail) {
          simulateResult = { ok: false, reason: String(err) };
        } else {
          try {
            const revertData = await rpcCallContract(
              rpcUrl,
              withHexValue({
              from: opts.user,
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
    console.log(JSON.stringify({ quote, signableTx, simulate: simulateResult }, null, 2));
  });

bridge
  .command("sign-template")
  .requiredOption("--source-chain <id>", "Source chain id")
  .requiredOption("--dest-chain <id>", "Destination chain id")
  .requiredOption("--source-token <addr>", "Source token address")
  .requiredOption("--dest-token <addr>", "Destination token address")
  .requiredOption("--amount <amount>", "Amount to send")
  .requiredOption("--user <address>", "User wallet address")
  .requiredOption("--recipient <address>", "Recipient address")
  .option("--slippage <number>", "Slippage tolerance, e.g. 0.02")
  .option("--fee-recipient <address>", "Fee recipient address")
  .option("--fee-percent <number>", "Fee percent, e.g. 0.1")
  .option("--channel <string>", "Dapp name or commission wallet address")
  .option("--rpc-url <url>", "JSON-RPC URL (optional)")
  .option("--chain <id>", "Chain id for rpc-map lookup (optional)")
  .action(async (opts) => {
    const client = getClient();
    const quote = await client.quote({
      sourceChainId: String(opts.sourceChain),
      destChainId: String(opts.destChain),
      sourceToken: opts.sourceToken,
      destToken: opts.destToken,
      amount: opts.amount,
      userAddress: opts.user,
      targetRecipient: opts.recipient,
      slippage: opts.slippage ? Number(opts.slippage) : undefined,
      feeConfig:
        opts.feeRecipient && opts.feePercent
          ? { feeRecipient: opts.feeRecipient, feePercent: String(opts.feePercent) }
          : undefined,
      channel: opts.channel
    });
    const tx = extractFirstQuoteTx(quote);
    if (!tx) {
      throw new Error("Missing tx in quote");
    }
    const rpcUrl = await resolveRpcUrl({
      rpcUrl: opts.rpcUrl,
      chainId: opts.chain,
      fallbackChainId: String(opts.sourceChain)
    });
    const template = await buildSignTemplate({
      rpcUrl,
      from: opts.user,
      to: tx.to,
      data: tx.data,
      value: tx.value,
      gasLimit: tx.gasLimit
    });
    console.log(JSON.stringify({ tx, quote, template }, null, 2));
  });

bridge
  .command("sign")
  .description("Sign a transaction template (requires local private key)")
  .option("--template <json>", "Template JSON string")
  .option("--template-file <path>", "Path to template JSON file")
  .option("--private-key <hex>", "Private key (use env ORBITER_PRIVATE_KEY instead)")
  .option("--chain-id <id>", "Chain id for signing")
  .action(async (opts) => {
    const template = await readTemplate(opts.template ?? opts.templateFile);
    const privateKey = requirePrivateKey(opts.privateKey);
    const chainId =
      template.chainId ?? (opts.chainId ? String(opts.chainId) : undefined);
    if (!chainId) {
      throw new Error("Missing chainId in template or --chain-id");
    }
    const wallet = new Wallet(privateKey);
    const signedTx = await wallet.signTransaction({
      ...template,
      chainId: Number(chainId)
    });
    console.log(JSON.stringify({ signedTx }, null, 2));
  });

bridge
  .command("sign-broadcast")
  .description("Sign a transaction template and broadcast it via RPC")
  .option("--template <json>", "Template JSON string")
  .option("--template-file <path>", "Path to template JSON file")
  .option("--private-key <hex>", "Private key (use env ORBITER_PRIVATE_KEY instead)")
  .option("--chain-id <id>", "Chain id for signing")
  .option("--rpc-url <url>", "JSON-RPC URL")
  .option("--chain <id>", "Chain id for rpc-map lookup")
  .action(async (opts) => {
    const template = await readTemplate(opts.template ?? opts.templateFile);
    const privateKey = requirePrivateKey(opts.privateKey);
    const wallet = new Wallet(privateKey);
    const chainId =
      template.chainId ?? (opts.chainId ? String(opts.chainId) : undefined);
    if (!chainId) {
      throw new Error("Missing chainId in template or --chain-id");
    }
    if (template.from && template.from.toLowerCase() !== wallet.address.toLowerCase()) {
      throw new Error("Template from does not match the private key address.");
    }
    const fromAddress = template.from ?? wallet.address;
    const needsEnrich =
      !template.nonce ||
      (!template.gasLimit &&
        !template.gas &&
        !template.gasPrice &&
        (!template.maxFeePerGas || !template.maxPriorityFeePerGas));
    if (needsEnrich) {
      const rpcUrl = await resolveRpcUrl({
        rpcUrl: opts.rpcUrl,
        chainId: opts.chain ?? chainId
      });
      const enriched = await buildSignTemplate({
        rpcUrl,
        from: fromAddress,
        to: template.to,
        data: template.data,
        value: template.value,
        gasLimit: template.gasLimit
      });
      Object.assign(template, enriched);
    }
    const signedTx = await wallet.signTransaction({
      ...template,
      chainId: Number(chainId)
    });
    if (opts.privateKey) {
      console.warn("Warning: --private-key exposes sensitive data in shell history.");
    }
    const rpcUrl = await resolveRpcUrl({
      rpcUrl: opts.rpcUrl,
      chainId: opts.chain ?? chainId
    });
    const txHash = await rpcSendRawTransaction(rpcUrl, signedTx);
    console.log(JSON.stringify({ txHash }, null, 2));
  });

bridge
  .command("e2e")
  .description("Quote -> sign-template -> sign -> broadcast -> transaction query")
  .requiredOption("--source-chain <id>", "Source chain id")
  .requiredOption("--dest-chain <id>", "Destination chain id")
  .requiredOption("--source-token <addr>", "Source token address")
  .requiredOption("--dest-token <addr>", "Destination token address")
  .requiredOption("--amount <amount>", "Amount to send")
  .requiredOption("--user <address>", "User wallet address")
  .requiredOption("--recipient <address>", "Recipient address")
  .option("--slippage <number>", "Slippage tolerance, e.g. 0.02")
  .option("--fee-recipient <address>", "Fee recipient address")
  .option("--fee-percent <number>", "Fee percent, e.g. 0.1")
  .option("--channel <string>", "Dapp name or commission wallet address")
  .option("--rpc-url <url>", "JSON-RPC URL")
  .option("--chain <id>", "Chain id for rpc-map lookup")
  .option("--private-key <hex>", "Private key (use env ORBITER_PRIVATE_KEY instead)")
  .option("--poll-count <n>", "Transaction query attempts", "5")
  .option("--poll-interval <ms>", "Interval between queries", "5000")
  .option("--skip-transaction", "Skip transaction query")
  .action(async (opts) => {
    const client = getClient();
    const quote = await client.quote({
      sourceChainId: String(opts.sourceChain),
      destChainId: String(opts.destChain),
      sourceToken: opts.sourceToken,
      destToken: opts.destToken,
      amount: opts.amount,
      userAddress: opts.user,
      targetRecipient: opts.recipient,
      slippage: opts.slippage ? Number(opts.slippage) : undefined,
      feeConfig:
        opts.feeRecipient && opts.feePercent
          ? { feeRecipient: opts.feeRecipient, feePercent: String(opts.feePercent) }
          : undefined,
      channel: opts.channel
    });
    const tx = extractFirstQuoteTx(quote);
    if (!tx) {
      throw new Error("Missing tx in quote");
    }
    const rpcUrl = await resolveRpcUrl({
      rpcUrl: opts.rpcUrl,
      chainId: opts.chain,
      fallbackChainId: String(opts.sourceChain)
    });
    const template = await buildSignTemplate({
      rpcUrl,
      from: opts.user,
      to: tx.to,
      data: tx.data,
      value: tx.value,
      gasLimit: tx.gasLimit
    });
    const privateKey = requirePrivateKey(opts.privateKey);
    const wallet = new Wallet(privateKey);
    const signedTx = await wallet.signTransaction({
      ...template,
      chainId: Number(opts.sourceChain)
    });
    const txHash = await rpcSendRawTransaction(rpcUrl, signedTx);

    let transactionResult: unknown = undefined;
    if (!opts.skipTransaction) {
      const attempts = Number(opts.pollCount);
      const interval = Number(opts.pollInterval);
      for (let i = 0; i < attempts; i += 1) {
        const res = await client.transaction(txHash);
        if (res.result) {
          transactionResult = res;
          break;
        }
        await new Promise((r) => setTimeout(r, interval));
      }
    }

    console.log(JSON.stringify({ txHash, transaction: transactionResult }, null, 2));
  });

bridge
  .command("simulate")
  .option("--rpc-url <url>", "JSON-RPC URL")
  .option("--chain <id>", "Chain id for rpc-map lookup")
  .requiredOption("--to <address>", "To address")
  .option("--from <address>", "From address")
  .option("--data <hex>", "Call data")
  .option("--value <wei>", "Value in wei")
  .option("--call-on-fail", "Run eth_call to extract revert reason on failure")
  .action(async (opts) => {
    const rpcUrl = await resolveRpcUrl({
      rpcUrl: opts.rpcUrl,
      chainId: opts.chain
    });
    try {
      const gasEstimate = await rpcEstimateGas(
        rpcUrl,
        withHexValue({
        from: opts.from,
        to: opts.to,
        data: opts.data,
        value: opts.value
        })
      );
      console.log(JSON.stringify({ ok: true, gasEstimate }, null, 2));
    } catch (err) {
      if (!opts.callOnFail) {
        console.log(JSON.stringify({ ok: false, reason: String(err) }, null, 2));
        return;
      }
      try {
        const revertData = await rpcCallContract(
          rpcUrl,
          withHexValue({
          from: opts.from,
          to: opts.to,
          data: opts.data,
          value: opts.value
          })
        );
        const reason = parseRevertReason(revertData) ?? "Unknown revert";
        console.log(JSON.stringify({ ok: false, reason, revertData }, null, 2));
      } catch (err2) {
        console.log(JSON.stringify({ ok: false, reason: String(err2) }, null, 2));
      }
    }
  });

bridge
  .command("broadcast")
  .option("--rpc-url <url>", "JSON-RPC URL")
  .option("--chain <id>", "Chain id for rpc-map lookup")
  .requiredOption("--signed-tx <hex>", "Signed transaction")
  .action(async (opts) => {
    const rpcUrl = await resolveRpcUrl({ rpcUrl: opts.rpcUrl, chainId: opts.chain });
    const txHash = await rpcSendRawTransaction(rpcUrl, opts.signedTx);
    console.log(JSON.stringify({ txHash }, null, 2));
  });

program
  .command("chains")
  .description("List supported chains")
  .action(async () => {
    const client = getClient();
    const result = await client.chains();
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("tokens")
  .description("Query tokens by chain and symbol/address prefix")
  .option("--chain <id>", "Chain id")
  .option("--prefix <string>", "Symbol or address prefix")
  .action(async (opts) => {
    const client = getClient();
    const result = await client.tokens({
      chainId: opts.chain,
      addressOrPrefix: opts.prefix
    });
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("transaction")
  .description("Query a bridge transaction by hash")
  .requiredOption("--hash <hash>", "Transaction hash")
  .action(async (opts) => {
    const client = getClient();
    const result = await client.transaction(opts.hash);
    console.log(JSON.stringify(result, null, 2));
  });

const rpc = program.command("rpc").description("RPC utilities");

rpc
  .command("health")
  .option("--rpc-url <url>", "JSON-RPC URL")
  .option("--chain <id>", "Chain id for rpc-map lookup")
  .option("--all", "Check all chain RPCs from rpc-map")
  .action(async (opts) => {
    try {
      if (opts.all) {
        const map = await loadRpcMap();
        const results: Array<Record<string, unknown>> = [];
        for (const [chainId, url] of Object.entries(map)) {
          const started = Date.now();
          try {
            const [rpcChain, clientVersion] = await Promise.all([
              rpcChainId(url),
              rpcClientVersion(url)
            ]);
            results.push({
              chainId,
              rpcChainId: normalizeChainIdHex(rpcChain),
              clientVersion,
              latencyMs: Date.now() - started,
              ok: true
            });
          } catch (err) {
            results.push({
              chainId,
              error: String(err),
              latencyMs: Date.now() - started,
              ok: false
            });
          }
        }
        console.log(JSON.stringify(results, null, 2));
        return;
      }
      const rpcUrl = await resolveRpcUrl({ rpcUrl: opts.rpcUrl, chainId: opts.chain });
      const started = Date.now();
      const [rpcChain, clientVersion] = await Promise.all([
        rpcChainId(rpcUrl),
        rpcClientVersion(rpcUrl)
      ]);
      console.log(
        JSON.stringify(
          {
            ok: true,
            rpcChainId: normalizeChainIdHex(rpcChain),
            clientVersion,
            latencyMs: Date.now() - started
          },
          null,
          2
        )
      );
    } catch (err) {
      console.log(JSON.stringify({ ok: false, error: String(err) }, null, 2));
      process.exitCode = 1;
    }
  });

const argv = process.argv.filter((arg, idx) => !(arg === "--" && idx >= 2));

program.parseAsync(argv).catch((err) => {
  reportError(err);
  process.exit(1);
});
