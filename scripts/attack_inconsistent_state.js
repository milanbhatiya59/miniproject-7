
const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Initiating demonstration of Inconsistent State...");

  // --- 1. GET THE SIGNERS ---
  const [deployer, user] = await ethers.getSigners();
  console.log(`Deployer Address: ${deployer.address}`);
  console.log(`User Address: ${user.address}`);

  // --- 2. DEPLOY THE CONTRACT ---
  console.log("\nDeploying InconsistentStateToken...");
  const InconsistentStateToken = await ethers.getContractFactory("InconsistentStateToken");
  const token = await InconsistentStateToken.deploy();
  await token.waitForDeployment();
  console.log(`InconsistentStateToken deployed at: ${token.target}`);

  // --- 3. CHECK INITIAL STATE ---
  let deployerBalance = await token.balances(deployer.address);
  let totalSupply = await token.totalSupply();
  console.log("\nInitial State:");
  console.log(`   - Deployer Balance: ${deployerBalance.toString()}`);
  console.log(`   - Total Supply: ${totalSupply.toString()}`);
  

  // --- 4. INDUCE INCONSISTENT STATE ---
  console.log("\nCalling rescueCredit to induce inconsistent state...");
  const rescueTx = await token.connect(deployer).rescueCredit(user.address, 500);
  await rescueTx.wait();
  console.log("✅ rescueCredit transaction successful!");

  // --- 5. CHECK FINAL STATE ---
  deployerBalance = await token.balances(deployer.address);
  let userBalance = await token.balances(user.address);
  totalSupply = await token.totalSupply();
  
  console.log("\nFinal State:");
  console.log(`   - Deployer Balance: ${deployerBalance.toString()}`);
  console.log(`   - User Balance: ${userBalance.toString()}`);
  console.log(`   - Total Supply: ${totalSupply.toString()}`);

  const calculatedTotalSupply = deployerBalance + userBalance;
  console.log(`   - Calculated Total Supply (sum of balances): ${calculatedTotalSupply}`);


  if (calculatedTotalSupply !== totalSupply) {
    console.log("\n🎉 SUCCESS: The contract state is inconsistent!");
    console.log(`   - Discrepancy: ${calculatedTotalSupply - totalSupply}`);
  } else {
    console.log("\n😞 FAILED: The contract state remains consistent.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
