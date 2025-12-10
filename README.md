# Seamless Transaction x402

This project demonstrates a seamless "Payment Required" flow using the **HTTP 402** status code and blockchain transactions. It showcases how a web application can automatically handle crypto payments for protected resources without complex user flows, powered by **Privy embedded wallets** on the **Arbitrum Sepolia** network.

## 🚀 How it Works: The x402 Transaction Flow

The core feature of this application is the automated handling of restricted resources using HTTP status codes and smart contract interactions. Here is the step-by-step process:

1.  **Request Protected Resource**:
    - The client (frontend) attempts to access a protected API endpoint (e.g., `GET /x402`).
2.  **Payment Required (402)**:

    - The server checks for payment/authorization. If the user hasn't paid, it responds with an **HTTP 402 Payment Required** status.
    - Crucially, the server includes structured `paymentDetails` in the response body. This tells the client exactly what is needed to unlock the resource:
      - **Receiver Address**: Where to send the funds.
      - **Amount**: How much to send (e.g., 0.1 USDT).
      - **Token Address**: The smart contract address of the currency (mUSDT).
      - **Chain ID**: The network to use (Arbitrum Sepolia).

3.  **Automated Payment**:

    - The client intercepts the 402 error.
    - Instead of showing an error to the user, it automatically constructs a blockchain transaction using the details provided by the server.
    - The user simply approves the transaction (or it happens automatically if authorized), sending the required tokens to the server's wallet.

4.  **Verification**:

    - Once the transaction is confirmed on the blockchain, the client sends the transaction hash (`txHash`) back to the server using a verification endpoint (`POST /x402/verify`).

5.  **Access Granted**:
    - The server validates the transaction on-chain: ensuring it has enough confirmations, the correct amount was transferred, and the recipient matches.
    - Upon successful verification, the server returns the requested protected data.

## ✨ Features

- **HTTP 402 Protocol Implementation**: Standard-compliant use of the "Payment Required" status code.
- **Automated Crypto Payments**: Frictionless payment flow using Ethers.js and Viem.
- **Embedded Wallets**: Uses [Privy](https://privy.io/) for seamless user onboarding and wallet management.
- **Real-time Verification**: Server-side validation of blockchain transactions.
- **Testnet Ready**: Configured for **Arbitrum Sepolia** using a Mock USDT (mUSDT) token.

## 🏗 Architecture

The project is divided into two main parts:

### 1. `x402-server` (Backend)

- **Node.js & Express**: Handles API requests.
- **Ethers.js v6**: Interacts with the blockchain to verify transactions.
- **Endpoints**:
  - `GET /x402`: The protected resource that demands payment.
  - `POST /x402/verify`: Verifies the payment transaction and grants access.

### 2. `frontend` (Frontend)

- **Next.js 14**: React framework for the UI.
- **Privy SDK**: Manages authentication and embedded wallets.
- **Wagmi & Viem**: Handles blockchain connections and contract interactions.
- **Tailwind CSS**: Styling.

## 🛠 Prerequisites

- Node.js (v18 or higher recommended)
- Use **Arbitrum Sepolia** testnet.
- You need **Arbitrum Sepolia ETH** for gas fees.
- You need the **mUSDT** token for payments (Address: `0x83BDe9dF64af5e475DB44ba21C1dF25e19A0cf9a`). The app includes a faucet feature to claim these.

## 📦 Installation & Setup

### Backend Setup

1. Navigate to the server directory:
   ```bash
   cd x402-server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file:
   ```bash
   cp .env.example .env
   ```
4. Update `.env` with your variables:

   - `SERVER_PRIVATE_KEY`: The private key of the wallet that will receive payments.
   - `RPC_URL`: (Optional) Arbitrum Sepolia RPC URL.

5. Start the server:
   ```bash
   node index.js
   ```
   Server will run on `http://localhost:8000`.

### Frontend Setup

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   # or
   pnpm install
   ```
3. Create a `.env` file containing your Privy App ID (if required by the implementation, check `.env.example` if available, typically `NEXT_PUBLIC_PRIVY_APP_ID`).

4. Start the development server:
   ```bash
   npm run dev
   ```
   Frontend will run on `http://localhost:3000`.

## 🎮 Usage

1. Open `http://localhost:3000` in your browser.
2. **Login** using Privy (Email/Social).
3. **Claim Faucet**: Use the "Claim Faucet" button to get some test mUSDT tokens.
4. **Access Protected Resource**: Click the orange "Access Protected Resource" button.
   - Watch the logs on the screen as the app automatically negotiates the 402 Payment Required response.
   - It will send the payment, wait for confirmation, and verify with the server.
5. **Success**: You will see the "Access Granted" message and the protected data returned from the server.

## 💻 Tech Stack

- **Languages**: TypeScript, JavaScript
- **Frameworks**: Next.js, Express.js
- **Blockchain**: Arbitrum Sepolia
- **Libraries**: Ethers.js, Viem, Wagmi, Privy React SDK, TailwindCSS
