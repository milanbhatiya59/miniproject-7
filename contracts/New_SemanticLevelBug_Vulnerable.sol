// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/*
 SemanticOpcodeBugDemo
 - Demonstrates a subtle bug where inline assembly writes to storage
   using an incorrect slot calculation, causing partial overwrite of unrelated state.
 - This models an "opcode-level semantic" mistake that static-rule checkers may miss.
*/
contract SemanticOpcodeBugDemo {
    // storage layout:
    // slot 0: owner (address)
    // slot 1: config (uint256) -- packed fields imagined
    address public owner;
    uint256 public config; // suppose bits: [0..127]=limit, [128..255]=flags

    constructor() {
        owner = msg.sender;
        // set config to some packed value
        config = (uint256(1) << 128) | uint256(100); // flags=1, limit=100
    }

    // developer writes a helper in assembly to update only the 'limit' part of config,
    // but computes the storage slot incorrectly (off-by-one), causing corruption.
    function setLimitBad(uint256 newLimit) public {
        require(msg.sender == owner, "only owner");
        // intended to update lower 128 bits of config (slot 1)
        assembly {
            // BUG: uses slot 2 instead of slot 1 (imagine a mistaken keccak offset)
            sstore(2, newLimit)
        }
    }

    // safe getter interprets config from slot 1 (but slot 1 unchanged)
    function getLimit() public view returns (uint256) {
        return uint256(config & ((uint256(1) << 128) - 1));
    }
}
