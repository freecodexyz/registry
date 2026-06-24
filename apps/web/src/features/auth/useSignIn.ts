import { useCallback } from "react";
import { stringToHex } from "viem";
import { createSiweMessage } from "viem/siwe";
import { useAccount, useChainId } from "wagmi";
import { loadSignInNonce, verifySignInMessage } from "./authApi";

export { SignInVerifyError } from "./authApi";

type SignInProvider = {
    request(args: { method: "personal_sign"; params: [`0x${string}`, `0x${string}`] }): Promise<`0x${string}`>;
};

export type PreparedSignInMessage = {
    address: `0x${string}`;
    chainId: number;
    connectorId: string;
    domain: string;
    uri: string;
    message: string;
    provider: SignInProvider;
};

export function isPreparedSignInMessageCurrent(
    prepared: PreparedSignInMessage | null,
    address: `0x${string}` | undefined,
    chainId: number,
    connectorId: string | undefined,
) {
    return Boolean(
        prepared &&
        address &&
        prepared.address.toLowerCase() === address.toLowerCase() &&
        prepared.chainId === chainId &&
        prepared.connectorId === connectorId &&
        prepared.domain === window.location.host &&
        prepared.uri === window.location.origin,
    );
}

function isSignInProvider(value: unknown): value is SignInProvider {
    return typeof value === "object" &&
        value !== null &&
        "request" in value &&
        typeof (value as { request?: unknown }).request === "function";
}

export function usePrepareSignInMessage() {
    const { address, connector } = useAccount();
    const chainId = useChainId();

    return useCallback(async (signal?: AbortSignal): Promise<PreparedSignInMessage> => {
        if (!address) throw new Error("wallet not connected");
        if (!connector) throw new Error("wallet connector missing");

        const nonce = await loadSignInNonce(address, signal);

        const domain = window.location.host;
        const uri = window.location.origin;
        const message = createSiweMessage({
            domain,
            address,
            statement: "Sign in to RIK Registry.",
            uri,
            version: "1",
            chainId,
            nonce,
        });

        const provider = await connector.getProvider();
        if (!isSignInProvider(provider)) throw new Error("wallet provider unavailable");

        return { address, chainId, connectorId: connector.id, domain, uri, message, provider };
    }, [address, chainId, connector]);
}

export function useSignIn() {
    const { address, connector } = useAccount();
    const chainId = useChainId();
    const prepareSignInMessage = usePrepareSignInMessage();

    return useCallback(async (prepared?: PreparedSignInMessage) => {
        if (!address) throw new Error("wallet not connected");

        const signInMessage = prepared && isPreparedSignInMessageCurrent(prepared, address, chainId, connector?.id)
            ? prepared
            : await prepareSignInMessage();

        const signature = await signInMessage.provider.request({
            method: "personal_sign",
            params: [stringToHex(signInMessage.message), signInMessage.address],
        });
        return verifySignInMessage({ message: signInMessage.message, signature });
    }, [address, chainId, connector?.id, prepareSignInMessage]);
}
