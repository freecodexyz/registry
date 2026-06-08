import { useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useSignIn } from "./useSignIn";

export function ConnectButton() {
    const { address, isConnected } = useAccount();
    const { connectors, connect } = useConnect();
    const { disconnect } = useDisconnect();
    const signIn = useSignIn();
    const [signedInAddress, setSignedInAddress] = useState<`0x${string}` | null>(null);
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [error, setError] = useState<{ address: `0x${string}` | undefined; message: string } | null>(null);
    const isSignedIn = signedInAddress === address;
    const errorMessage = error && error.address === address ? error.message : null;

    async function handleSignIn() {
        setError(null);
        setIsSigningIn(true);
        try {
            await signIn();
            if (address) setSignedInAddress(address);
        } catch (err) {
            setError({ address, message: err instanceof Error ? err.message : "sign-in failed" });
        } finally {
            setIsSigningIn(false);
        }
    }

    function handleDisconnect() {
        setSignedInAddress(null);
        setError(null);
        disconnect();
    }

    if (isConnected)
        return (
            <div className="connect-panel">
                {address && <span className="wallet-address">{address.slice(0, 6)}...{address.slice(-4)}</span>}
                {isSignedIn ? (
                    <span className="sign-in-status">signed in</span>
                ) : (
                    <button type="button" onClick={handleSignIn} disabled={isSigningIn}>
                        {isSigningIn ? "Signing in..." : "Sign in"}
                    </button>
                )}
                <button type="button" onClick={handleDisconnect}>disconnect</button>
                {errorMessage && <span className="connect-error" role="alert">{errorMessage}</span>}
            </div>
    );
    return (
        <div className="connect-panel">
            {connectors.map((c) => (
                <button key={c.id} type="button" onClick={() => connect({connector: c})}>
                    Connect with {c.name}
                </button>
            ))}
        </div>
    );
}
