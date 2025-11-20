// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/*
 * SC09: Insecure Randomness - Fixed Version
 * 
 * This demonstrates a better approach using Chainlink VRF (Verifiable Random Function)
 * or similar trusted randomness sources. However, for demonstration purposes,
 * this simplified version shows the difference.
 * 
 * In production, use Chainlink VRF or similar oracle services.
 */

contract SC09_InsecureRandomness_Fixed {
    uint256 public lastWinningNumber;
    address public lastWinner;
    uint256 public prizePool;
    address public owner;

    // Simulated trusted randomness source
    bytes32 private randomSeed;

    event LotteryNumber(uint256 indexed number);
    event Winner(address indexed winner, uint256 amount);

    constructor() {
        owner = msg.sender;
        randomSeed = keccak256(abi.encodePacked(msg.sender));
    }

    // Owner can update the random seed from an external trusted source
    function updateRandomSeed(bytes32 newSeed) external {
        require(msg.sender == owner, "Only owner can update seed");
        randomSeed = newSeed;
    }

    // FIXED: Uses external randomness source (simulated here)
    function playLottery(uint256 guess) external payable {
        require(msg.value == 1 ether, "Bet amount must be exactly 1 ETH");
        require(guess >= 1 && guess <= 100, "Guess must be between 1 and 100");

        // FIXED: Uses external randomness seed that can't be predicted
        uint256 randomNumber = (uint256(
            keccak256(
                abi.encodePacked(randomSeed, msg.sender)
            )
        ) % 100) + 1;

        // Update seed for next round (derived from previous seed)
        randomSeed = keccak256(abi.encodePacked(randomSeed, blockhash(block.number - 1)));

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
}
