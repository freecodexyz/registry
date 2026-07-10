export const NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export type HexAddress = `0x${string}`;
export type SwapTradeType = "EXACT_INPUT" | "EXACT_OUTPUT";
export type SwapJobStatus = "queued" | "processing" | "action_required" | "completed" | "failed";
export type SwapJobStage =
    | "queued"
    | "checking_approval"
    | "quoting"
    | "awaiting_wallet_action"
    | "building_swap"
    | "ready_to_sign"
    | "failed";

export type TransactionRequest = {
    to: HexAddress;
    from: HexAddress;
    data: HexAddress;
    value: string;
    chainId: number;
    gasLimit?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    gasPrice?: string;
};

export type SwapQuoteRequest = {
    chainId: number;
    tokenIn: HexAddress;
    tokenOut: HexAddress;
    amount: string;
    swapper: HexAddress;
    type: SwapTradeType;
    slippageTolerance: number;
    permitAmount: "FULL" | "EXACT";
    routingPreference: "BEST_PRICE" | "FASTEST";
};

export type SwapApprovalRequest = {
    chainId: number;
    walletAddress: HexAddress;
    token: HexAddress;
    amount: string;
};

export type SwapApprovalResult = {
    approval: TransactionRequest | null;
    cancel: TransactionRequest | null;
    raw: unknown;
};

export type SwapQuoteResult = {
    quote: unknown;
    permitData: unknown | null;
    routing: string | null;
    raw: unknown;
};

export type SwapBuildRequest = {
    quote: unknown;
    permitData: unknown | null;
    signature: HexAddress | null;
};

export type SwapBuildResult = {
    transaction: TransactionRequest;
    raw: unknown;
};

export type SwapStatusRequest = {
    chainId: number;
    txHashes: HexAddress[];
};

export type SwapProvider = {
    checkApproval(request: SwapApprovalRequest): Promise<SwapApprovalResult>;
    quote(request: SwapQuoteRequest): Promise<SwapQuoteResult>;
    buildSwap(request: SwapBuildRequest): Promise<SwapBuildResult>;
    getSwapStatus?(request: SwapStatusRequest): Promise<unknown>;
};

export type RequiredSwapAction = {
    type: "approval";
    approval: TransactionRequest | null;
    cancel: TransactionRequest | null;
    fulfilled: boolean;
    transactionHash?: HexAddress;
} | {
    type: "permit";
    permitData: unknown;
    fulfilled: boolean;
};

export type SwapJobError = {
    code: string;
    message: string;
    retriable: boolean;
    details?: unknown;
};

export type SwapJobSnapshot = {
    id: string;
    status: SwapJobStatus;
    stage: SwapJobStage;
    createdAt: string;
    updatedAt: string;
    attempts: number;
    request: SwapQuoteRequest;
    requiredActions: readonly RequiredSwapAction[];
    approval?: SwapApprovalResult;
    quote?: SwapQuoteResult;
    transaction?: TransactionRequest;
    result?: unknown;
    error?: SwapJobError;
};

export class SwapProviderError extends Error {
    readonly code: string;
    readonly retriable: boolean;
    readonly statusCode?: number;
    readonly details?: unknown;

    constructor(message: string, options: { code: string; retriable?: boolean; statusCode?: number; details?: unknown }) {
        super(message);
        this.name = "SwapProviderError";
        this.code = options.code;
        this.retriable = options.retriable ?? false;
        if (options.statusCode !== undefined) this.statusCode = options.statusCode;
        if (options.details !== undefined) this.details = options.details;
    }
}
