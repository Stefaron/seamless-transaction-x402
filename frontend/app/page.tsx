'use client'
import { useState, useEffect } from 'react'
import { useSendTransaction, usePrivy, useWallets, getEmbeddedConnectedWallet } from '@privy-io/react-auth'
import { useBalance } from 'wagmi'
import { megaethTestnet, riseTestnet, arbitrumSepolia } from 'viem/chains'
import { Check, Copy } from 'lucide-react'
import Link from 'next/link'
import { createWalletClient, createPublicClient, http, custom, type Hex, type WalletClient, formatEther, formatUnits, erc20Abi, parseUnits } from 'viem'
import { useReadContract, useWaitForTransactionReceipt } from 'wagmi'

export default function Home() {
  const { sendTransaction } = useSendTransaction()
  const { login, logout, authenticated } = usePrivy()
  const { wallets } = useWallets()
  const embeddedWallet = getEmbeddedConnectedWallet(wallets)

  const [lastTxHash, setLastTxHash] = useState<string | null>(null)
  const [lastContractHash, setLastContractHash] = useState<string | null>(null)
  const [isSendingTx, setIsSendingTx] = useState(false)
  const [isClaiming, setIsClaiming] = useState(false)
  const [isTransferring, setIsTransferring] = useState(false)
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [copied, setCopied] = useState(false)
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null)
  
  // X402 State
  const [x402Status, setX402Status] = useState<'idle' | 'fetching_payment_info' | 'sending_payment' | 'verifying' | 'success' | 'error'>('idle');
  const [x402Message, setX402Message] = useState<string>('');
  const [protectedData, setProtectedData] = useState<any>(null);

  const chainId = embeddedWallet?.chainId ? parseInt(embeddedWallet.chainId.split(':')[1]) : null

  const { data: balance, refetch: refetchBalance } = useBalance({
    address: embeddedWallet?.address as `0x${string}`,
    chainId: chainId!
  })

  // Fetch token balance explicitly using useReadContract to avoid useBalance token parameter issues
  const { data: tokenBalanceRaw, refetch: refetchTokenBalance } = useReadContract({
    address: '0x83BDe9dF64af5e475DB44ba21C1dF25e19A0cf9a',
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [embeddedWallet?.address as `0x${string}`],
    chainId: chainId!,
    query: {
      enabled: !!embeddedWallet?.address && !!chainId
    }
  })

  // Assuming 18 decimals for the token as default, or we could fetch it too.
  const tokenBalanceFormatted = tokenBalanceRaw ? formatUnits(tokenBalanceRaw as bigint, 6) : '0'
  const sepoliaBalance = balance ? formatEther(balance.value) : '0'

  const { isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: lastTxHash as `0x${string}`,
  })

  useEffect(() => {
    if (isConfirmed) {
      refetchBalance()
      refetchTokenBalance()
    }
  }, [isConfirmed, refetchBalance, refetchTokenBalance])

  useEffect(() => {
    const createClient = async () => {
      if (embeddedWallet && chainId) {
        try {
          const provider = await embeddedWallet.getEthereumProvider()
          const client = createWalletClient({
            account: embeddedWallet.address as Hex,
            chain: arbitrumSepolia,
            transport: custom(provider!),
          })
          setWalletClient(client)
        } catch (error) {
          console.error('Failed to create wallet client:', error)
          setWalletClient(null)
        }
      } else {
        setWalletClient(null)
      }
    }

    createClient()
  }, [embeddedWallet?.address, chainId])

  const handleX402Flow = async () => {
    if (!walletClient || !embeddedWallet) {
      setX402Message("Wallet not connected.");
      return;
    }

    setX402Status('fetching_payment_info');
    setX402Message("Requesting protected resource...");
    setProtectedData(null);

    try {
      // Step 1: Request Resource
      const response = await fetch('http://localhost:8000/x402', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 402) {
        const errorData = await response.json();
        setX402Message(`Resource protected. Payment Required.\nDetails: ${JSON.stringify(errorData.paymentDetails, null, 2)}`);
        
        const { receiver, amount, tokenAddress, decimals } = errorData.paymentDetails;
        
        if (!receiver || !amount || !tokenAddress) {
           throw new Error("Invalid payment details received.");
        }

        // Step 2: Send Payment
        setX402Status('sending_payment');
        setX402Message((prev) => prev + `\n\nInitiating payment of ${amount} mUSDT to ${receiver}...`);

        const hash = await walletClient.writeContract({
            account: embeddedWallet.address as Hex,
            address: tokenAddress as `0x${string}`,
            abi: erc20Abi,
            functionName: 'transfer',
            args: [receiver as `0x${string}`, parseUnits(amount, decimals)],
            chain: arbitrumSepolia 
        });

        setX402Message((prev) => prev + `\nTransaction sent! Hash: ${hash}\nWaiting for confirmation...`);

        // Wait for confirmation
        const publicClient = createPublicClient({
            chain: arbitrumSepolia,
            transport: http() 
        });

        await publicClient.waitForTransactionReceipt({ hash });
        
        setX402Message((prev) => prev + `\nTransaction confirmed! Verifying with server...`);

        // Step 3: Verify Payment
        setX402Status('verifying');
        
        const verifyResponse = await fetch('http://localhost:8000/x402/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ txHash: hash })
        });

        const verifyData = await verifyResponse.json();

        if (verifyResponse.ok) {
            setX402Status('success');
            setProtectedData(verifyData);
            setX402Message((prev) => prev + `\n\nAccess Granted!`);
        } else {
             throw new Error(verifyData.error || "Verification failed");
        }

      } else if (response.ok) {
        // Already paid or free?
        const data = await response.json();
        setX402Status('success');
        setProtectedData(data);
        setX402Message("Resource accessed successfully (no payment required).");
      } else {
        throw new Error(`Unexpected status: ${response.status}`);
      }

    } catch (error: any) {
      console.error("X402 Flow Error:", error);
      setX402Status('error');
      setX402Message((prev) => prev + `\n\nError: ${error.message}`);
    }
  };

  const handleSendTransaction = async () => {
    try {
      setIsSendingTx(true)
      const result = await sendTransaction({
        to: embeddedWallet?.address as `0x${string}`,
        value: 0,
      })
      setLastTxHash(result.hash)
    } catch (error) {
      console.error('Transaction failed:', error)
    } finally {
      setIsSendingTx(false)
    }
  }

  const handleFaucet = async () => {
    if (!walletClient) return;
    try {
      setIsClaiming(true);
      const hash = await walletClient.writeContract({
        account: embeddedWallet?.address as Hex,
        address: '0x83BDe9dF64af5e475DB44ba21C1dF25e19A0cf9a',
        abi: [{
          name: 'faucet',
          type: 'function',
          stateMutability: 'nonpayable',
          inputs: [],
          outputs: []
        }],
        functionName: 'faucet',
        args: [],
        chain: arbitrumSepolia
      });
      setLastTxHash(hash);
    } catch (e) {
      console.error(e);
    } finally {
      setIsClaiming(false);
    }
  }

  const handleTokenTransfer = async () => {
    if (!walletClient || !recipient || !amount) return;
    try {
      setIsTransferring(true);
      const hash = await walletClient.writeContract({
        account: embeddedWallet?.address as Hex,
        address: '0x83BDe9dF64af5e475DB44ba21C1dF25e19A0cf9a',
        abi: erc20Abi,
        functionName: 'transfer',
        args: [recipient as `0x${string}`, parseUnits(amount, 6)],
        chain: arbitrumSepolia
      });
      setLastTxHash(hash);
    } catch (e) {
      console.error(e);
    } finally {
      setIsTransferring(false);
    }
  }

  const handleSwitchChain = async (targetChainId: number) => {
    try {
      console.log("switching chain to", targetChainId)
      console.log("embedded wallet is here: ", embeddedWallet)
      await embeddedWallet?.switchChain(targetChainId)
      setLastTxHash(null)
      setLastContractHash(null)
      console.log("Switch done")

    } catch (error) {
      console.error('Chain switch failed:', error)
    }
  }

  const copyAddress = async () => {
    if (embeddedWallet?.address) {
      await navigator.clipboard.writeText(embeddedWallet.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const hasBalance = balance && balance.value > 0

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <button
          onClick={login}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 hover:cursor-pointer"
        >
          Login with Privy
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-6 pt-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Privy Embedded Wallet Demo</h1>
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-gray-600 dark:text-gray-400">Connected Wallet:</span>
            <span className="text-gray-600 dark:text-gray-400">{embeddedWallet?.address}</span>
            <button
              onClick={copyAddress}
              className="p-1 hover:cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Copy address"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              )}
            </button>
          </div>

          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 hover:cursor-pointer mb-3"
          >
            Logout
          </button>
        </div>

        {/* Chain Switch & Balance Section */}
        <div className="p-5 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-1 text-gray-900 dark:text-white">
                Token Balance: {tokenBalanceRaw !== undefined ? `${tokenBalanceFormatted} USDT` : 'Loading...'}
              </h3>
              <h3 className="text-lg font-semibold mb-1 text-gray-900 dark:text-white">
                Sepolia Balance: {sepoliaBalance !== undefined ? `${sepoliaBalance} ETH` : 'Loading...'}
              </h3>
            </div>
          </div>
        </div>

        {/* Action Buttons - Two Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 border rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Hash Transactions</h2>

            {lastTxHash && (
              <div className="mt-3 p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                <p className="text-xs text-green-700 dark:text-green-300 font-medium">Last transaction:</p>
                <Link
                  href={chainId === megaethTestnet.id
                    ? `http://megaexplorer.xyz/tx/${lastTxHash}`
                    : chainId === riseTestnet.id
                    ? `https://explorer.testnet.riselabs.xyz/tx/${lastTxHash}`
                    : chainId === arbitrumSepolia.id
                    ? `https://sepolia.arbiscan.io/tx/${lastTxHash}`
                    : `https://etherscan.io/tx/${lastTxHash}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-green-600 dark:text-green-400 break-all hover:underline"
                >
                  {lastTxHash}
                </Link>
              </div>
            )}
          </div>

          <div className="p-6 border rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Token Actions</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">1. Claim Tokens</h3>
                <button
                  onClick={handleFaucet}
                  disabled={isClaiming || !walletClient}
                  className={`w-full px-4 py-2 rounded hover:cursor-pointer font-medium ${!isClaiming && walletClient
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    }`}
                >
                  {isClaiming ? 'Claiming...' : 'Claim Faucet'}
                </button>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="font-medium mb-2">2. Transfer Token</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Recipient Address (0x...)"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                  />
                  <input
                    type="number"
                    placeholder="Amount (USDT)"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600"
                  />
                  <button
                    onClick={handleTokenTransfer}
                    disabled={isTransferring || !walletClient || !recipient || !amount}
                    className={`w-full px-4 py-2 rounded hover:cursor-pointer font-medium ${!isTransferring && walletClient && recipient && amount
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      }`}
                  >
                    {isTransferring ? 'Transferring...' : 'Transfer Tokens'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* X402 Payment Section */}
        <div className="p-6 border rounded-lg bg-gray-50 dark:bg-gray-800">
          <h2 className="text-xl font-semibold mb-4">HTTP 402 Automation</h2>
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              Click below to request access to the protected resource. unique wallet payment flow will be handled automatically.
            </p>
            <button
              onClick={handleX402Flow}
              disabled={x402Status !== 'idle'}
              className={`w-full px-4 py-2 rounded hover:cursor-pointer font-medium ${x402Status === 'idle'
                ? 'bg-orange-600 text-white hover:bg-orange-700'
                : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                }`}
            >
              {x402Status === 'idle' ? 'Access Protected Resource' : `Processing: ${x402Status}...`}
            </button>

            {x402Message && (
              <div className="mt-4 p-4 bg-black text-green-400 font-mono text-sm rounded overflow-auto max-h-60 whitespace-pre-wrap">
                {x402Message}
              </div>
            )}
            
            {protectedData && (
              <div className="mt-4 p-4 bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700 rounded">
                <h3 className="font-bold text-green-800 dark:text-green-100">Success!</h3>
                <pre className="text-sm mt-2 overflow-auto">{JSON.stringify(protectedData, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}