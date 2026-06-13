import { useState } from "react";
import { useAccount, useConnect } from "wagmi";
import { Button } from '@freecodexyz/ui';
import { useAuthSession } from "./useAuthSession";

export function ConnectButton() {
    const { address, isConnected } = useAccount();
    const { connectors, connect } = useConnect();
    const { isSignedIn, isLoggingOut, signedInAddress, signOut } = useAuthSession();
    const [isOpen, setIsOpen] = useState(false);

    function handleConnect(connector: (typeof connectors)[number]) {
        setIsOpen(false);
        connect({ connector });
    }

    const displayAddress = isSignedIn ? signedInAddress : address;

    if (isConnected)
        return (
            <div className="connect-panel connect-panel--account">
                {displayAddress && <span className="connect-address">{displayAddress.slice(0, 6)}...{displayAddress.slice(-4)}</span>}
                <Button variant="ghost" size="sm" onClick={signOut} disabled={isLoggingOut}>
                    {isLoggingOut ? "disconnecting..." : "disconnect"}
                </Button>
            </div>
    );

    return (
        <div className="connect-panel">
            <div
                className="connect-menu"
                onBlur={(event) => {
                    const nextTarget = event.relatedTarget;
                    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) setIsOpen(false);
                }}
                onKeyDown={(event) => {
                    if (event.key === "Escape") setIsOpen(false);
                }}
            >
                <Button
                    size="sm"
                    aria-haspopup="menu"
                    aria-expanded={isOpen}
                    onClick={() => setIsOpen((open) => !open)}
                    disabled={connectors.length === 0}
                >
                    Connect wallet
                </Button>
                {isOpen && (
                    <div className="connect-menu__list" role="menu">
                        {connectors.map((connector) => (
                            <Button key={connector.id} variant="ghost" size="sm" block role="menuitem" onClick={() => handleConnect(connector)}>
                                {connector.name}
                            </Button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
