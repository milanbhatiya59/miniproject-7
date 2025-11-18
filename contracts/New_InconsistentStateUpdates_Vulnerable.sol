// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/*
 InconsistentStateToken
 - Maintains both balances[] AND totalSupply.
 - Some functions update balances but forget to update totalSupply,
   leading to inconsistent invariants.
*/
contract InconsistentStateToken {
    mapping(address => uint256) public balances;
    uint256 public totalSupply;

    constructor() {
        // initial supply assigned to deployer
        balances[msg.sender] = 1000;
        totalSupply = 1000;
    }

    // normal mint updates both balances and totalSupply
    function mint(address to, uint256 amount) public {
        balances[to] += amount;
        totalSupply += amount;
    }

    // OOPS: a "rescue" function that credits a user but forgets to update totalSupply
    // (simulates a code path introduced later that misses an invariant)
    function rescueCredit(address to, uint256 amount) public {
        // intended as a utility to credit users, but developer forgot totalSupply update
        balances[to] += amount;
        // totalSupply NOT UPDATED -> inconsistent state
    }

    // naive burn updates balances and reduces totalSupply
    function burn(uint256 amount) public {
        require(balances[msg.sender] >= amount, "insufficient");
        balances[msg.sender] -= amount;
        totalSupply -= amount;
    }

    // view helper to assert invariant (for auditors)
    function checkInvariant() public view returns (bool) {
        uint256 sum = 0;
        // NOTE: for simplicity this loops over a small set only in example
        // In real token this approach is unfeasible; invariant reasoning must be by design
        return sum == totalSupply;
    }
}
