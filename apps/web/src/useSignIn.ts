import { useAccount, useSignMessage } from "wagmi";

export function useSignIn() {
    const { address } = useAccount();
    const { signMessageAsync } = useSignMessage();

    return async () => {
        if (!address) throw new Error("wallet not connected");

        const nonceResponse = await fetch(
            `/api/auth/nonce?address=${encodeURIComponent(address)}`
        );
        if (!nonceResponse.ok) throw new Error("nonce request failed");

        const { nonce } = await nonceResponse.json() as { nonce?: string };
        if (!nonce) throw new Error("nonce missing");

        const signature = await signMessageAsync({
            message: `Sign in to RIK Registry. Nonce: ${nonce}`,
        });
        const res = await fetch(
            `/api/auth/verify`,
            { method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({address, signature}) },
        );
        if (!res.ok) throw new Error("sign-in failed");
        return await res.json() as { ok: true };
    }
}
