
const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Initiating demonstration of Semantic Level Bug...");

  // --- 1. GET THE SIGNERS ---
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer Address: ${deployer.address}`);

  // --- 2. DEPLOY THE CONTRACT ---
  console.log("\nDeploying SemanticOpcodeBugDemo...");
  const SemanticOpcodeBugDemo = await ethers.getContractFactory("SemanticOpcodeBugDemo");
  const contract = await SemanticOpcodeBugDemo.deploy();
  await contract.waitForDeployment();
  console.log(`SemanticOpcodeBugDemo deployed at: ${contract.target}`);

  // --- 3. CHECK INITIAL STATE ---
  let config = await contract.config();
  let limit = await contract.getLimit();
  console.log("\nInitial State:");
  console.log(`   - Config: ${config.toString()}`);
  console.log(`   - Limit: ${limit.toString()}`);
  
  // --- 4. TRIGGER THE BUG ---
  console.log("\nCalling setLimitBad to trigger the bug...");
  const newLimitValue = 999;
  const tx = await contract.connect(deployer).setLimitBad(newLimitValue);
  await tx.wait();
  console.log("✅ setLimitBad transaction successful!");

  // --- 5. CHECK FINAL STATE ---
  config = await contract.config();
  limit = await contract.getLimit();
  
  console.log("\nFinal State:");
  console.log(`   - Config: ${config.toString()}`);
  console.log(`   - Limit: ${limit.toString()}`);

  // --- 6. VERIFY THE BUG ---
  // We check the storage slot that was supposed to be written to, and the one that was actually written to.
  const configSlotValue = await ethers.provider.getStorage(contract.target, 1);
  const bugSlotValue = await ethers.provider.getStorage(contract.target, 2);

  console.log("\nVerifying storage slots:");
  console.log(`   - Storage Slot 1 (config): ${ethers.toBeHex(configSlotValue)}`);
  console.log(`   - Storage Slot 2 (bug):    ${ethers.toBeHex(bugSlotValue)}`);


  if (limit.toString() !== newLimitValue.toString() && ethers.toBigInt(bugSlotValue) == newLimitValue) {
    console.log("\n🎉 SUCCESS: The semantic bug was triggered! `config` was not updated, but an adjacent storage slot was overwritten.");
  } else {
    console.log("\n😞 FAILED: The bug was not triggered as expected.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
