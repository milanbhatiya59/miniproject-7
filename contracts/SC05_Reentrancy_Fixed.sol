// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/*
 * SC05: Reentrancy - Fixed Version
 * 
 * This is the corrected version that prevents reentrancy attacks by following
 * the Checks-Effects-Interactions (CEI) pattern:
 * 1. Check: Verify preconditions
 * 2. Effects: Update contract state
 * 3. Interactions: Call external contracts
 */

contract SC05_Reentrancy_Fixed {
    mapping(address => uint256) public balances;

    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);

    // Allows users to deposit ETH into the contract
    function deposit() external payable {
        require(msg.value > 0, "Deposit amount must be greater than 0");
        balances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    // FIXED: Updates state BEFORE calling external contract (CEI pattern)
    function withdraw(uint256 amount) external {
        require(amount > 0, "Withdrawal amount must be greater than 0");
        require(balances[msg.sender] >= amount, "Insufficient balance");

        // FIXED: Update balance FIRST
        balances[msg.sender] -= amount;

        // Then call external contract (safe now because balance is already updated)
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Withdrawal failed");

        emit Withdrawal(msg.sender, amount);
    }

    // Allows anyone to see the contract balance
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // Allows anyone to see their balance
    function getBalance(address user) external view returns (uint256) {
        return balances[user];
    }
}
