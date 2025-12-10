import { arbitrumSepolia } from 'viem/chains';
import { http } from 'wagmi';


import { createConfig } from '@privy-io/wagmi';


// Replace these with your app's chains

export const wagmiConfig = createConfig({
  chains: [arbitrumSepolia],
  transports: {
    [arbitrumSepolia.id]: http(),
  },
});