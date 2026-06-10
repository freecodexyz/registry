import { useAccount, useConnect } from "wagmi";
import { Button, KeyValue, Status } from "./components/ui";
import { useAuthSession } from "./useAuthSession";

export function ConnectButton() {
    const { address, isConnected } = useAccount();
    const { connectors, connect } = useConnect();
    const { isSessionLoading, isSignedIn, isSigningIn, isLoggingOut, errorMessage, signIn, signOut } = useAuthSession();

    if (isConnected)
        return (
            <div className="connect-panel">
                {address && <KeyValue label="Wallet">{address.slice(0, 6)}...{address.slice(-4)}</KeyValue>}
                {isSessionLoading ? (
                    <Status tone="idle">checking session</Status>
                ) : isSignedIn ? (
                    <Status>signed in</Status>
                ) : (
                    <Button size="sm" onClick={signIn} disabled={isSigningIn}>
                        {isSigningIn ? "Signing in..." : "Sign in"}
                    </Button>
                )}
                <Button variant="ghost" size="sm" onClick={signOut} disabled={isLoggingOut}>
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
