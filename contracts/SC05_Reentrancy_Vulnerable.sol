// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/*
 * SC05: Reentrancy Vulnerability
 * 
 * This contract demonstrates a classic reentrancy vulnerability where a function
 * calls an external contract before updating its state. This allows the external
 * contract to call back into this contract and drain its funds.
 * 
 * The vulnerability is in the withdraw() function which follows the wrong pattern:
 * 1. Calls external contract (vulnerable to reentrancy)
 * 2. Updates state after external call
 * 
 * The correct pattern should be:
 * 1. Update state first (Checks-Effects-Interactions)
 * 2. Call external contract
 */

contract SC05_Reentrancy_Vulnerable {
    mapping(address => uint256) public balances;

    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);

    // Allows users to deposit ETH into the contract
    function deposit() external payable {
        require(msg.value > 0, "Deposit amount must be greater than 0");
        balances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    // VULNERABLE: Calls external contract before updating state
    function withdraw(uint256 amount) external {
        require(amount > 0, "Withdrawal amount must be greater than 0");
        require(balances[msg.sender] >= amount, "Insufficient balance");

        // VULNERABLE: Sends ETH before updating balance
        // This allows the receiver to call withdraw() again before the balance is updated
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Withdrawal failed");

        // State update happens AFTER external call - TOO LATE!
        balances[msg.sender] -= amount;
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
