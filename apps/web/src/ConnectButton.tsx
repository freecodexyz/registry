import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Button, KeyValue, Status } from "./components/ui";
import { useSignIn } from "./useSignIn";

export function ConnectButton() {
    const { address, isConnected } = useAccount();
    const { connectors, connect } = useConnect();
    const { disconnect } = useDisconnect();
    const signIn = useSignIn();
    const [signedInAddress, setSignedInAddress] = useState<`0x${string}` | null>(null);
    const [isSessionLoading, setIsSessionLoading] = useState(true);
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [error, setError] = useState<{ address: `0x${string}` | undefined; message: string } | null>(null);
    const isSignedIn = Boolean(address && signedInAddress?.toLowerCase() === address.toLowerCase());
    const errorMessage = error && error.address === address ? error.message : null;

    useEffect(() => {
        const controller = new AbortController();

        async function loadSession() {
            try {
                const response = await fetch("/api/auth/me", {
                    credentials: "include",
                    signal: controller.signal,
                });

                if (response.status === 401) {
                    setSignedInAddress(null);
                    return;
                }
                if (!response.ok) throw new Error("session check failed");

                const session = await response.json() as { address: `0x${string}` };
                setSignedInAddress(session.address);
            } catch (err) {
                if (err instanceof DOMException && err.name === "AbortError") return;
                setSignedInAddress(null);
            } finally {
                if (!controller.signal.aborted) setIsSessionLoading(false);
            }
        }

        void loadSession();

        return () => controller.abort();
    }, []);

    async function handleSignIn() {
        setError(null);
        setIsSigningIn(true);
        try {
            const session = await signIn();
            setSignedInAddress(session.address);
        } catch (err) {
            setError({ address, message: err instanceof Error ? err.message : "sign-in failed" });
        } finally {
            setIsSigningIn(false);
        }
    }

    async function handleDisconnect() {
        setError(null);
        setIsLoggingOut(true);
        try {
            const response = await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "include",
            });
            if (!response.ok) throw new Error("logout failed");
            setSignedInAddress(null);
            disconnect();
        } catch (err) {
            setError({ address, message: err instanceof Error ? err.message : "logout failed" });
        } finally {
            setIsLoggingOut(false);
        }
    }

    if (isConnected)
        return (
            <div className="connect-panel">
                {address && <KeyValue label="Wallet">{address.slice(0, 6)}...{address.slice(-4)}</KeyValue>}
                {isSessionLoading ? (
                    <Status tone="idle">checking session</Status>
                ) : isSignedIn ? (
                    <Status>signed in</Status>
                ) : (
                    <Button size="sm" onClick={handleSignIn} disabled={isSigningIn}>
                        {isSigningIn ? "Signing in..." : "Sign in"}
                    </Button>
                )}
                <Button variant="ghost" size="sm" onClick={handleDisconnect} disabled={isLoggingOut}>
                    {isLoggingOut ? "disconnecting..." : "disconnect"}
                </Button>
                {errorMessage && <span className="fcf-hint fcf-hint--error" role="alert">{errorMessage}</span>}
            </div>
    );
    return (
        <div className="connect-panel">
            {connectors.map((c) => (
                <Button key={c.id} variant="ghost" size="sm" onClick={() => connect({connector: c})}>
                    Connect with {c.name}
                </Button>
            ))}
        </div>
    );
}
