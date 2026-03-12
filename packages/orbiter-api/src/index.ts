export type ChainId = string;

export type ApiResponse<T> = {
  status: "success" | "error";
  message: string;
  result: T;
  requestId?: string;
};

export type RpcMapValue = string | string[];

export type ChainInfo = {
  chainId: string;
  internalId: number;
  name: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
    coinKey: string;
    address: string;
    isNative?: boolean;
    paymaster?: string;
  };
  vm: string;
};

export type QuoteRequest = {
  sourceChainId: string;
  destChainId: string;
  sourceToken: string;
  destToken: string;
  amount: string;
  userAddress: string;
  targetRecipient: string;
  slippage?: number;
  feeConfig?: {
    feeRecipient: string;
    feePercent: string;
  };
  channel?: string;
};

export type QuoteResult = {
  fees?: {
    withholdingFee?: string;
    withholdingFeeUSD?: string;
    swapFee?: string;
    swapFeeUSD?: string;
    tradeFee?: string;
    tradeFeeUSD?: string;
    totalFee?: string;
    priceImpactUSD?: string;
    feeSymbol?: string;
  };
  steps?: Array<{
    action: string;
    tx?: {
      data: string;
      to: string;
      value: string;
      gasLimit: string;
    };
  }>;
  details?: {
    sourceTokenAmount?: string;
    destTokenAmount?: string;
    rate?: string;
    slippageTolerance?: Record<string, unknown>;
    points?: number;
    midTokenSymbol?: string;
    minDestTokenAmount?: string;
  };
};

export type QuoteResponse = ApiResponse<QuoteResult>;
export type QuoteTx = {
  data: string;
  to: string;
  value: string;
  gasLimit: string;
};
export type SignableTx = {
  chainId: string;
  to: string;
  data: string;
  value: string;
  gasLimit: string;
};

export type TransactionResult = {
  chainId: string;
  hash: string;
  sender: string;
  receiver: string;
  amount: string;
  symbol: string;
  timestamp: string;
  status: number;
  opStatus: number;
  targetId: string;
  targetAmount: string;
  targetSymbol: string;
  targetChain: string;
  points?: string;
  targetAddress?: string;
};

export type TransactionResponse = ApiResponse<TransactionResult>;
export type ChainsResponse = ApiResponse<ChainInfo[]>;
export type TokensResponse = ApiResponse<unknown>;
export type WalletPortfolioResponse = ApiResponse<unknown>;

export type OrbiterClientOptions = {
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
  strictResponse?: boolean;
};

export class OrbiterApiError extends Error {
  status: "success" | "error";
  httpStatus?: number;
  requestId?: string;
  raw?: unknown;

  constructor(message: string, opts: {
    status: "success" | "error";
    httpStatus?: number;
    requestId?: string;
    raw?: unknown;
  }) {
    super(message);
    this.name = "OrbiterApiError";
    this.status = opts.status;
    this.httpStatus = opts.httpStatus;
    this.requestId = opts.requestId;
    this.raw = opts.raw;
  }
}

export class OrbiterClient {
  private baseUrl: string;
  private apiKey?: string;
  private timeoutMs: number;
  private strictResponse: boolean;

  constructor(opts: OrbiterClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.apiKey = opts.apiKey;
    this.timeoutMs = opts.timeoutMs ?? 15_000;
    this.strictResponse = opts.strictResponse ?? true;
  }

  async quote(input: QuoteRequest): Promise<QuoteResponse> {
    return this.request("POST", "/quote", input);
  }

  async chains(): Promise<ChainsResponse> {
    return this.request("GET", "/chains");
  }

  async tokens(params?: { chainId?: string; addressOrPrefix?: string }): Promise<TokensResponse> {
    const q = new URLSearchParams();
    if (params?.chainId) q.set("chainId", params.chainId);
    if (params?.addressOrPrefix) q.set("addressOrPrefix", params.addressOrPrefix);
    const query = q.toString();
    return this.request("GET", query ? `/tokens?${query}` : "/tokens");
  }

  async transaction(hash: string): Promise<TransactionResponse> {
    return this.request("GET", `/transaction/${hash}`);
  }

  async walletPortfolio(vm: string, address: string): Promise<WalletPortfolioResponse> {
    return this.request("GET", `/balances-api/${vm}/balances/${address}`);
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
        signal: controller.signal
      });
      const text = await res.text();
      if (!res.ok) {
        throw new OrbiterApiError(`Orbiter API error ${res.status}: ${text}`, {
          status: "error",
          httpStatus: res.status,
          raw: text
        });
      }
      const json = (text ? JSON.parse(text) : {}) as T;
      if (typeof json === "object" && json && "status" in json) {
        const status = (json as { status?: string }).status;
        const message = (json as { message?: string }).message ?? "";
        const requestId = (json as { requestId?: string }).requestId;
        if (status === "error") {
          throw new OrbiterApiError(`Orbiter API status error: ${message}`, {
            status: "error",
            httpStatus: res.status,
            requestId,
            raw: json
          });
        }
        if (this.strictResponse && status !== "success") {
          throw new OrbiterApiError("Unexpected API status", {
            status: "error",
            httpStatus: res.status,
            requestId,
            raw: json
          });
        }
        if (this.strictResponse && !("result" in (json as object))) {
          throw new OrbiterApiError("Missing result in API response", {
            status: "error",
            httpStatus: res.status,
            requestId,
            raw: json
          });
        }
      } else if (this.strictResponse) {
        throw new OrbiterApiError("Invalid API response shape", {
          status: "error",
          httpStatus: res.status,
          raw: json
        });
      }
      return json;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function extractQuoteTxByAction(
  quote: QuoteResponse,
  action: string
): QuoteTx | null {
  const steps = quote.result?.steps ?? [];
  const step = steps.find((item) => item.action === action && item.tx);
  return step?.tx ?? null;
}

export function extractFirstQuoteTx(quote: QuoteResponse): QuoteTx | null {
  const tx = quote.result?.steps?.[0]?.tx;
  if (!tx) return null;
  return tx;
}

export function extractBridgeQuoteTx(quote: QuoteResponse): QuoteTx | null {
  return extractQuoteTxByAction(quote, "bridge") ?? extractFirstQuoteTx(quote);
}

export function extractApproveQuoteTx(quote: QuoteResponse): QuoteTx | null {
  return extractQuoteTxByAction(quote, "approve");
}

export function buildSignableTx(
  quote: QuoteResponse,
  chainId: string
): SignableTx | null {
  const tx = extractBridgeQuoteTx(quote);
  if (!tx) return null;
  return {
    chainId,
    to: tx.to,
    data: tx.data,
    value: tx.value,
    gasLimit: tx.gasLimit
  };
}

export type RpcTx = {
  from?: string;
  to: string;
  data?: string;
  value?: string;
};

type RpcResponse<T> = {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
};

export async function rpcCall<T>(
  rpcUrl: string,
  method: string,
  params: unknown[] = []
): Promise<T> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params
    })
  });
  const json = (await res.json()) as RpcResponse<T>;
  if (!res.ok || json.error) {
    const msg = json.error?.message ?? `RPC error ${res.status}`;
    throw new Error(msg);
  }
  return json.result as T;
}

export async function rpcEstimateGas(rpcUrl: string, tx: RpcTx): Promise<string> {
  return rpcCall<string>(rpcUrl, "eth_estimateGas", [tx]);
}

export async function rpcSendRawTransaction(rpcUrl: string, signedTx: string): Promise<string> {
  return rpcCall<string>(rpcUrl, "eth_sendRawTransaction", [signedTx]);
}

export async function rpcCallContract(
  rpcUrl: string,
  tx: RpcTx,
  blockTag: "latest" | "pending" | "earliest" = "latest"
): Promise<string> {
  return rpcCall<string>(rpcUrl, "eth_call", [tx, blockTag]);
}

export async function erc20Allowance(
  rpcUrl: string,
  token: string,
  owner: string,
  spender: string
): Promise<bigint> {
  const ownerHex = owner.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const spenderHex = spender.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  const data = `0xdd62ed3e${ownerHex}${spenderHex}`;
  const result = await rpcCallContract(rpcUrl, {
    to: token,
    data
  });
  return fromHexQuantity(result) ?? 0n;
}

export function parseRevertReason(data?: string): string | null {
  if (!data || typeof data !== "string") return null;
  if (!data.startsWith("0x08c379a0")) return null;
  const hex = data.slice(10);
  if (hex.length < 128) return null;
  const lenHex = hex.slice(64, 128);
  const len = parseInt(lenHex, 16);
  if (!Number.isFinite(len) || len <= 0) return null;
  const reasonHex = hex.slice(128, 128 + len * 2);
  if (!reasonHex) return null;
  try {
    return Buffer.from(reasonHex, "hex").toString("utf8");
  } catch {
    return null;
  }
}

export function parseApproveData(data?: string): { spender: string; amount: bigint } | null {
  if (!data || typeof data !== "string") return null;
  if (!data.startsWith("0x095ea7b3")) return null;
  const hex = data.slice(10);
  if (hex.length < 128) return null;
  const spenderHex = hex.slice(24, 64);
  const amountHex = hex.slice(64, 128);
  const spender = `0x${spenderHex}`.toLowerCase();
  let amount: bigint;
  try {
    amount = BigInt(`0x${amountHex}`);
  } catch {
    return null;
  }
  return { spender, amount };
}

export async function rpcChainId(rpcUrl: string): Promise<string> {
  return rpcCall<string>(rpcUrl, "eth_chainId", []);
}

export async function rpcClientVersion(rpcUrl: string): Promise<string> {
  return rpcCall<string>(rpcUrl, "web3_clientVersion", []);
}

export function toHexQuantity(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("0x")) return trimmed;
  const normalized = trimmed.replace(/^0+/, "") || "0";
  const hex = BigInt(normalized).toString(16);
  return `0x${hex}`;
}

export function withHexValue(tx: RpcTx): RpcTx {
  if (!tx.value) return tx;
  return { ...tx, value: toHexQuantity(tx.value) };
}

export function fromHexQuantity(hex?: string): bigint | null {
  if (!hex) return null;
  if (!hex.startsWith("0x")) return BigInt(hex);
  return BigInt(hex);
}

export async function rpcGetTransactionCount(
  rpcUrl: string,
  address: string,
  blockTag: "latest" | "pending" | "earliest" = "pending"
): Promise<string> {
  return rpcCall<string>(rpcUrl, "eth_getTransactionCount", [address, blockTag]);
}

export async function rpcGasPrice(rpcUrl: string): Promise<string> {
  return rpcCall<string>(rpcUrl, "eth_gasPrice", []);
}

export async function rpcMaxPriorityFeePerGas(rpcUrl: string): Promise<string> {
  return rpcCall<string>(rpcUrl, "eth_maxPriorityFeePerGas", []);
}

export async function rpcFeeHistory(
  rpcUrl: string,
  blockCount: number,
  newestBlock: "latest" | "pending" | "earliest" = "latest",
  rewardPercentiles: number[] = []
): Promise<{ baseFeePerGas?: string[] }> {
  return rpcCall(rpcUrl, "eth_feeHistory", [blockCount, newestBlock, rewardPercentiles]);
}

const defaultRpcMapUrl = "https://cdn.orbiter.finance/config/chains-explore.json";

export function normalizeRpcUrl(value: RpcMapValue | undefined): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.find((entry) => typeof entry === "string" && entry.length > 0);
  }
  return undefined;
}

export function extractRpcMapFromChainsExplore(
  json: Array<{ chainId?: string; rpc?: RpcMapValue }>
): Record<string, RpcMapValue> {
  const map: Record<string, RpcMapValue> = {};
  for (const entry of json) {
    if (entry?.chainId && entry?.rpc) {
      map[entry.chainId] = entry.rpc;
    }
  }
  return map;
}

export async function fetchRpcMapFromUrl(
  url: string,
  timeoutMs = 8000
): Promise<Record<string, RpcMapValue>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`RPC map fetch failed: ${res.status}`);
    }
    const json = (await res.json()) as Array<{ chainId?: string; rpc?: RpcMapValue }>;
    return extractRpcMapFromChainsExplore(json);
  } finally {
    clearTimeout(timeout);
  }
}

export function normalizeRpcMap(parsed: Record<string, RpcMapValue>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [chainId, value] of Object.entries(parsed)) {
    const url = normalizeRpcUrl(value);
    if (url) normalized[chainId] = url;
  }
  return normalized;
}

export async function loadRpcMap(opts?: {
  rpcMap?: Record<string, RpcMapValue>;
  rpcMapUrl?: string;
}): Promise<Record<string, string>> {
  if (opts?.rpcMap) return normalizeRpcMap(opts.rpcMap);
  const url = opts?.rpcMapUrl ?? defaultRpcMapUrl;
  const remote = await fetchRpcMapFromUrl(url);
  return normalizeRpcMap(remote);
}

export async function resolveRpcUrl(opts: {
  rpcUrl?: string;
  chainId?: string;
  fallbackChainId?: string;
  rpcMap?: Record<string, RpcMapValue>;
  rpcMapUrl?: string;
}): Promise<string> {
  if (opts.rpcUrl) return opts.rpcUrl;
  const chainId = opts.chainId ?? opts.fallbackChainId;
  if (!chainId) {
    throw new Error("Missing rpcUrl or chainId");
  }
  const map = await loadRpcMap({
    rpcMap: opts.rpcMap,
    rpcMapUrl: opts.rpcMapUrl
  });
  const url = map[chainId];
  if (url) return url;
  throw new Error(`RPC URL not found for chain ${chainId}`);
}
