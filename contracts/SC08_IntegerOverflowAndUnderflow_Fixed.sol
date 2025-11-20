// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract SC08_IntegerOverflowAndUnderflow_Fixed is Ownable {
    uint8 public balance;

    constructor() Ownable(msg.sender) {
        balance = type(uint8).max; // 255
    }

    // Increments the balance by a given value with explicit bound checking
    function increment(uint8 value) public onlyOwner {
        require(value > 0, "Value must be greater than zero");

        // Explicit input bound that static analyzers want
        require(value <= type(uint8).max - balance,"Value too large: overflow would occur");
        balance += value;
    }

    // Decrements the balance by a given value with explicit bound checking
    function decrement(uint8 value) public onlyOwner {
        require(value > 0, "Value must be greater than zero");
        // Explicit input bound
        require(value <= balance, "Value too large: underflow would occur");

        balance -= value;
    }
}
