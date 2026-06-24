import { createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim();
const appUrl = window.location.origin;
const connectors = [
    injected(),
    ...(walletConnectProjectId
        ? [walletConnect({
            projectId: walletConnectProjectId,
            showQrModal: true,
            metadata: {
                name: "RIK Registry",
                description: "Gated RIK Registry web app.",
                url: appUrl,
                icons: [new URL("/favicon.svg", appUrl).toString()],
            },
        })]
        : []),
];

export const wagmiConfig = createConfig({
    chains: [baseSepolia],
    connectors,
    transports: { [baseSepolia.id]: http("https://base-sepolia-rpc.publicnode.com") },
});
