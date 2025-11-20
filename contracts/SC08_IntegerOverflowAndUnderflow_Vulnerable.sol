// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SC08_IntegerOverflowAndUnderflow_Vulnerable {
    uint8 public balance;

    constructor() {
        balance = 255; // Maximum value of uint8
    }

    // Increments the balance by a given value
    function increment(uint8 value) public {
        unchecked {
            balance += value; // Vulnerable to overflow
        }
    }

    // Decrements the balance by a given value
    function decrement(uint8 value) public {
        unchecked {
            balance -= value; // Vulnerable to underflow
        }
    }

    // Explicit getter to avoid ambiguity
    function getBalance() public view returns (uint8) {
        return balance;
    }
}
