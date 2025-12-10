require("dotenv").config();
const express = require("express");
const { ethers } = require("ethers");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());

// Configuration
const RPC_URL = process.env.RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";
const USDT_ADDRESS = "0x83BDe9dF64af5e475DB44ba21C1dF25e19A0cf9a";
const REQUIRED_AMOUNT_USDT = "0.1"; // 0.1 USDT
const USDT_DECIMALS = 6;

// Initialize Blockchain Connection
const provider = new ethers.JsonRpcProvider(RPC_URL);

// Initialize Server Wallet (Receiver)
let serverWallet;
try {
  if (
    !process.env.SERVER_PRIVATE_KEY ||
    process.env.SERVER_PRIVATE_KEY.startsWith("0x0000")
  ) {
    console.warn(
      "WARNING: SERVER_PRIVATE_KEY is not set or is a placeholder. Payment verification will fail."
    );
  }
  serverWallet = new ethers.Wallet(process.env.SERVER_PRIVATE_KEY, provider);
} catch (error) {
  console.error(
    "Error initializing wallet. Check your SERVER_PRIVATE_KEY in .env"
  );
  process.exit(1);
}

const SERVER_ADDRESS = serverWallet.address;

console.log(`Server Wallet Address (Receiver): ${SERVER_ADDRESS}`);
console.log(`Connected to RPC: ${RPC_URL}`);

/**
 * GET /x402
 * The Protected Resource
 * Returns 402 Payment Required with payment details
 */
app.get("/x402", (req, res) => {
  res.status(402).json({
    error: "Payment Required",
    message: "Access to this resource requires payment.",
    paymentDetails: {
      receiver: SERVER_ADDRESS,
      amount: REQUIRED_AMOUNT_USDT,
      currency: "mUSDT",
      tokenAddress: USDT_ADDRESS,
      decimals: USDT_DECIMALS,
      chainId: 421614, // Arbitrum Sepolia
      network: "arbitrum-sepolia",
      // Suggesting how to pay (informative)
      instruction: `Send ${REQUIRED_AMOUNT_USDT} USDT (${USDT_ADDRESS}) to ${SERVER_ADDRESS} on Arbitrum Sepolia.`,
    },
  });
});

/**
 * POST /x402/verify
 * The Payment Validator
 * Verifies the transaction on-chain
 */
app.post("/x402/verify", async (req, res) => {
  try {
    const { txHash } = req.body;

    if (!txHash) {
      return res.status(400).json({ error: "Missing txHash in request body" });
    }

    console.log(`Verifying transaction: ${txHash}`);

    // 1. Fetch transaction
    const tx = await provider.getTransaction(txHash);

    if (!tx) {
      return res
        .status(404)
        .json({ error: "Transaction not found on Arbitrum Sepolia" });
    }

    // 2. Verify confirmation
    // If confirmations is 0, it's pending. We require at least 1 confirmation.
    // We can optionally wait for it, but for a simple verify endpoint, we might just check status.
    // If we want to be nice, we could wait a bit, but usually REST APIs return status immediately.
    // Let's check status.

    // Note: In ethers v6, tx.confirmations can be null or 0 if pending?
    // We also want to check the receipt to ensure it didn't revert.
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
      return res
        .status(400)
        .json({ error: "Transaction pending or not mined yet. Please wait." });
    }

    if (receipt.status !== 1) {
      return res
        .status(400)
        .json({ error: "Transaction failed (reverted) on-chain." });
    }

    // 3. Verify USDT Transfer
    // Check for Transfer event: Transfer(address from, address to, uint256 value)
    const erc20Interface = new ethers.Interface([
      "event Transfer(address indexed from, address indexed to, uint256 value)",
    ]);

    let amountPaid = BigInt(0);

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() === USDT_ADDRESS.toLowerCase()) {
        try {
          const parsedLog = erc20Interface.parseLog(log);
          if (parsedLog && parsedLog.name === "Transfer") {
            const to = parsedLog.args[1];
            const value = parsedLog.args[2];
            
            if (to.toLowerCase() === SERVER_ADDRESS.toLowerCase()) {
              amountPaid += value;
            }
          }
        } catch (e) {
          // Ignore parsing errors for other events
        }
      }
    }

    const requiredUnits = ethers.parseUnits(REQUIRED_AMOUNT_USDT, USDT_DECIMALS);

    if (amountPaid < requiredUnits) {
      return res.status(400).json({
        error: "Insufficient Payment",
        message: `Payment not found or insufficient. Received ${ethers.formatUnits(
          amountPaid,
          USDT_DECIMALS
        )} USDT. Required: ${REQUIRED_AMOUNT_USDT} USDT.`,
      });
    }

    // 5. Success
    // In a real app, you would probably issue a JWT or session token here.
    // Since the objective is simple, we return the protected data directly.

    console.log(`Payment Verified! Access Granted for ${txHash}`);

    return res.status(200).json({
      message: "Hello World",
      access: "granted",
      txHash: txHash,
    });
  } catch (error) {
    console.error("Verification Error:", error);
    return res
      .status(500)
      .json({ error: "Internal Server Error during verification" });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Test with: GET http://localhost:${PORT}/x402`);
});
