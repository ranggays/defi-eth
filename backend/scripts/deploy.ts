import {run, network, ethers} from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";

async function main(){
    console.log("Starting Deployment....");

    // 1. Deploy Token (Dengan Faucet)
    const MockToken = await ethers.getContractFactory("MockToken");
    const token = await MockToken.deploy();
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();
    console.log(`Token deployed at: ${tokenAddress}`);

    // 2. Deploy Vault (Hubungkan dengan Token di atas)
    const SimpleVault = await ethers.getContractFactory("SimpleVault");
    const vault = await SimpleVault.deploy(tokenAddress);
    await vault.waitForDeployment();
    const vaultAddress = await vault.getAddress();
    console.log(`Vault deployed at: ${vaultAddress}`);

    console.log("Deployment Completed");

    // Verify Contract
    if(network.config.chainId === 11155111 && process.env.ETHERSCAN_API_KEY){
        await verify(tokenAddress, []);
        await verify(vaultAddress, [tokenAddress]);
    }
}

async function verify(contractAddress: string, args: any[]){
    console.log("Verifying Contract...");
    try {
        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: args
        })
    } catch (error: any) {
        if(error.message.toLowerCase().includes("already verified")){
            console.log("Already Verified!");
        } else {
            console.log(error);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
})