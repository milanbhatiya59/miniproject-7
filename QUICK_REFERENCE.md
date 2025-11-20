# Quick Reference Guide - SC05, SC09, SC10

## One-Line Summaries

| Code | Vulnerability | Problem | Solution |
|------|---|---|---|
| **SC05** | Reentrancy | State updated after external call | Update state FIRST (CEI) |
| **SC09** | Insecure Randomness | Block values are predictable | Use Chainlink VRF |
| **SC10** | DoS via Loops | Unbounded array iteration | Use batching & bounds |

---

## SC05: Reentrancy - Visual Attack Flow

```
┌─────────────────────────────────────────────────────────┐
│ Attacker deposits 1 ETH                                 │
├─────────────────────────────────────────────────────────┤
│ Attacker calls withdraw(1 ETH)                          │
├─────────────────────────────────────────────────────────┤
│ Contract checks: balance[attacker] = 1 ETH ✓            │
├─────────────────────────────────────────────────────────┤
│ Contract calls: msg.sender.call{value: 1 ETH}("")       │
│    ↓                                                      │
│    Attacker's receive() function is triggered!           │
│    ↓                                                      │
│    receive() calls withdraw(1 ETH) again                 │
│    ↓                                                      │
│    Contract checks: balance[attacker] = 1 ETH ✓ (!)      │
│    ← REENTRANCY! Balance not updated yet!                │
│                                                          │
│ Contract continues... balance -= 1 ETH                   │
└─────────────────────────────────────────────────────────┘

Result: Attacker gets 1 ETH but balance only decreased by 1 ETH total
(In more complex scenarios, attacker could drain entire contract)
```

### Fix: CEI Pattern
```
1. CHECK inputs (require statements)
2. EFFECTS (update state)
3. INTERACTIONS (external calls)

✓ Safe: State is final before any external calls
```

---

## SC09: Insecure Randomness - Why It's Predictable

```
function playLottery(uint256 guess) external payable {
    uint256 randomNumber = uint256(keccak256(
        abi.encodePacked(
            block.timestamp,  ← Attacker knows this
            block.number,     ← Attacker knows this
            msg.sender,       ← Attacker's own address
            blockhash(...)    ← Visible on blockchain
        )
    )) % 100 + 1;
}

ATTACK:
1. Call predictNextNumber() → Get value "54"
2. Call playLottery(54)
3. Same block = same randomness = GUARANTEED WIN
```

### Why Blockchain Values Are Bad RNG

| Property | Block.timestamp | Block.number | Blockhash | msg.sender |
|----------|---|---|---|---|
| **Public?** | Yes | Yes | Yes | Yes |
| **Predictable?** | Yes (miners control) | Yes (sequential) | Yes (public) | Yes (attacker) |
| **Can be manipulated?** | Yes (±15s) | Yes (in bounds) | Yes (by miner) | Yes (deploy new contract) |
| **Good for RNG?** | ❌ NO | ❌ NO | ❌ NO | ❌ NO |

### Solution: Chainlink VRF
```solidity
// Chainlink VRF provides provably fair randomness
uint256 randomNumber = (randomness % 100) + 1;
// Impossible to predict or manipulate!
```

---

## SC10: DoS Attack - How It Works

```
Initial State:
users[] = [Alice, Bob, Charlie, Dave, Eve, Frank]  (6 users)

Attacker's flood() function:
for i = 1 to 50:
    deposit()  → adds attacker to users[]

users[] = [Alice, Bob, Charlie, Dave, Eve, Frank, Attacker, Attacker, Attacker, ...]

Total users: 56

When refundAll() is called:
for i = 0 to users.length:
    transfer(users[i].balance)

With 56 users × ~21,000 gas each = 1,176,000 gas
(Exceeds block gas limit of ~30,000,000 on purpose or causes issues)

Result: Either refundAll() fails or uses excessive gas
```

### Gas Calculation
```
Per transfer: ~21,000 gas (base) + storage operations
Per user: ~50,000 - 100,000 gas
100 users: 5,000,000 - 10,000,000 gas

With TX gas limit of 6,721,975:
Max ~67-100 users before out of gas

Attacker adds 1,000 users:
refundAll() completely unusable
```

### Solution: Batch Processing
```solidity
// OLD (Vulnerable):
function refundAll() {
    for (uint i; i < users.length; i++) {
        refund(users[i]);
    }
}

// NEW (Safe):
function refundBatch(address[] calldata users) {
    require(users.length <= 100); // Bounded!
    for (uint i; i < users.length; i++) {
        refund(users[i]);
    }
}

// Call multiple times if needed:
refundBatch(addresses_0_to_99);
refundBatch(addresses_100_to_199);
// etc...
```

---

## Running Attacks

### SC05 Reentrancy
```bash
npx hardhat run scripts/attack_sc05.js

# Expected Output:
# 🎉 SUCCESS: Reentrancy attack successful!
# - Attacker contract received: 1.0 ETH
```

### SC09 Insecure Randomness
```bash
npx hardhat run scripts/attack_sc09.js

# Expected Output:
# ⚠️ DEMONSTRATION: Randomness is predictable!
# - The predictNextNumber() function returns a value every time
```

### SC10 DoS
```bash
npx hardhat run scripts/attack_sc10.js

# Expected Output:
# 🎉 DENIAL OF SERVICE ATTACK SUCCESSFUL!
# - Attacker created an unbounded state with 7+ users
```

---

## Code Snippets - Vulnerable vs Fixed

### SC05: Reentrancy

**❌ VULNERABLE:**
```solidity
function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount);
    (bool ok, ) = msg.sender.call{value: amount}("");
    require(ok);
    balances[msg.sender] -= amount;  // TOO LATE!
}
```

**✅ FIXED:**
```solidity
function withdraw(uint256 amount) external {
    require(balances[msg.sender] >= amount);
    balances[msg.sender] -= amount;  // FIRST
    (bool ok, ) = msg.sender.call{value: amount}("");
    require(ok);
}
```

---

### SC09: Insecure Randomness

**❌ VULNERABLE:**
```solidity
function getRandomNumber() internal view returns (uint256) {
    return uint256(keccak256(
        abi.encodePacked(block.timestamp, block.number, msg.sender)
    ));
}
```

**✅ FIXED:**
```solidity
// Use Chainlink VRF
import "@chainlink/contracts/src/v0.8/VRFConsumerBase.sol";

function requestRandomNumber() external {
    requestRandomness(keyHash, fee);
}

function fulfillRandomness(bytes32, uint256 randomness) internal override {
    randomNumber = randomness;
}
```

---

### SC10: DoS

**❌ VULNERABLE:**
```solidity
address[] public users;

function deposit() external payable {
    users.push(msg.sender);  // Unbounded!
}

function refundAll() external {
    for (uint i; i < users.length; i++) {  // No bounds!
        transfer(users[i].balance);
    }
}
```

**✅ FIXED:**
```solidity
function deposit() external payable {
    balances[msg.sender] += msg.value;
    // No array needed! Users track their own balance
}

function withdraw(uint256 amount) external {  // Pull pattern
    require(balances[msg.sender] >= amount);
    balances[msg.sender] -= amount;
    (bool ok, ) = msg.sender.call{value: amount}("");
    require(ok);
}

// OR with batching:
function refundBatch(address[] calldata users) external {
    require(users.length <= 100);  // BOUNDED!
    for (uint i; i < users.length; i++) {
        transfer(users[i].balance);
    }
}
```

---

## Testing Checklist

- [x] SC05 attack script executes successfully
- [x] SC05 demonstrates reentrancy
- [x] SC09 attack script executes successfully
- [x] SC09 demonstrates predictable randomness
- [x] SC10 attack script executes successfully
- [x] SC10 demonstrates DoS via flooding
- [x] All fixed contracts prevent attacks
- [x] All attack contracts properly designed
- [x] Documentation complete

---

## Key Takeaways

| Vulnerability | Key Lesson | Prevention |
|---|---|---|
| **SC05** | Order matters in security | Use CEI pattern always |
| **SC09** | Blockchain is transparent | Use proper RNG oracles |
| **SC10** | Loops can break contracts | Bound all iterations |

---

## Resources

- [OpenZeppelin ReentrancyGuard](https://docs.openzeppelin.com/contracts/4.x/api/security#ReentrancyGuard)
- [Chainlink VRF Documentation](https://docs.chain.link/vrf/v2/introduction)
- [Solidity Security Best Practices](https://solidity.readthedocs.io/en/latest/security-considerations.html)

---

**Created**: November 20, 2025 | **Status**: Complete ✅
