import "dotenv/config";
import { JsonRpcProvider, Wallet } from "ethers";

const rpcUrl = process.env.RPC_URL ?? "https://arb1.arbitrum.io/rpc";
const provider = new JsonRpcProvider(rpcUrl);
const wallet = new Wallet(process.env.PRIVATE_KEY!, provider);

const nonce = await wallet.getNonce();
const feeData = await provider.getFeeData();
const maxFeePerGas = feeData.maxFeePerGas ?? 1_000_000_000n;
const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? 1_000_000n;
const tx = {
  to: "0xefc6089224068b20197156a91d50132b2a47b908",
  value: 0n,
  data: "0x",
  chainId: 42161,
  gasLimit: 50000,
  maxFeePerGas,
  maxPriorityFeePerGas,
  nonce,
};

const signedTx = await wallet.signTransaction(tx);
console.log(signedTx);
