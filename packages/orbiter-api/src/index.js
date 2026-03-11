export class OrbiterApiError extends Error {
    status;
    httpStatus;
    requestId;
    raw;
    constructor(message, opts) {
        super(message);
        this.name = "OrbiterApiError";
        this.status = opts.status;
        this.httpStatus = opts.httpStatus;
        this.requestId = opts.requestId;
        this.raw = opts.raw;
    }
}
export class OrbiterClient {
    baseUrl;
    apiKey;
    timeoutMs;
    strictResponse;
    constructor(opts) {
        this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
        this.apiKey = opts.apiKey;
        this.timeoutMs = opts.timeoutMs ?? 15_000;
        this.strictResponse = opts.strictResponse ?? true;
    }
    async quote(input) {
        return this.request("POST", "/quote", input);
    }
    async chains() {
        return this.request("GET", "/chains");
    }
    async tokens(params) {
        const q = new URLSearchParams();
        if (params?.chainId)
            q.set("chainId", params.chainId);
        if (params?.addressOrPrefix)
            q.set("addressOrPrefix", params.addressOrPrefix);
        const query = q.toString();
        return this.request("GET", query ? `/tokens?${query}` : "/tokens");
    }
    async transaction(hash) {
        return this.request("GET", `/transaction/${hash}`);
    }
    async request(method, path, body) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        const headers = {
            "Content-Type": "application/json"
        };
        if (this.apiKey)
            headers["Authorization"] = `Bearer ${this.apiKey}`;
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
            const json = (text ? JSON.parse(text) : {});
            if (typeof json === "object" && json && "status" in json) {
                const status = json.status;
                const message = json.message ?? "";
                const requestId = json.requestId;
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
                if (this.strictResponse && !("result" in json)) {
                    throw new OrbiterApiError("Missing result in API response", {
                        status: "error",
                        httpStatus: res.status,
                        requestId,
                        raw: json
                    });
                }
            }
            else if (this.strictResponse) {
                throw new OrbiterApiError("Invalid API response shape", {
                    status: "error",
                    httpStatus: res.status,
                    raw: json
                });
            }
            return json;
        }
        finally {
            clearTimeout(timeout);
        }
    }
}
export function extractFirstQuoteTx(quote) {
    const tx = quote.result?.steps?.[0]?.tx;
    if (!tx)
        return null;
    return tx;
}
export function buildSignableTx(quote, chainId) {
    const tx = extractFirstQuoteTx(quote);
    if (!tx)
        return null;
    return {
        chainId,
        to: tx.to,
        data: tx.data,
        value: tx.value,
        gasLimit: tx.gasLimit
    };
}
export async function rpcCall(rpcUrl, method, params = []) {
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
    const json = (await res.json());
    if (!res.ok || json.error) {
        const msg = json.error?.message ?? `RPC error ${res.status}`;
        throw new Error(msg);
    }
    return json.result;
}
export async function rpcEstimateGas(rpcUrl, tx) {
    return rpcCall(rpcUrl, "eth_estimateGas", [tx]);
}
export async function rpcSendRawTransaction(rpcUrl, signedTx) {
    return rpcCall(rpcUrl, "eth_sendRawTransaction", [signedTx]);
}
export async function rpcCallContract(rpcUrl, tx, blockTag = "latest") {
    return rpcCall(rpcUrl, "eth_call", [tx, blockTag]);
}
export function parseRevertReason(data) {
    if (!data || typeof data !== "string")
        return null;
    if (!data.startsWith("0x08c379a0"))
        return null;
    const hex = data.slice(10);
    if (hex.length < 128)
        return null;
    const lenHex = hex.slice(64, 128);
    const len = parseInt(lenHex, 16);
    if (!Number.isFinite(len) || len <= 0)
        return null;
    const reasonHex = hex.slice(128, 128 + len * 2);
    if (!reasonHex)
        return null;
    try {
        return Buffer.from(reasonHex, "hex").toString("utf8");
    }
    catch {
        return null;
    }
}
export async function rpcChainId(rpcUrl) {
    return rpcCall(rpcUrl, "eth_chainId", []);
}
export async function rpcClientVersion(rpcUrl) {
    return rpcCall(rpcUrl, "web3_clientVersion", []);
}
export function toHexQuantity(value) {
    if (!value)
        return undefined;
    const trimmed = value.trim();
    if (!trimmed)
        return undefined;
    if (trimmed.startsWith("0x"))
        return trimmed;
    const normalized = trimmed.replace(/^0+/, "") || "0";
    const hex = BigInt(normalized).toString(16);
    return `0x${hex}`;
}
export function withHexValue(tx) {
    if (!tx.value)
        return tx;
    return { ...tx, value: toHexQuantity(tx.value) };
}
export function fromHexQuantity(hex) {
    if (!hex)
        return null;
    if (!hex.startsWith("0x"))
        return BigInt(hex);
    return BigInt(hex);
}
export async function rpcGetTransactionCount(rpcUrl, address, blockTag = "pending") {
    return rpcCall(rpcUrl, "eth_getTransactionCount", [address, blockTag]);
}
export async function rpcGasPrice(rpcUrl) {
    return rpcCall(rpcUrl, "eth_gasPrice", []);
}
export async function rpcMaxPriorityFeePerGas(rpcUrl) {
    return rpcCall(rpcUrl, "eth_maxPriorityFeePerGas", []);
}
export async function rpcFeeHistory(rpcUrl, blockCount, newestBlock = "latest", rewardPercentiles = []) {
    return rpcCall(rpcUrl, "eth_feeHistory", [blockCount, newestBlock, rewardPercentiles]);
}
//# sourceMappingURL=index.js.map