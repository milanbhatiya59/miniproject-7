// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/*
 * SC09: Insecure Randomness Vulnerability
 * 
 * This contract demonstrates the vulnerability of using block-based values
 * (blockhash, block.timestamp, block.number) for randomness. These values are:
 * 1. Visible to all participants on the blockchain
 * 2. Predictable or manipulable by miners/validators
 * 3. Not truly random
 * 
 * An attacker can predict the "random" number and exploit the contract.
 */

contract SC09_InsecureRandomness_Vulnerable {
    uint256 public lastWinningNumber;
    address public lastWinner;
    uint256 public prizePool;

    event LotteryNumber(uint256 indexed number);
    event Winner(address indexed winner, uint256 amount);

    // Players bet 1 ETH to guess the random number (1-100)
    function playLottery(uint256 guess) external payable {
        require(msg.value == 1 ether, "Bet amount must be exactly 1 ETH");
        require(guess >= 1 && guess <= 100, "Guess must be between 1 and 100");

        // VULNERABLE: Using block-based values to generate "random" number
        // This is predictable and visible to everyone
        uint256 randomNumber = (uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp,      // ❌ Predictable - known in advance
                    block.number,         // ❌ Known to miners
                    msg.sender,           // ❌ Known by the attacker
                    blockhash(block.number - 1)  // ❌ Visible to attacker
                )
            )
        ) % 100) + 1;

        lastWinningNumber = randomNumber;
        prizePool += msg.value;

        emit LotteryNumber(randomNumber);

        // If the guess matches, they win
        if (guess == randomNumber) {
            lastWinner = msg.sender;
            uint256 prize = prizePool;
            prizePool = 0;

            // Send the prize
            (bool success, ) = msg.sender.call{value: prize}("");
            require(success, "Prize transfer failed");

            emit Winner(msg.sender, prize);
        }
    }

    // Allows contract to receive ETH
    receive() external payable {
        prizePool += msg.value;
    }

    // Check current prize pool
    function getPrizePool() external view returns (uint256) {
        return prizePool;
    }

    // Predictable function - attacker can call this to get the next "random" number
    function predictNextNumber() external view returns (uint256) {
        uint256 predictedNumber = (uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp,
                    block.number,
                    address(this),
                    blockhash(block.number - 1)
                )
            )
        ) % 100) + 1;

        return predictedNumber;
    }
}
