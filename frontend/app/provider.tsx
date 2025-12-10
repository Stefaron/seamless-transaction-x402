// "use client";

// import { PrivyProvider } from "@privy-io/react-auth";
// import { arbitrumSepolia } from "viem/chains";
// import { SmartWalletsProvider } from "@privy-io/react-auth/smart-wallets";

// export default function Providers({ children }: { children: React.ReactNode }) {
//   return (
//     <PrivyProvider
      // appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmizj8el103ffjr0cgulg50fo"}
      // clientId={process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID || "client-WY6TRAJHMg6YPRGJcNSngv8Hr2WfGPinoJY4KiqZZPDSY"}
//       config={{
//         // Create embedded wallets for users who don't have a wallet
//         embeddedWallets: {
//           ethereum: {
//             createOnLogin: "users-without-wallets",
//           },
//         },
//         defaultChain: arbitrumSepolia,
//         supportedChains: [arbitrumSepolia],
//       }}>
//       <SmartWalletsProvider>{children}</SmartWalletsProvider>
//       {/* {children} */}
//     </PrivyProvider>
//   );
// }

'use client';

import { PrivyProvider } from '@privy-io/react-auth';
// import { useTheme } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {WagmiProvider} from '@privy-io/wagmi';
import { foundry, megaethTestnet, somniaTestnet, abstractTestnet, riseTestnet, arbitrumSepolia } from 'viem/chains';
import { wagmiConfig } from '@/wagmi-config';


export default function Providers({ children }: { children: React.ReactNode }) {

  const queryClient = new QueryClient();

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmizj8el103ffjr0cgulg50fo"}
      clientId={process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID || "client-WY6TRAJHMg6YPRGJcNSngv8Hr2WfGPinoJY4KiqZZPDSY"}
      config={{
        // Create embedded wallets for all users
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'all-users',
          },
        },
        defaultChain: arbitrumSepolia,
        supportedChains: [arbitrumSepolia, megaethTestnet, riseTestnet],
        appearance: {
          theme: ('dark' as "dark" | "light" | `#${string}` | undefined)
        }
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
} 