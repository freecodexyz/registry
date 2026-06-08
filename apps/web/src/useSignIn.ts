import { createSiweMessage } from "viem/siwe";
import { useAccount, useChainId, useSignMessage } from "wagmi";

export function useSignIn() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();
    const chainId = useChainId();

    return async () => {
        if (!address) throw new Error("wallet not connected");

        const nonceResponse = await fetch(
            `/api/auth/nonce?address=${encodeURIComponent(address)}`
        );
        if (!nonceResponse.ok) throw new Error("nonce request failed");

        const { nonce } = await nonceResponse.json() as { nonce?: string };
        if (!nonce) throw new Error("nonce missing");

        const message = createSiweMessage({
            domain: window.location.host,
            address: address!,
            statement: "Sign in to RIK Registry.",
            uri: window.location.origin,
            version: "1",
            chainId,
            nonce
        });

        const signature = await signMessageAsync({message});
        const res = await fetch(
            `/api/auth/verify`,
            { method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({message, signature}) },
        );
        if (!res.ok) throw new Error("sign-in failed");
        return await res.json() as { ok: true };
    }
}
