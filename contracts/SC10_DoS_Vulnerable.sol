// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/*
 * SC10: Denial of Service (DoS) Vulnerability
 * 
 * This contract demonstrates a DoS vulnerability through:
 * 1. Unbounded loops that can run out of gas
 * 2. Dependencies on external state that can be manipulated
 * 3. Failed transactions that prevent legitimate users from interacting
 * 
 * In this specific case, the refundAll() function iterates through all users
 * without bounds. If too many users are added, the function will consume
 * too much gas and fail, preventing anyone from withdrawing.
 */

contract SC10_DoS_Vulnerable {
    address[] public users;
    mapping(address => uint256) public balances;
    bool public locked;

    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);
    event AllRefunded();

    // Users can deposit ETH
    function deposit() external payable {
        require(msg.value > 0, "Deposit amount must be greater than 0");
        
        // Add user to array if they're not already there
        bool isNewUser = true;
        for (uint256 i = 0; i < users.length; i++) {
            if (users[i] == msg.sender) {
                isNewUser = false;
                break;
            }
        }
        if (isNewUser) {
            users.push(msg.sender);  // VULNERABLE: Unbounded array growth
        }

        balances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    // User can withdraw their balance individually
    function withdraw(uint256 amount) external {
        require(amount > 0, "Withdrawal amount must be greater than 0");
        require(balances[msg.sender] >= amount, "Insufficient balance");

        balances[msg.sender] -= amount;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Withdrawal failed");

        emit Withdrawal(msg.sender, amount);
    }

    // VULNERABLE: This function can cause DoS by running out of gas
    // If there are too many users, this loop will consume all gas and fail
    function refundAll() external {
        require(!locked, "Already refunding");
        locked = true;

        // VULNERABLE: Unbounded loop that can run out of gas
        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            uint256 amount = balances[user];
            
            if (amount > 0) {
                balances[user] = 0;
                (bool success, ) = payable(user).call{value: amount}("");
                require(success, "Refund failed");
            }
        }

        locked = false;
        emit AllRefunded();
    }

    // Check the number of registered users
    function getUserCount() external view returns (uint256) {
        return users.length;
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
