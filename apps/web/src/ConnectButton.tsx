import { useAccount, useConnect, useDisconnect } from "wagmi";

export function ConnectButton() {
    const { address, isConnected } = useAccount();
    const { connectors, connect } = useConnect();
    const { disconnect } = useDisconnect();

    if (isConnected)
        return (
            <span>
                {address!.slice(0, 6)}...{address!.slice(-4)}
                <button onClick={() => disconnect()}>disconnect</button>
            </span>
    );
    return (
        <>
            {connectors.map((c) => (
                <button key={c.id} onClick={() => connect({connector: c})}>
                    Connect with {c.name}
                </button>
            ))}
        </>
    );
}
