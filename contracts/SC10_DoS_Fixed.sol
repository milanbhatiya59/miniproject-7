// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/*
 * SC10: Denial of Service (DoS) - Fixed Version
 * 
 * This demonstrates the proper way to handle refunds:
 * 1. Use withdrawal pattern instead of push pattern
 * 2. Implement pull over push (users initiate withdrawals)
 * 3. Use enumerable mappings or pagination for large user sets
 * 4. Avoid unbounded loops in single transactions
 */

contract SC10_DoS_Fixed {
    mapping(address => uint256) public balances;
    mapping(address => bool) public hasDeposited;
    
    // Pagination support
    uint256 public constant BATCH_SIZE = 100;
    uint256 public processedIndex = 0;

    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);
    event BatchRefunded(uint256 count);

    // Users can deposit ETH
    function deposit() external payable {
        require(msg.value > 0, "Deposit amount must be greater than 0");
        
        balances[msg.sender] += msg.value;
        hasDeposited[msg.sender] = true;

        emit Deposit(msg.sender, msg.value);
    }

    // FIXED: User initiates their own withdrawal (pull pattern)
    function withdraw(uint256 amount) external {
        require(amount > 0, "Withdrawal amount must be greater than 0");
        require(balances[msg.sender] >= amount, "Insufficient balance");

        balances[msg.sender] -= amount;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Withdrawal failed");

        emit Withdrawal(msg.sender, amount);
    }

    // FIXED: Refund in batches to avoid running out of gas
    // This function can be called multiple times to process all users
    function refundBatch(address[] calldata users) external {
        require(users.length <= BATCH_SIZE, "Batch size too large");

        // FIXED: Bounded loop with explicit user list
        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            uint256 amount = balances[user];
            
            if (amount > 0) {
                balances[user] = 0;
                (bool success, ) = payable(user).call{value: amount}("");
                require(success, "Refund failed");
            }
        }

        emit BatchRefunded(users.length);
    }

    // Check a user's balance
    function getBalance(address user) external view returns (uint256) {
        return balances[user];
    }

    // Check contract balance
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
