export const RPC_URL = (!process.env.RPC_URL || process.env.RPC_URL === "")
    ? "https://base-sepolia-rpc.publicnode.com"
    : process.env.RPC_URL;

export const STATE_VIEW = process.env.STATE_VIEW as `0x${string}`;
