import React, { useState, useEffect } from 'react';
import { ethers, BrowserProvider, JsonRpcSigner } from 'ethers';

// --- TYPE DEFINITIONS ---
declare global {
  interface Window {
    ethereum?: any;
  }
}

// --- CONTRACT CONFIGURATION ---
const TOKEN_ADDRESS = "0xD4b9623e76Ab278a02ef4529782e27EACC085869"; 
const VAULT_ADDRESS = "0xbF2b6DDf0987fB4B1C336312385142e50B55c596";

// Minimal ABI
const TOKEN_ABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address, uint256) returns (bool)",
  "function allowance(address, address) view returns (uint256)",
  "function faucet() external"
];

const VAULT_ABI = [
  "function deposit(uint256)",
  "function withdraw(uint256)",
  "function balances(address) view returns (uint256)"
];

export default function SimpleDeFiVault() {
  // --- STATE ---
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  
  const [tokenBalance, setTokenBalance] = useState<string>("0");
  const [vaultBalance, setVaultBalance] = useState<string>("0");
  const [contractBalance, setContractBalance] = useState<string>("0");
  const [amount, setAmount] = useState<string>("");
  const [isLoadingFaucet, setIsLoadingFaucet] = useState<boolean>(false);
  const [isLoadingDeposit, setIsLoadingDeposit] = useState<boolean>(false);
  const [isLoadingWithdraw, setIsLoadingWithdraw] = useState<boolean>(false);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    const autoConnect = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            // User is already connected
            const _provider = new ethers.BrowserProvider(window.ethereum);
            const _signer = await _provider.getSigner();
            const _address = await _signer.getAddress();
            const _network = await _provider.getNetwork();

            setProvider(_provider);
            setSigner(_signer);
            setUserAddress(_address);
            setChainId(_network.chainId.toString());
          }
        } catch (error) {
          console.error("Auto-connect error:", error);
        }
      }
    };

    autoConnect();

    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length === 0) {
          // User disconnected
          setProvider(null);
          setSigner(null);
          setUserAddress(null);
          setChainId(null);
        } else {
          // Account changed, reconnect
          window.location.reload();
        }
      });

      window.ethereum.on('chainChanged', () => {
        // Chain changed, reload
        window.location.reload();
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners('accountsChanged');
        window.ethereum.removeAllListeners('chainChanged');
      }
    };
  }, []);

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const _provider = new ethers.BrowserProvider(window.ethereum);
        const _signer = await _provider.getSigner();
        const _address = await _signer.getAddress();
        const _network = await _provider.getNetwork();

        setProvider(_provider);
        setSigner(_signer);
        setUserAddress(_address);
        setChainId(_network.chainId.toString());
      } catch (error) {
        console.error("Connection Error:", error);
      }
    } else {
      alert("Please install Metamask!");
    }
  };

  const refreshData = async () => {
    if (!signer || !userAddress) return;
    try {
      const tokenContract = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer);
      const vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);

      const tBal: bigint = await tokenContract.balanceOf(userAddress);
      const vBal: bigint = await vaultContract.balances(userAddress);
      const cBal: bigint = await tokenContract.balanceOf(VAULT_ADDRESS);

      setTokenBalance(ethers.formatUnits(tBal, 18)); 
      setVaultBalance(ethers.formatUnits(vBal, 18));
      setContractBalance(ethers.formatUnits(cBal, 18));
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  useEffect(() => {
    if (signer) refreshData();
  }, [signer]);

  const handleFaucet = async () => {
    if (!signer) return;
    setIsLoadingFaucet(true);
    setStatus("Minting 1,000 mUSD...");
    try {
      const contract = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer);
      const tx = await contract.faucet();
      await tx.wait();
      setStatus("Success! Tokens received.");
      refreshData();
    } catch (err: any) {
      console.error(err);
      setStatus("Faucet failed.");
    }
    setIsLoadingFaucet(false);
  };

  const handleDeposit = async () => {
    if (!signer || !amount || parseFloat(amount) <= 0) return;
    setIsLoadingDeposit(true);
    try {
      const tokenContract = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer);
      const vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);
      const weiAmount = ethers.parseUnits(amount, 18);

      setStatus("Checking allowance...");
      const allowance: bigint = await tokenContract.allowance(userAddress, VAULT_ADDRESS);

      if (allowance < weiAmount) {
        setStatus("Approving Vault...");
        const txApprove = await tokenContract.approve(VAULT_ADDRESS, weiAmount);
        await txApprove.wait();
        setStatus("Approved! Now depositing...");
      }

      setStatus("Depositing...");
      const txDeposit = await vaultContract.deposit(weiAmount);
      await txDeposit.wait();
      
      setStatus("Deposit Successful!");
      setAmount("");
      refreshData();
    } catch (err: any) {
      console.error(err);
      setStatus("Transaction Failed: " + (err.reason || err.message || "Unknown Error"));
    }
    setIsLoadingDeposit(false);
  };

  const handleWithdraw = async () => {
    if (!signer || !amount || parseFloat(amount) <= 0) return;
    setIsLoadingWithdraw(true);
    setStatus("Withdrawing...");
    try {
      const vaultContract = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer);
      const weiAmount = ethers.parseUnits(amount, 18);

      const tx = await vaultContract.withdraw(weiAmount);
      await tx.wait();

      setStatus("Withdraw Successful!");
      setAmount("");
      refreshData();
    } catch (err: any) {
      console.error(err);
      setStatus("Withdraw Failed: " + (err.reason || "Unknown Error"));
    }
    setIsLoadingWithdraw(false);
  };

  const isSepolia = chainId === "11155111";
  
  return (
    <div className="h-screen bg-black overflow-hidden">
      {/* Subtle grid overlay */}
      <div className="fixed inset-0 opacity-[0.015] pointer-events-none" 
           style={{backgroundImage: 'repeating-linear-gradient(0deg, #fff 0px, #fff 1px, transparent 1px, transparent 80px), repeating-linear-gradient(90deg, #fff 0px, #fff 1px, transparent 1px, transparent 80px)'}}>
      </div>

      {/* Header */}
      <header className="relative z-50 border-b border-white/10 bg-black">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-2xl font-bold text-white tracking-tight hover:text-gray-300 transition-colors cursor-pointer">
              DEFI VAULT
            </a>
          </div>
          
          <nav className="hidden md:flex items-center gap-8 text-sm">
            <a href="/" className="text-gray-400 hover:text-white transition-colors cursor-pointer">
              Home
            </a>
            <a href="https://ethereum.org/en/defi/" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors cursor-pointer">
              Docs
            </a>
          </nav>
          
          {!userAddress ? (
            <button 
              onClick={connectWallet}
              className="bg-white text-black px-6 py-2.5 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
            >
              Connect Wallet
            </button>
          ) : (
            <div className="flex items-center gap-3">
              {!isSepolia && (
                <span className="text-xs text-red-400 border border-red-500/20 px-3 py-1.5 rounded-full">
                  Wrong Network
                </span>
              )}
              <div className="text-right">
                <p className="text-xs text-gray-500">Connected</p>
                <p className="text-sm font-mono text-white">
                  {userAddress.slice(0,6)}...{userAddress.slice(-4)}
                </p>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="relative container mx-auto px-6 py-4 max-w-7xl h-[calc(100vh-72px)] flex flex-col">
        {userAddress && isSepolia ? (
          <>
            {/* Main Content - 2 Column Layout */}
            <div className="grid lg:grid-cols-2 gap-6 grow">
              
              {/* LEFT COLUMN - Stats & Info */}
              <div className="space-y-6">
                {/* Title Section */}
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 mb-3">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                    <span className="text-xs text-gray-400 font-medium">Live on Sepolia</span>
                  </div>
                  <h1 className="text-4xl font-bold text-white mb-2">
                    DeFi Vault
                  </h1>
                  <p className="text-gray-400">
                    Deposit tokens and earn yield automatically
                  </p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-4">
                  {/* Wallet Balance */}
                  <div className="border border-white/10 bg-white/2 p-5 rounded-lg hover:border-white/20 transition-colors">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Wallet</p>
                    <p className="text-xl font-bold text-white">
                      {parseFloat(tokenBalance).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">mUSD</p>
                  </div>

                  {/* Vault Balance */}
                  <div className="border border-white/10 bg-white/2 p-5 rounded-lg hover:border-white/20 transition-colors">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">My Stake</p>
                    <p className="text-xl font-bold text-white">
                      {parseFloat(vaultBalance).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">mUSD</p>
                  </div>

                  {/* Total Value Locked */}
                  <div className="border border-white/10 bg-white/2 p-5 rounded-lg hover:border-white/20 transition-colors">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total TVL</p>
                    <p className="text-xl font-bold text-white">
                      {parseFloat(contractBalance).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">mUSD</p>
                  </div>
                </div>

                {/* Faucet Button */}
                <div className="border border-white/10 bg-white/2 p-5 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-white mb-1">Need Test Tokens?</p>
                      <p className="text-xs text-gray-500">Get 1,000 mUSD for free</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleFaucet}
                    disabled={isLoadingFaucet}
                    className="w-full border border-white/20 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-white/5 transition-colors disabled:opacity-50"
                  >
                    {isLoadingFaucet ? "Minting..." : "Get Free Tokens"}
                  </button>
                </div>

                {/* Status Message */}
                {status && (
                  <div className="border border-blue-500/20 bg-blue-500/5 rounded-lg p-4">
                    <p className="text-sm text-blue-300">{status}</p>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN - Transaction Panel */}
              <div className="border border-white/10 bg-white/2 rounded-lg p-6 flex flex-col">
                <h2 className="text-2xl font-bold text-white mb-6">Manage Liquidity</h2>
                
                <div className="grow flex flex-col justify-center space-y-6">
                  {/* Amount Input */}
                  <div className="space-y-2">
                    <label className="text-sm text-gray-500 uppercase tracking-wider">Amount</label>
                    <div className="border border-white/10 bg-black/30 rounded-lg p-4">
                      <input 
                        type="number" 
                        value={amount}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-transparent text-3xl text-white placeholder-gray-600 focus:outline-none font-mono"
                      />
                      <div className="flex justify-between items-center mt-3">
                        <span className="text-sm text-gray-500">mUSD</span>
                        <button 
                          onClick={() => setAmount(tokenBalance)}
                          className="text-xs text-gray-400 hover:text-white transition-colors"
                        >
                          Max: {parseFloat(tokenBalance).toFixed(2)}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={handleDeposit}
                      disabled={isLoadingDeposit || !amount || parseFloat(amount) <= 0}
                      className="bg-white text-black py-4 rounded-lg font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoadingDeposit ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                          <span>Processing...</span>
                        </div>
                      ) : (
                        "Deposit"
                      )}
                    </button>

                    <button 
                      onClick={handleWithdraw}
                      disabled={isLoadingWithdraw || !amount || parseFloat(amount) <= 0}
                      className="border border-white/20 text-white py-4 rounded-lg font-semibold hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoadingWithdraw ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                          <span>Processing...</span>
                        </div>
                      ) : (
                        "Withdraw"
                      )}
                    </button>
                  </div>

                  {/* Info Box */}
                  <div className="border border-white/10 bg-black/20 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="text-xs text-gray-400 leading-relaxed">
                        <p className="mb-2">Deposits are automatically staked to earn yield. You can withdraw anytime.</p>
                        <div className="flex items-center gap-2 mt-3">
                          <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                          <span className="text-green-400">Currently Earning Yield</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer - Centered across full width */}
            <div className="text-center py-3 border-t border-white/10 mt-4">
              <div className="inline-flex items-center gap-2 text-xs text-gray-500">
                <span>Powered by</span>
                <span className="text-white font-semibold">Ethereum Smart Contracts</span>
              </div>
            </div>
          </>
        ) : (
          /* Not Connected or Wrong Network */
          <div className="max-w-md mx-auto text-center">
            <div className="border border-white/10 bg-white/2 rounded-lg p-12">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full border border-white/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                {!userAddress ? "Connect Wallet" : "Wrong Network"}
              </h3>
              <p className="text-gray-400 mb-6">
                {!userAddress 
                  ? "Please connect your wallet to interact with the vault" 
                  : "Please switch to Sepolia Testnet to continue"}
              </p>
              {!userAddress && (
                <button 
                  onClick={connectWallet}
                  className="w-full bg-white text-black py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}