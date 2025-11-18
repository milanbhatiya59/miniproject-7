const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Function to update or append a variable in the .env file
function updateEnvFile(key, value) {
  const envFilePath = path.join(__dirname, "..", "frontend", ".env");
  let envFileContent = "";

  if (fs.existsSync(envFilePath)) {
    envFileContent = fs.readFileSync(envFilePath, "utf8");
  }

  const keyPattern = new RegExp(`^${key}=.*$`, "m");

  if (keyPattern.test(envFileContent)) {
    // Update existing key
    envFileContent = envFileContent.replace(keyPattern, `${key}=${value}`);
  } else {
    // Append new key
    envFileContent += `\n${key}=${value}`;
  }

  fs.writeFileSync(envFilePath, envFileContent);
  console.log(`✅ Updated ${key} in frontend/.env`);
}

async function main() {
  // Deploy the secure Crud contract
  const Crud = await ethers.getContractFactory("Crud");
  const crud = await Crud.deploy();
  await crud.waitForDeployment();
  console.log(`✅ Secure Crud contract deployed to: ${crud.target}`);
  updateEnvFile("VITE_CRUD_CONTRACT_ADDRESS", `'${crud.target}'`);

  // Deploy the SC04_LackOfInputValidation_Vulnerable contract
  const SC04_Vulnerable = await ethers.getContractFactory(
    "SC04_LackOfInputValidation_Vulnerable"
  );
  const sc04_vulnerable = await SC04_Vulnerable.deploy();
  await sc04_vulnerable.waitForDeployment();
  console.log(
    `🔴 SC04_LackOfInputValidation_Vulnerable contract deployed to: ${sc04_vulnerable.target}`
  );

  // Deploy the SC04_LackOfInputValidation_Fixed contract
  const SC04_Fixed = await ethers.getContractFactory(
    "SC04_LackOfInputValidation_Fixed"
  );
  const sc04_fixed = await SC04_Fixed.deploy();
  await sc04_fixed.waitForDeployment();
  console.log(
    `🟢 SC04_LackOfInputValidation_Fixed contract deployed to: ${sc04_fixed.target}`
  );

  // Deploy the SC08_IntegerOverflowAndUnderflow_Vulnerable contract
  const SC08_Vulnerable = await ethers.getContractFactory(
    "SC08_IntegerOverflowAndUnderflow_Vulnerable"
  );
  const sc08_vulnerable = await SC08_Vulnerable.deploy();
  await sc08_vulnerable.waitForDeployment();
  console.log(
    `🔴 SC08_IntegerOverflowAndUnderflow_Vulnerable contract deployed to: ${sc08_vulnerable.target}`
  );

  // Deploy the SC08_IntegerOverflowAndUnderflow_Fixed contract
  const SC08_Fixed = await ethers.getContractFactory(
    "SC08_IntegerOverflowAndUnderflow_Fixed"
  );
  const sc08_fixed = await SC08_Fixed.deploy();
  await sc08_fixed.waitForDeployment();
  console.log(
    `🟢 SC08_IntegerOverflowAndUnderflow_Fixed contract deployed to: ${sc08_fixed.target}`
  );

  // Deploy the SC01_ImproperAccessControl_Vulnerable contract
  const SC01_Vulnerable = await ethers.getContractFactory(
    "SC01_ImproperAccessControl_Vulnerable"
  );
  const sc01_vulnerable = await SC01_Vulnerable.deploy({
    value: ethers.parseEther("1"),
  });
  await sc01_vulnerable.waitForDeployment();
  console.log(
    `🔴 SC01_ImproperAccessControl_Vulnerable contract deployed to: ${sc01_vulnerable.target}`
  );
  console.log(
    `🔴 VITE_SC01_IMPROPER_ACCESS_CONTROL_VULNERABLE_ADDRESS='${sc01_vulnerable.target}'`
  );
  updateEnvFile(
    "VITE_SC01_IMPROPER_ACCESS_CONTROL_VULNERABLE_ADDRESS",
    `'${sc01_vulnerable.target}'`
  );

  // Deploy the SC01_ImproperAccessControl_Fixed contract
  const SC01_Fixed = await ethers.getContractFactory(
    "SC01_ImproperAccessControl_Fixed"
  );
  const sc01_fixed = await SC01_Fixed.deploy({ value: ethers.parseEther("1") });
  await sc01_fixed.waitForDeployment();
  console.log(
    `🟢 SC01_ImproperAccessControl_Fixed contract deployed to: ${sc01_fixed.target}`
  );
  updateEnvFile(
    "VITE_SC01_IMPROPER_ACCESS_CONTROL_FIXED_ADDRESS",
    `'${sc01_fixed.target}'`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
