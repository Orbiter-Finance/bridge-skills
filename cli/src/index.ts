#!/usr/bin/env node
import { Command } from "commander";
import {
  OrbiterClient,
  buildSignableTx,
  extractApproveQuoteTx,
  extractQuoteTxByAction,
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
  loadRpcMap,
  rpcSendRawTransaction,
  toHexQuantity,
  withHexValue
} from "@orbiter-finance/orbiter-api";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { inspect } from "node:util";
import { Wallet } from "ethers";

const program = new Command();

function getCliVersion(): string {
  try {
    const raw = readFileSync(new URL("../package.json", import.meta.url), "utf8");
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function reportError(err: unknown): void {
  console.error(inspect(err, { depth: 6, colors: false }));
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  if (err instanceof Error) {
    const msg = err.message ?? "";
    if (msg.includes("RPC URL not found")) {
      console.error("Hint: provide --rpc-url or --chain.");
    } else if (msg.includes("intrinsic gas too low")) {
      console.error("Hint: gasLimit is too low. Use sign-template or pass --rpc-url for auto-enrich.");
    } else if (msg.toLowerCase().includes("insufficient token allowance")) {
      console.error("Hint: approve is required. Use --auto-approve or send approve tx first.");
    }
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

function parseAmountToBaseUnits(amountHuman: string, decimals: number): string {
  const trimmed = amountHuman.trim();
  if (!trimmed) throw new Error("Missing amount value");
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Invalid amount format");
  }
  const [intPart, fracPart = ""] = trimmed.split(".");
  const frac = fracPart.padEnd(decimals, "0").slice(0, decimals);
  const combined = `${intPart}${frac}`.replace(/^0+/, "") || "0";
  return combined;
}

function resolveAmount(opts: { amount?: string; amountHuman?: string; amountDecimals?: string }): string {
  if (opts.amount) return opts.amount;
  if (!opts.amountHuman) {
    throw new Error("Missing --amount or --amount-human");
  }
  if (!opts.amountDecimals) {
    throw new Error("Missing --amount-decimals when using --amount-human");
  }
  const decimals = Number(opts.amountDecimals);
  if (!Number.isFinite(decimals) || decimals < 0 || decimals > 36) {
    throw new Error("Invalid --amount-decimals");
  }
  return parseAmountToBaseUnits(opts.amountHuman, decimals);
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

program.name("orbiter").description("Orbiter Finance CLI").version(getCliVersion());

const bridge = program.command("bridge").description("Bridge operations");

bridge
  .command("quote")
  .requiredOption("--source-chain <id>", "Source chain id")
  .requiredOption("--dest-chain <id>", "Destination chain id")
  .requiredOption("--source-token <addr>", "Source token address")
  .requiredOption("--dest-token <addr>", "Destination token address")
  .option("--amount <amount>", "Amount in base units")
  .option("--amount-human <amount>", "Human-readable amount (e.g. 0.0006)")
  .option("--amount-decimals <decimals>", "Decimals for amount-human")
  .requiredOption("--user <address>", "User wallet address")
  .requiredOption("--recipient <address>", "Recipient address")
  .option("--slippage <number>", "Slippage tolerance, e.g. 0.02")
  .option("--fee-recipient <address>", "Fee recipient address")
  .option("--fee-percent <number>", "Fee percent, e.g. 0.1")
  .option("--channel <string>", "Dapp name or commission wallet address")
  .option("--format <format>", "Output format: json|summary", "json")
  .action(async (opts) => {
    const client = getClient();
    const amount = resolveAmount(opts);
    const result = await client.quote({
      sourceChainId: String(opts.sourceChain),
      destChainId: String(opts.destChain),
      sourceToken: opts.sourceToken,
      destToken: opts.destToken,
      amount,
      userAddress: opts.user,
      targetRecipient: opts.recipient,
      slippage: opts.slippage ? Number(opts.slippage) : undefined,
      feeConfig:
        opts.feeRecipient && opts.feePercent
          ? { feeRecipient: opts.feeRecipient, feePercent: String(opts.feePercent) }
          : undefined,
      channel: opts.channel
    });
    if (opts.format === "summary") {
      const steps = result.result?.steps ?? [];
      const actions = steps.map((s) => s.action).join(" -> ");
      console.log(
        JSON.stringify(
          {
            actions,
            sourceAmount: result.result?.details?.sourceTokenAmount,
            destAmount: result.result?.details?.destTokenAmount,
            minDestAmount: result.result?.details?.minDestTokenAmount,
            fees: result.result?.fees
          },
          null,
          2
        )
      );
      return;
    }
    console.log(JSON.stringify(result, null, 2));
  });

bridge
  .command("tx")
  .requiredOption("--source-chain <id>", "Source chain id")
  .requiredOption("--dest-chain <id>", "Destination chain id")
  .requiredOption("--source-token <addr>", "Source token address")
  .requiredOption("--dest-token <addr>", "Destination token address")
  .option("--amount <amount>", "Amount in base units")
  .option("--amount-human <amount>", "Human-readable amount (e.g. 0.0006)")
  .option("--amount-decimals <decimals>", "Decimals for amount-human")
  .requiredOption("--user <address>", "User wallet address")
  .requiredOption("--recipient <address>", "Recipient address")
  .option("--slippage <number>", "Slippage tolerance, e.g. 0.02")
  .option("--fee-recipient <address>", "Fee recipient address")
  .option("--fee-percent <number>", "Fee percent, e.g. 0.1")
  .option("--channel <string>", "Dapp name or commission wallet address")
  .option("--action <action>", "Select action: bridge|swap|approve", "bridge")
  .action(async (opts) => {
    const client = getClient();
    const amount = resolveAmount(opts);
    const quote = await client.quote({
      sourceChainId: String(opts.sourceChain),
      destChainId: String(opts.destChain),
      sourceToken: opts.sourceToken,
      destToken: opts.destToken,
      amount,
      userAddress: opts.user,
      targetRecipient: opts.recipient,
      slippage: opts.slippage ? Number(opts.slippage) : undefined,
      feeConfig:
        opts.feeRecipient && opts.feePercent
          ? { feeRecipient: opts.feeRecipient, feePercent: String(opts.feePercent) }
          : undefined,
      channel: opts.channel
    });
    let tx = extractBridgeQuoteTx(quote) ?? extractFirstQuoteTx(quote);
    if (opts.action === "swap") tx = extractQuoteTxByAction(quote, "swap") ?? tx;
    if (opts.action === "approve") tx = extractApproveQuoteTx(quote) ?? tx;
    console.log(JSON.stringify({ tx, quote }, null, 2));
  });

bridge
  .command("flow")
  .requiredOption("--source-chain <id>", "Source chain id")
  .requiredOption("--dest-chain <id>", "Destination chain id")
  .requiredOption("--source-token <addr>", "Source token address")
  .requiredOption("--dest-token <addr>", "Destination token address")
  .option("--amount <amount>", "Amount in base units")
  .option("--amount-human <amount>", "Human-readable amount (e.g. 0.0006)")
  .option("--amount-decimals <decimals>", "Decimals for amount-human")
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
  .option("--auto-approve", "Auto-broadcast ERC20 approve if allowance is insufficient")
  .option("--private-key <hex>", "Private key for auto-approve (use env ORBITER_PRIVATE_KEY)")
  .option("--format <format>", "Output format: json|summary", "json")
  .action(async (opts) => {
    const client = getClient();
    const amount = resolveAmount(opts);
    const quote = await client.quote({
      sourceChainId: String(opts.sourceChain),
      destChainId: String(opts.destChain),
      sourceToken: opts.sourceToken,
      destToken: opts.destToken,
      amount,
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
    const approveTx = extractApproveQuoteTx(quote);
    let approveInfo: Record<string, unknown> | undefined;
    let simulateResult: Record<string, unknown> | undefined;
    if (opts.simulate) {
      const rpcUrl = await resolveRpcUrl({
        rpcUrl: opts.rpcUrl,
        chainId: opts.chain,
        fallbackChainId: String(opts.sourceChain)
      });
      const tx = signableTx ?? extractBridgeQuoteTx(quote) ?? extractFirstQuoteTx(quote);
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
    if (approveTx && (opts.rpcUrl || opts.chain || opts.sourceChain)) {
      const rpcUrl = await resolveRpcUrl({
        rpcUrl: opts.rpcUrl,
        chainId: opts.chain,
        fallbackChainId: String(opts.sourceChain)
      });
      const parsed = parseApproveData(approveTx.data);
      if (parsed) {
        const allowance = await erc20Allowance(
          rpcUrl,
          approveTx.to,
          opts.user,
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
        if (approveRequired && opts.autoApprove) {
          const privateKey = requirePrivateKey(opts.privateKey);
          const wallet = new Wallet(privateKey);
          if (wallet.address.toLowerCase() !== String(opts.user).toLowerCase()) {
            throw new Error("Auto-approve private key does not match --user");
          }
          const template = await buildSignTemplate({
            rpcUrl,
            from: opts.user,
            to: approveTx.to,
            data: approveTx.data,
            value: approveTx.value
          });
          const signedApprove = await wallet.signTransaction({
            ...template,
            chainId: Number(String(opts.sourceChain))
          });
          const approveTxHash = await rpcSendRawTransaction(rpcUrl, signedApprove);
          approveInfo = { ...approveInfo, approveTxHash };
        }
      }
    }
    if (opts.format === "summary") {
      const steps = quote.result?.steps ?? [];
      const actions = steps.map((s) => s.action).join(" -> ");
      console.log(
        JSON.stringify(
          {
            actions,
            approve: approveInfo,
            sourceAmount: quote.result?.details?.sourceTokenAmount,
            destAmount: quote.result?.details?.destTokenAmount,
            minDestAmount: quote.result?.details?.minDestTokenAmount
          },
          null,
          2
        )
      );
      return;
    }
    console.log(
      JSON.stringify({ quote, signableTx, approve: approveInfo, simulate: simulateResult }, null, 2)
    );
  });

bridge
  .command("sign-template")
  .requiredOption("--source-chain <id>", "Source chain id")
  .requiredOption("--dest-chain <id>", "Destination chain id")
  .requiredOption("--source-token <addr>", "Source token address")
  .requiredOption("--dest-token <addr>", "Destination token address")
  .option("--amount <amount>", "Amount in base units")
  .option("--amount-human <amount>", "Human-readable amount (e.g. 0.0006)")
  .option("--amount-decimals <decimals>", "Decimals for amount-human")
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
    const amount = resolveAmount(opts);
    const quote = await client.quote({
      sourceChainId: String(opts.sourceChain),
      destChainId: String(opts.destChain),
      sourceToken: opts.sourceToken,
      destToken: opts.destToken,
      amount,
      userAddress: opts.user,
      targetRecipient: opts.recipient,
      slippage: opts.slippage ? Number(opts.slippage) : undefined,
      feeConfig:
        opts.feeRecipient && opts.feePercent
          ? { feeRecipient: opts.feeRecipient, feePercent: String(opts.feePercent) }
          : undefined,
      channel: opts.channel
    });
    const tx = extractBridgeQuoteTx(quote) ?? extractFirstQuoteTx(quote);
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
  .option("--skip-chain-check", "Skip rpc chainId validation")
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
    if (!opts.skipChainCheck) {
      const rpcChain = await rpcChainId(rpcUrl);
      const rpcChainValue = rpcChain.startsWith("0x")
        ? String(parseInt(rpcChain, 16))
        : rpcChain;
      if (String(rpcChainValue) !== String(chainId)) {
        throw new Error(`RPC chainId ${rpcChainValue} does not match ${chainId}`);
      }
    }
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
  .option("--amount <amount>", "Amount in base units")
  .option("--amount-human <amount>", "Human-readable amount (e.g. 0.0006)")
  .option("--amount-decimals <decimals>", "Decimals for amount-human")
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
    const amount = resolveAmount(opts);
    const quote = await client.quote({
      sourceChainId: String(opts.sourceChain),
      destChainId: String(opts.destChain),
      sourceToken: opts.sourceToken,
      destToken: opts.destToken,
      amount,
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
  .option("--raw", "Print raw JSON response")
  .action(async (opts) => {
    const client = getClient();
    const result = await client.chains();
    if (opts.raw) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    const rows = (result.result ?? []).map((chain) => ({
      chainId: chain.chainId,
      name: chain.name,
      native: chain.nativeCurrency?.symbol ?? "",
      vm: chain.vm,
      internalId: chain.internalId
    }));
    console.table(rows);
  });

program
  .command("tokens")
  .description("Query tokens by chain and symbol/address prefix")
  .option("--chain <id>", "Chain id")
  .option("--prefix <string>", "Symbol or address prefix")
  .option("--limit <n>", "Limit number of results")
  .option("--bridgeable", "Only include bridgeable tokens")
  .option("--raw", "Print raw JSON response")
  .action(async (opts) => {
    const client = getClient();
    const result = await client.tokens({
      chainId: opts.chain,
      addressOrPrefix: opts.prefix
    });
    if (opts.raw) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    let items = Array.isArray((result as any).result) ? (result as any).result : [];
    if (opts.bridgeable) {
      items = items.filter((item: any) => item.isBridgeable);
    }
    if (opts.limit) {
      const n = Number(opts.limit);
      if (Number.isFinite(n) && n > 0) items = items.slice(0, n);
    }
    const rows = items.map((item: any) => ({
      address: item.address,
      symbol: item.symbol,
      name: item.name,
      decimals: item.decimals,
      bridgeable: item.isBridgeable
    }));
    console.table(rows);
  });

program
  .command("transaction")
  .description("Query a bridge transaction by hash")
  .requiredOption("--hash <hash>", "Transaction hash")
  .option("--format <format>", "Output format: json|summary", "json")
  .action(async (opts) => {
    const client = getClient();
    const result = await client.transaction(opts.hash);
    if (opts.format === "summary") {
      const tx = (result as any).result ?? {};
      console.log(
        JSON.stringify(
          {
            hash: tx.hash,
            status: tx.status,
            opStatus: tx.opStatus,
            chainId: tx.chainId,
            targetChain: tx.targetChain,
            amount: tx.amount,
            targetAmount: tx.targetAmount,
            symbol: tx.symbol,
            targetSymbol: tx.targetSymbol
          },
          null,
          2
        )
      );
      return;
    }
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("portfolio")
  .description("Query wallet portfolio by VM and address")
  .requiredOption("--address <address>", "Wallet address")
  .option("--vm <vm>", "VM type (default EVM)", "EVM")
  .option("--raw", "Print raw JSON response")
  .action(async (opts) => {
    const client = getClient();
    const result = await client.walletPortfolio(String(opts.vm), String(opts.address));
    if (opts.raw) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    const items = Array.isArray((result as any).result) ? (result as any).result : [];
    const rows = items.map((item: any) => ({
      chainId: item.chainId,
      symbol: item.symbol,
      balance: item.balance,
      usd: item.usd ?? item.totalUsd ?? ""
    }));
    console.table(rows);
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
