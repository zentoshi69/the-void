"use client";

import { WagmiProvider, http } from "wagmi";
import { sepolia, avalancheFuji } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme, getDefaultConfig } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { SUPPORTED_CHAINS } from "@/lib/constants";

const config = getDefaultConfig({
  appName: "VOID",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "void_dev_placeholder",
  chains: [sepolia, avalancheFuji],
  transports: {
    [sepolia.id]: http(SUPPORTED_CHAINS[0].rpc),
    [avalancheFuji.id]: http(SUPPORTED_CHAINS[1].rpc),
  },
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({
          accentColor: "#00E676",
          accentColorForeground: "#07070A",
          borderRadius: "small",
          fontStack: "system",
        })}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
