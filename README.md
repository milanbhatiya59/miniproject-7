# CRUD dApp - Vulnerability Demonstrations

This project is a Decentralized Application (dApp) designed to demonstrate common smart contract vulnerabilities. It provides a hands-on way to understand, exploit, and fix security flaws in Ethereum smart contracts.

The project includes:
- A Hardhat environment for smart contract development and testing.
- A React frontend (using Vite) to interact with the deployed contracts.
- A secure CRUD (Create, Read, Update, Delete) contract.
- A series of vulnerable contracts, each demonstrating a specific security risk.

## Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/en/) (v18.x or later recommended)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- [MetaMask](https://metamask.io/) browser extension

## 1. Project Setup

Clone the repository and install all the necessary dependencies for both the root project (Hardhat) and the frontend.

```bash
# Clone the repository (if you haven't already)
# git clone <repository-url>
cd my-crud-dapp

# Install root dependencies (for Hardhat)
npm install

# Install frontend dependencies
npm install --prefix frontend
```

### Step 1.1: Configure Environment Variables (Frontend)

The frontend uses environment variables to store contract addresses. This allows for easy switching between different deployments (e.g., local, testnet, mainnet) and avoids hardcoding.

1.  **Create `.env` file:** In the `frontend/` directory, create a file named `.env`.
2.  **Add Contract Addresses:** After deploying your contracts (see Step 2.3), copy their addresses into the `.env` file. For example:

    ```
    VITE_SC01_IMPROPER_ACCESS_CONTROL_VULNERABLE_ADDRESS='0x...'
    VITE_SC04_LACK_OF_INPUT_VALIDATION_VULNERABLE_ADDRESS='0x...'
    VITE_SC08_INTEGER_OVERFLOW_AND_UNDERFLOW_VULNERABLE_ADDRESS='0x...'
    ```
    **Note:** The `VITE_` prefix is required for Vite to expose these variables to the browser.

3.  **Important:** The `.env` file is already added to `frontend/.gitignore`, so it will not be committed to your repository. This is intentional to prevent environment-specific configurations from being shared.

## 2. Running the dApp

To run the dApp, you need three main components running simultaneously: the local blockchain, the deployed contracts, and the frontend application.

### Step 2.1: Start the Local Blockchain

Open a terminal and run the following command from the project root to start a local Hardhat blockchain node. This will simulate the Ethereum network on your machine.

```bash
npx hardhat node
```

This command will also generate a list of 20 test accounts, each funded with 10000 ETH. We will use one of these accounts in MetaMask.

**Leave this terminal running.**

### Step 2.2: Configure MetaMask

To interact with the dApp, you need to connect MetaMask to your local Hardhat node.

1.  **Add a New Network:**
    *   Open MetaMask and click on the network dropdown at the top (it usually says "Ethereum Mainnet").
    *   Select "Add network" or "Add a custom network".
    *   Fill in the following details:
        *   **Network Name:** `Hardhat Localhost`
        *   **New RPC URL:** `http://127.0.0.1:8545`
        *   **Chain ID:** `31337`
        *   **Currency Symbol:** `ETH`
    *   Click **Save**.

2.  **Import a Test Account:**
    *   In the terminal where you ran `npx hardhat node`, copy the **Private Key** of one of the test accounts (e.g., Account #0).
    *   In MetaMask, click the circle icon at the top right and select "Import account".
    *   Paste the private key and click **Import**.

Your MetaMask is now connected to your local blockchain and funded with test ETH.

### Step 2.3: Deploy the Smart Contracts

Open a **new terminal** (leaving the blockchain node running) and run this command from the project root to deploy the contracts to your local network:

```bash
npx hardhat run scripts/deploy.js --network localhost
```

The terminal will output the addresses of the deployed contracts. The frontend is already configured to use these addresses.

### Step 2.4: Start the Frontend

Finally, start the React development server:

```bash
# From the project root
npm run dev --prefix frontend
```

This will start the frontend application, usually on `http://localhost:5173`. Open this URL in your browser to use the dApp.

## 3. Development Workflow

This project is structured to make team collaboration easy.

### Adding a New Vulnerability Page

1.  **Create the Smart Contract:** Add a new `.sol` file in the `contracts/` directory with the vulnerable and fixed versions of the contract.
2.  **Update Deployment Script:** Modify `scripts/deploy.js` to deploy your new contract.
3.  **Create the Frontend Page:** Add a new `.tsx` component file in `frontend/src/pages/` for the vulnerability. Use this page to interact with your new contract.
4.  **Add a Route:** In `frontend/src/App.tsx`, add a new route to your newly created page.
5.  **Add Navigation:** Add a link to your new page in the navigation component (e.g., `frontend/src/components/Layout.tsx`).

### Git Branching

Follow this simple branching strategy:
1.  Create a new branch from `main` for your feature (e.g., `git checkout -b feat/new-vulnerability`).
2.  Make your changes.
3.  Push your branch and open a Pull Request to merge your changes back into `main`.

## 4. Scripts Overview

- `npm test`: Runs the Hardhat smart contract tests.
- `npm run dev --prefix frontend`: Starts the frontend development server.
- `npx hardhat node`: Starts the local blockchain simulation.
- `npx hardhat run <script> --network localhost`: Executes a script on the local network.
- `node static-analysis/programFlowAnalyzer.js [path]`: Runs the static program-flow analyzer. Omit `path` to scan everything under `contracts/`, or pass a specific file/folder to narrow the scope.
