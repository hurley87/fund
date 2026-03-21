// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "openzeppelin-contracts/access/Ownable.sol";

/**
 * @title MutantAccounting
 * @notice Public onchain accounting ledger for the Mutant Fund.
 *         This contract records state changes for transparency only —
 *         USDC lives in the Bankr operational wallet, not here.
 */
contract MutantAccounting is Ownable {
    // ── State ──────────────────────────────────────────────────────────
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
    error InsufficientWithdrawable(uint256 requested, uint256 available);
    error InsufficientBankroll();

    // ── Constructor ────────────────────────────────────────────────────
    constructor(address _protocolTreasury) {
        protocolTreasury = _protocolTreasury;
    }

    // ── Write Functions ────────────────────────────────────────────────

    /**
     * @notice Record a deposit into an agent's bankroll.
     *         Sets the high-water mark on first deposit.
     */
    function recordDeposit(uint256 agentId, uint256 amount) external onlyOwner {
        uint256 bal = bankroll[agentId];
        bool firstDeposit = bal == 0 && highWaterMark[agentId] == 0;
        bal += amount;
        bankroll[agentId] = bal;

        if (firstDeposit) {
            highWaterMark[agentId] = bal;
        }

        emit Deposit(agentId, amount, bal);
    }

    /**
     * @notice Lock margin for an upcoming trade.
     */
    function recordAllocation(uint256 agentId, uint256 amount) external onlyOwner {
        uint256 bal = bankroll[agentId];
        uint256 margin = reservedMargin[agentId];
        uint256 withdrawable = bal - margin;
        if (amount > withdrawable) revert InsufficientWithdrawable(amount, withdrawable);

        margin += amount;
        reservedMargin[agentId] = margin;

        emit Allocation(agentId, amount, margin);
    }

    /**
     * @notice Settle a closed trade.
     *         Releases reserved margin, adjusts bankroll by pnl, and takes
     *         a 20 % performance fee on profits above the high-water mark.
     */
    function recordSettlement(uint256 agentId, uint256 marginToRelease, int256 pnl) external onlyOwner {
        // Release the margin that was reserved for this trade
        uint256 margin = reservedMargin[agentId];
        if (marginToRelease > margin) marginToRelease = margin;
        reservedMargin[agentId] = margin - marginToRelease;

        uint256 bal = bankroll[agentId];
        if (pnl >= 0) {
            bal += uint256(pnl);
        } else {
            uint256 loss = uint256(-pnl);
            if (loss > bal) revert InsufficientBankroll();
            bal -= loss;
        }

        // Performance fee: 20 % of any amount above high-water mark
        uint256 fee = 0;
        uint256 hwm = highWaterMark[agentId];

        if (bal > hwm) {
            fee = (bal - hwm) * 20 / 100;
            bal -= fee;
            treasuryAccrued += fee;
            highWaterMark[agentId] = bal;
        }

        bankroll[agentId] = bal;
        emit Settlement(agentId, pnl, fee, bal, highWaterMark[agentId]);
    }

    /**
     * @notice Record a withdrawal. Amount must not exceed withdrawable balance.
     */
    function recordWithdrawal(uint256 agentId, uint256 amount) external onlyOwner {
        uint256 bal = bankroll[agentId];
        uint256 withdrawable = bal - reservedMargin[agentId];
        if (amount > withdrawable) revert InsufficientWithdrawable(amount, withdrawable);

        bal -= amount;
        bankroll[agentId] = bal;

        emit Withdrawal(agentId, amount, bal);
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
