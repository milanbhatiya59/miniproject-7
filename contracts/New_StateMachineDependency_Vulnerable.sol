// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/*
 FragileEscrow
 - A multi-step process: deposit -> lockForProcessing -> finalizeRelease
 - The 'locked' intermediate state is fragile; external callbacks or delayed oracle updates
   can cause inconsistent transitions. No timeouts or robust checks are provided.
*/
contract FragileEscrow {
    mapping(address => uint256) public deposits;
    mapping(address => bool) public locked;
    address public processor; // external service expected to call finalize

    constructor(address _processor) {
        processor = _processor;
    }

    function deposit() external payable {
        require(msg.value > 0, "zero");
        deposits[msg.sender] += msg.value;
    }

    // processor sets 'locked' while some off-chain verification happens
    function lockForProcessing(address user) external {
        require(msg.sender == processor, "only processor");
        require(deposits[user] > 0, "no deposit");
        // set intermediate state
        locked[user] = true;
    }

    // finalizeRelease depends on off-chain state; if oracle or callback doesn't happen
    // contract can be left in locked state or attacker may find ways to change processor pointer
    function finalizeRelease(address user) external {
        // NOTE: this function assumes processor (off-chain) validated and now calls here
        require(locked[user], "not locked");
        uint256 amount = deposits[user];
        // forget to clear locked before external action (non-checks-effects-interactions)
        // also no verification of current oracle data: fragile transition dependency
        (bool ok, ) = payable(user).call{value: amount}("");
        require(ok, "transfer failed");
        deposits[user] = 0;
        // locked flag cleared *after* external call -> if reentrancy occurs, bad things happen
        locked[user] = false;
    }

    // attacker could try to change 'processor' via some other logic if present (not shown)
}
