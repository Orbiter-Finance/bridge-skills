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
export declare class OrbiterApiError extends Error {
    status: "success" | "error";
    httpStatus?: number;
    requestId?: string;
    raw?: unknown;
    constructor(message: string, opts: {
        status: "success" | "error";
        httpStatus?: number;
        requestId?: string;
        raw?: unknown;
    });
}
export declare class OrbiterClient {
    private baseUrl;
    private apiKey?;
    private timeoutMs;
    private strictResponse;
    constructor(opts: OrbiterClientOptions);
    quote(input: QuoteRequest): Promise<QuoteResponse>;
    chains(): Promise<ChainsResponse>;
    tokens(params?: {
        chainId?: string;
        addressOrPrefix?: string;
    }): Promise<TokensResponse>;
    transaction(hash: string): Promise<TransactionResponse>;
    walletPortfolio(vm: string, address: string): Promise<WalletPortfolioResponse>;
    private request;
}
export declare function extractFirstQuoteTx(quote: QuoteResponse): QuoteTx | null;
export declare function extractQuoteTxByAction(quote: QuoteResponse, action: string): QuoteTx | null;
export declare function extractBridgeQuoteTx(quote: QuoteResponse): QuoteTx | null;
export declare function extractApproveQuoteTx(quote: QuoteResponse): QuoteTx | null;
export declare function buildSignableTx(quote: QuoteResponse, chainId: string): SignableTx | null;
export type RpcTx = {
    from?: string;
    to: string;
    data?: string;
    value?: string;
};
export declare function rpcCall<T>(rpcUrl: string, method: string, params?: unknown[]): Promise<T>;
export declare function rpcEstimateGas(rpcUrl: string, tx: RpcTx): Promise<string>;
export declare function rpcSendRawTransaction(rpcUrl: string, signedTx: string): Promise<string>;
export declare function rpcCallContract(rpcUrl: string, tx: RpcTx, blockTag?: "latest" | "pending" | "earliest"): Promise<string>;
export declare function erc20Allowance(rpcUrl: string, token: string, owner: string, spender: string): Promise<bigint>;
export declare function parseRevertReason(data?: string): string | null;
export declare function parseApproveData(data?: string): {
    spender: string;
    amount: bigint;
} | null;
export declare function rpcChainId(rpcUrl: string): Promise<string>;
export declare function rpcClientVersion(rpcUrl: string): Promise<string>;
export declare function toHexQuantity(value?: string): string | undefined;
export declare function withHexValue(tx: RpcTx): RpcTx;
export declare function fromHexQuantity(hex?: string): bigint | null;
export declare function rpcGetTransactionCount(rpcUrl: string, address: string, blockTag?: "latest" | "pending" | "earliest"): Promise<string>;
export declare function rpcGasPrice(rpcUrl: string): Promise<string>;
export declare function rpcMaxPriorityFeePerGas(rpcUrl: string): Promise<string>;
export declare function rpcFeeHistory(rpcUrl: string, blockCount: number, newestBlock?: "latest" | "pending" | "earliest", rewardPercentiles?: number[]): Promise<{
    baseFeePerGas?: string[];
}>;
export declare function normalizeRpcUrl(value: RpcMapValue | undefined): string | undefined;
export declare function extractRpcMapFromChainsExplore(json: Array<{
    chainId?: string;
    rpc?: RpcMapValue;
}>): Record<string, RpcMapValue>;
export declare function fetchRpcMapFromUrl(url: string, timeoutMs?: number): Promise<Record<string, RpcMapValue>>;
export declare function normalizeRpcMap(parsed: Record<string, RpcMapValue>): Record<string, string>;
export declare function loadRpcMap(opts?: {
    rpcMap?: Record<string, RpcMapValue>;
    rpcMapPath?: string;
    rpcMapUrl?: string;
}): Promise<Record<string, string>>;
export declare function resolveRpcUrl(opts: {
    rpcUrl?: string;
    chainId?: string;
    fallbackChainId?: string;
    rpcMap?: Record<string, RpcMapValue>;
    rpcMapPath?: string;
    rpcMapUrl?: string;
}): Promise<string>;
//# sourceMappingURL=index.d.ts.map
