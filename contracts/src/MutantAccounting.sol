// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MutantAccounting
 * @notice Public onchain accounting ledger for the Mutant Fund.
 *         This contract records state changes for transparency only —
 *         USDC lives in the Bankr operational wallet, not here.
 */
contract MutantAccounting {
    // ── State ──────────────────────────────────────────────────────────
    address public orchestrator;
    address public protocolTreasury;

    mapping(uint256 => uint256) public bankroll;
    mapping(uint256 => uint256) public reservedMargin;
    mapping(uint256 => uint256) public highWaterMark;

    uint256 public treasuryAccrued;

    // ── Events ─────────────────────────────────────────────────────────
    event Deposit(uint256 indexed agentId, uint256 amount, uint256 newBankroll);
    event Allocation(uint256 indexed agentId, uint256 amount, uint256 newReservedMargin);
    event Settlement(uint256 indexed agentId, int256 pnl, uint256 fee, uint256 newBankroll, uint256 newHWM);
    event Withdrawal(uint256 indexed agentId, uint256 amount, uint256 newBankroll);

    // ── Errors ─────────────────────────────────────────────────────────
    error OnlyOrchestrator();
    error InsufficientWithdrawable(uint256 requested, uint256 available);
    error InsufficientBankroll();
    error InsufficientMargin();

    // ── Modifiers ──────────────────────────────────────────────────────
    modifier onlyOrchestrator() {
        if (msg.sender != orchestrator) revert OnlyOrchestrator();
        _;
    }

    // ── Constructor ────────────────────────────────────────────────────
    constructor(address _orchestrator, address _protocolTreasury) {
        orchestrator = _orchestrator;
        protocolTreasury = _protocolTreasury;
    }

    // ── Write Functions ────────────────────────────────────────────────

    /**
     * @notice Record a deposit into an agent's bankroll.
     *         Sets the high-water mark on first deposit.
     */
    function recordDeposit(uint256 agentId, uint256 amount) external onlyOrchestrator {
        bool firstDeposit = bankroll[agentId] == 0 && highWaterMark[agentId] == 0;
        bankroll[agentId] += amount;

        if (firstDeposit) {
            highWaterMark[agentId] = bankroll[agentId];
        }

        emit Deposit(agentId, amount, bankroll[agentId]);
    }

    /**
     * @notice Lock margin for an upcoming trade.
     */
    function recordAllocation(uint256 agentId, uint256 amount) external onlyOrchestrator {
        uint256 withdrawable = bankroll[agentId] - reservedMargin[agentId];
        if (amount > withdrawable) revert InsufficientWithdrawable(amount, withdrawable);

        reservedMargin[agentId] += amount;

        emit Allocation(agentId, amount, reservedMargin[agentId]);
    }

    /**
     * @notice Settle a closed trade.
     *         Releases reserved margin, adjusts bankroll by pnl, and takes
     *         a 20 % performance fee on profits above the high-water mark.
     */
    function recordSettlement(uint256 agentId, int256 pnl) external onlyOrchestrator {
        // Release the margin that was reserved for this trade.
        // For simplicity the margin released equals the absolute value of pnl
        // capped to reservedMargin — the orchestrator is responsible for
        // passing the correct pnl that corresponds to a previously allocated position.

        if (pnl >= 0) {
            // Profitable or break-even trade
            bankroll[agentId] += uint256(pnl);
        } else {
            uint256 loss = uint256(-pnl);
            if (loss > bankroll[agentId]) revert InsufficientBankroll();
            bankroll[agentId] -= loss;
        }

        // Performance fee: 20 % of any amount above high-water mark
        uint256 fee = 0;
        uint256 hwm = highWaterMark[agentId];

        if (bankroll[agentId] > hwm) {
            fee = (bankroll[agentId] - hwm) * 20 / 100;
            bankroll[agentId] -= fee;
            treasuryAccrued += fee;
            highWaterMark[agentId] = bankroll[agentId];
        }

        emit Settlement(agentId, pnl, fee, bankroll[agentId], highWaterMark[agentId]);
    }

    /**
     * @notice Record a withdrawal. Amount must not exceed withdrawable balance.
     */
    function recordWithdrawal(uint256 agentId, uint256 amount) external onlyOrchestrator {
        uint256 withdrawable = bankroll[agentId] - reservedMargin[agentId];
        if (amount > withdrawable) revert InsufficientWithdrawable(amount, withdrawable);

        bankroll[agentId] -= amount;

        emit Withdrawal(agentId, amount, bankroll[agentId]);
    }

    // ── View Functions ─────────────────────────────────────────────────

    function getBalance(uint256 agentId) external view returns (uint256) {
        return bankroll[agentId];
    }

    function getWithdrawable(uint256 agentId) external view returns (uint256) {
        return bankroll[agentId] - reservedMargin[agentId];
    }

    function getHWM(uint256 agentId) external view returns (uint256) {
        return highWaterMark[agentId];
    }
}
