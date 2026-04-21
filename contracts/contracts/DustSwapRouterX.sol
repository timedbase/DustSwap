// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IPancakeRouter02.sol";
import "./interfaces/IPancakeV3SwapRouter.sol";

/**
 * @title DustSwapRouterX
 * @notice Batch swap dust tokens to a configurable ERC20 output token with an owner-updatable fee.
 *
 * This contract self-implements the Permit2 SignatureTransfer scheme (EIP-712 + unordered nonce bitmap),
 * meaning users only need to approve this contract once via the standard `approve()` call and can then
 * authorise individual transfers with off-chain signatures — no external Permit2 contract dependency.
 *
 * Token approval priority per swap instruction:
 *   1. Self-contained Permit2 signature  (permit2Sig.length > 0)
 *   2. EIP-2612 native permit            (permitDeadline != 0)
 *   3. Standard pre-existing allowance
 *
 * Routing:
 *   V2 — tokenIn → WBNB → outputToken  (swapExactTokensForTokensSupportingFeeOnTransferTokens)
 *   V3 — tokenIn → WBNB  (V3 exactInputSingle)
 *         WBNB  → outputToken  (V2 swapExactTokensForTokensSupportingFeeOnTransferTokens)
 */
contract DustSwapRouterX is Ownable, ReentrancyGuard {

    using ECDSA for bytes32;

    // ─── Immutables ───────────────────────────────────────────────────────────

    IPancakeRouter02 public immutable pancakeRouterV2;
    IPancakeV3SwapRouter public immutable pancakeRouterV3;
    address public immutable WBNB;

    // ─── Self-Contained Permit2 ───────────────────────────────────────────────
    // Implements the Uniswap Permit2 SignatureTransfer pattern internally.
    // Users approve this contract once; subsequent transfers are authorised by
    // off-chain EIP-712 signatures, eliminating per-token approve transactions.

    /// @notice EIP-712 domain separator for this contract's Permit2 scheme.
    bytes32 public immutable DOMAIN_SEPARATOR;

    bytes32 public constant TOKEN_PERMISSIONS_TYPEHASH =
        keccak256("TokenPermissions(address token,uint256 amount)");

    bytes32 public constant PERMIT_TRANSFER_TYPEHASH =
        keccak256(
            "PermitTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline)"
            "TokenPermissions(address token,uint256 amount)"
        );

    /// @notice Unordered nonce bitmap: nonceBitmap[owner][wordPos] → 256-bit word.
    /// @dev wordPos = nonce >> 8, bit index = nonce & 0xff. A set bit means the nonce is used.
    mapping(address => mapping(uint256 => uint256)) public nonceBitmap;

    // ─── Mutable State ────────────────────────────────────────────────────────

    /// @notice ERC20 token that users receive after a dust swap.
    address public outputToken;

    /// @notice Pending output token queued via proposeOutputToken (address(0) if none).
    address public pendingOutputToken;

    /// @notice Timestamp after which pendingOutputToken can be applied.
    uint256 public pendingOutputTokenActiveAt;

    /// @notice Minimum delay between proposing and applying an outputToken change.
    uint256 public constant OUTPUT_TOKEN_TIMELOCK = 48 hours;

    /// @notice Address that collects the service fee.
    address public feeRecipient;

    /// @notice Service fee in basis points (e.g. 2000 = 20%). Max 5000 (50%).
    uint256 public serviceFee;

    uint256 public constant MAX_FEE = 5000;
    uint256 public constant FEE_DENOMINATOR = 10000;

    // ─── Types ────────────────────────────────────────────────────────────────

    enum RouterVersion { V2, V3 }

    struct SwapInstruction {
        address token;
        uint256 amount;
        /// @dev Minimum outputToken to receive for this single swap (slippage guard).
        uint256 minAmountOut;
        RouterVersion version;
        /// @dev V3 pool fee tier: 100, 500, 2500, or 10000. Ignored for V2.
        uint24 v3Fee;
        // ── Self-contained Permit2 (optional, highest priority) ─────────────
        // Sign an EIP-712 PermitTransferFrom message off-chain. This contract
        // verifies the signature and consumes the nonce, then calls transferFrom.
        // Requires the user to have approved this contract via the standard approve().
        // Set permit2Sig to empty bytes to skip.
        uint256 permit2Nonce;
        uint256 permit2Deadline; // 0 = use the swap deadline
        bytes   permit2Sig;
        // ── EIP-2612 native permit (optional, used when permit2Sig is empty) ─
        // Set permitDeadline = 0 to skip and rely on a pre-existing allowance.
        uint256 permitDeadline;
        uint8   permitV;
        bytes32 permitR;
        bytes32 permitS;
    }

    // ─── Events ───────────────────────────────────────────────────────────────

    event BatchSwapCompleted(
        address indexed user,
        uint256 tokensSwapped,
        uint256 totalOutput,
        uint256 fee,
        uint256 userAmount,
        address indexed outputToken
    );

    event SingleSwapCompleted(
        address indexed user,
        address indexed token,
        uint256 amountIn,
        uint256 amountOut,
        RouterVersion version
    );

    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event OutputTokenProposed(address indexed newToken, uint256 activeAt);
    event OutputTokenProposalCancelled(address indexed cancelledToken);
    event OutputTokenUpdated(address indexed oldToken, address indexed newToken);
    event NonceInvalidation(address indexed owner, uint256 wordPos, uint256 mask);

    // ─── Errors ───────────────────────────────────────────────────────────────

    error InvalidRouter();
    error InvalidToken();
    error InvalidOutputToken();
    error InvalidFeeRecipient();
    error TransferFailed();
    error DeadlineExpired();
    error EmptySwapList();
    error FeeTooHigh();
    error InsufficientOutput();
    error TimelockActive(uint256 activeAt);
    error NoPendingOutputToken();
    error InvalidNonce();
    error InvalidSignature();

    // ─── Constructor ──────────────────────────────────────────────────────────

    /**
     * @param _pancakeRouterV2 PancakeSwap Router V2 address
     * @param _pancakeRouterV3 PancakeSwap Router V3 address
     * @param _outputToken     ERC20 token users receive (e.g. USDT). Must not be WBNB.
     * @param _feeRecipient    Address that collects the service fee
     * @param _initialFee      Initial fee in basis points (e.g. 2000 = 20%)
     */
    constructor(
        address _pancakeRouterV2,
        address _pancakeRouterV3,
        address _outputToken,
        address _feeRecipient,
        uint256 _initialFee
    ) Ownable(msg.sender) {
        if (_pancakeRouterV2 == address(0) || _pancakeRouterV3 == address(0)) revert InvalidRouter();
        if (_feeRecipient == address(0)) revert InvalidFeeRecipient();
        if (_initialFee > MAX_FEE) revert FeeTooHigh();

        pancakeRouterV2 = IPancakeRouter02(_pancakeRouterV2);
        pancakeRouterV3 = IPancakeV3SwapRouter(_pancakeRouterV3);
        WBNB = IPancakeRouter02(_pancakeRouterV2).WETH();

        if (_outputToken == address(0) || _outputToken == WBNB) revert InvalidOutputToken();

        outputToken = _outputToken;
        feeRecipient = _feeRecipient;
        serviceFee = _initialFee;

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)"),
                keccak256("DustSwapRouterX"),
                block.chainid,
                address(this)
            )
        );
    }

    // ─── Permit2 — Nonce Management ───────────────────────────────────────────

    /**
     * @notice Invalidate specific nonces so they can never be used in a Permit2 signature.
     * @dev    Callers can burn nonces they no longer wish to be valid.
     *         wordPos = nonce >> 8; mask = 1 << (nonce & 0xff).
     * @param wordPos  Word position in the bitmap.
     * @param mask     Bitmask of nonces to invalidate within that word.
     */
    function invalidateNonces(uint256 wordPos, uint256 mask) external {
        nonceBitmap[msg.sender][wordPos] |= mask;
        emit NonceInvalidation(msg.sender, wordPos, mask);
    }

    // ─── Owner Configuration ──────────────────────────────────────────────────

    /**
     * @notice Update the service fee.
     * @param _newFee New fee in basis points. Cannot exceed MAX_FEE (50%).
     */
    function setFee(uint256 _newFee) external onlyOwner {
        if (_newFee > MAX_FEE) revert FeeTooHigh();
        emit FeeUpdated(serviceFee, _newFee);
        serviceFee = _newFee;
    }

    /**
     * @notice Update the fee recipient.
     * @param _newRecipient New address to receive fees.
     */
    function setFeeRecipient(address _newRecipient) external onlyOwner {
        if (_newRecipient == address(0)) revert InvalidFeeRecipient();
        emit FeeRecipientUpdated(feeRecipient, _newRecipient);
        feeRecipient = _newRecipient;
    }

    /**
     * @notice Queue an outputToken change. Takes effect after OUTPUT_TOKEN_TIMELOCK (48 h).
     *         Emits OutputTokenProposed so users can see the change coming and act accordingly.
     * @param _newToken New output token address. Must not be zero or WBNB.
     */
    function proposeOutputToken(address _newToken) external onlyOwner {
        if (_newToken == address(0) || _newToken == WBNB) revert InvalidOutputToken();
        pendingOutputToken = _newToken;
        pendingOutputTokenActiveAt = block.timestamp + OUTPUT_TOKEN_TIMELOCK;
        emit OutputTokenProposed(_newToken, pendingOutputTokenActiveAt);
    }

    /**
     * @notice Apply a previously proposed outputToken change once the timelock has elapsed.
     */
    function applyOutputToken() external onlyOwner {
        if (pendingOutputToken == address(0)) revert NoPendingOutputToken();
        if (block.timestamp < pendingOutputTokenActiveAt) revert TimelockActive(pendingOutputTokenActiveAt);
        address old = outputToken;
        outputToken = pendingOutputToken;
        pendingOutputToken = address(0);
        pendingOutputTokenActiveAt = 0;
        emit OutputTokenUpdated(old, outputToken);
    }

    /**
     * @notice Cancel a pending outputToken proposal before it is applied.
     */
    function cancelOutputToken() external onlyOwner {
        if (pendingOutputToken == address(0)) revert NoPendingOutputToken();
        emit OutputTokenProposalCancelled(pendingOutputToken);
        pendingOutputToken = address(0);
        pendingOutputTokenActiveAt = 0;
    }

    // ─── Main Swap ────────────────────────────────────────────────────────────

    /**
     * @notice Batch swap multiple dust tokens into `outputToken`.
     *
     * Per-swap failures are silently skipped and the token is returned to the
     * caller — consistent with DustSwapRouterV2V3 behaviour.
     *
     * @param instructions  Array of swap instructions.
     * @param deadline      Unix timestamp; reverts if exceeded.
     * @return userAmount   Amount of outputToken sent to the caller after fee deduction.
     */
    function batchSwapToToken(
        SwapInstruction[] calldata instructions,
        uint256 deadline
    ) external nonReentrant returns (uint256 userAmount) {
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (instructions.length == 0) revert EmptySwapList();

        address _outputToken = outputToken; // cache SLOAD
        uint256 initialBalance = IERC20(_outputToken).balanceOf(address(this));
        uint256 tokensSwapped;

        for (uint256 i = 0; i < instructions.length; i++) {
            SwapInstruction calldata inst = instructions[i];

            if (inst.token == address(0) || inst.token == WBNB || inst.token == _outputToken) {
                revert InvalidToken();
            }
            if (inst.amount == 0) continue;

            // Delegate transfer + swap to helper to keep this frame's stack shallow.
            if (_executeSwap(inst, _outputToken, deadline) > 0) tokensSwapped++;
        }

        uint256 totalOutput = IERC20(_outputToken).balanceOf(address(this)) - initialBalance;
        if (totalOutput == 0) revert InsufficientOutput();

        uint256 fee = (totalOutput * serviceFee) / FEE_DENOMINATOR;
        userAmount = totalOutput - fee;

        if (fee > 0) {
            if (!IERC20(_outputToken).transfer(feeRecipient, fee)) revert TransferFailed();
        }
        if (!IERC20(_outputToken).transfer(msg.sender, userAmount)) revert TransferFailed();

        emit BatchSwapCompleted(msg.sender, tokensSwapped, totalOutput, fee, userAmount, _outputToken);
    }

    // ─── Internal Swap Helpers ────────────────────────────────────────────────

    /**
     * @dev Pull tokens from the caller, measure actual received, route to V2 or V3,
     *      emit SingleSwapCompleted, and return amountOut.
     *      Extracted to keep batchSwapToToken's stack frame shallow.
     */
    function _executeSwap(
        SwapInstruction calldata inst,
        address _outputToken,
        uint256 deadline
    ) internal returns (uint256 amountOut) {
        IERC20 token = IERC20(inst.token);
        uint256 balBefore = token.balanceOf(address(this));

        if (inst.permit2Sig.length > 0) {
            // ── Priority 1: Self-contained Permit2 ─────────────────────────
            // Verify EIP-712 signature and consume the nonce, then transferFrom.
            uint256 p2Deadline = inst.permit2Deadline != 0 ? inst.permit2Deadline : deadline;
            _verifyAndConsumePermit(inst.token, inst.amount, inst.permit2Nonce, p2Deadline, msg.sender, inst.permit2Sig);
            if (!token.transferFrom(msg.sender, address(this), inst.amount)) revert TransferFailed();
        } else {
            // ── Priority 2: EIP-2612 native permit ──────────────────────────
            // Silently ignored if the token doesn't support it; falls through to transferFrom.
            if (inst.permitDeadline != 0) {
                try IERC20Permit(inst.token).permit(
                    msg.sender, address(this), inst.amount,
                    inst.permitDeadline, inst.permitV, inst.permitR, inst.permitS
                ) {} catch {}
            }
            // ── Priority 3: standard pre-approved allowance ─────────────────
            if (!token.transferFrom(msg.sender, address(this), inst.amount)) revert TransferFailed();
        }

        uint256 actualAmount = token.balanceOf(address(this)) - balBefore;

        if (inst.version == RouterVersion.V2) {
            amountOut = _swapV2ToOutputToken(token, actualAmount, inst.minAmountOut, _outputToken, deadline);
        } else {
            amountOut = _swapV3ToOutputToken(token, actualAmount, inst.v3Fee, inst.minAmountOut, _outputToken, deadline);
        }

        if (amountOut > 0) {
            emit SingleSwapCompleted(msg.sender, inst.token, actualAmount, amountOut, inst.version);
        }
    }

    /**
     * @dev Verify a Permit2 EIP-712 signature and consume the nonce.
     *      Reverts with InvalidNonce if the nonce is already used.
     *      Reverts with InvalidSignature if the signature does not match.
     */
    function _verifyAndConsumePermit(
        address token,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        address owner,
        bytes calldata sig
    ) internal {
        if (block.timestamp > deadline) revert DeadlineExpired();
        _useUnorderedNonce(owner, nonce);

        bytes32 tokenPermissionsHash = keccak256(abi.encode(TOKEN_PERMISSIONS_TYPEHASH, token, amount));
        bytes32 structHash = keccak256(abi.encode(
            PERMIT_TRANSFER_TYPEHASH,
            tokenPermissionsHash,
            address(this),
            nonce,
            deadline
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        address recovered = digest.recover(sig);
        if (recovered != owner) revert InvalidSignature();
    }

    /**
     * @dev Mark a nonce as used. Reverts with InvalidNonce if already consumed.
     */
    function _useUnorderedNonce(address owner, uint256 nonce) internal {
        uint256 wordPos = nonce >> 8;
        uint256 bitPos  = nonce & 0xff;
        uint256 bit     = 1 << bitPos;
        uint256 flipped = nonceBitmap[owner][wordPos] ^= bit;
        // After XOR the bit must be SET (1), meaning it was 0 before.
        if (flipped & bit == 0) revert InvalidNonce();
    }

    /**
     * @dev V2 path: tokenIn → WBNB → outputToken.
     *      Uses SupportingFeeOnTransferTokens variant to handle tax tokens correctly.
     *      On failure: returns tokenIn to the caller, received = 0.
     */
    function _swapV2ToOutputToken(
        IERC20 token,
        uint256 amount,
        uint256 minAmountOut,
        address _outputToken,
        uint256 deadline
    ) internal returns (uint256 received) {
        token.approve(address(pancakeRouterV2), amount);

        address[] memory path = new address[](3);
        path[0] = address(token);
        path[1] = WBNB;
        path[2] = _outputToken;

        uint256 before = IERC20(_outputToken).balanceOf(address(this));

        try pancakeRouterV2.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            amount, minAmountOut, path, address(this), deadline
        ) {
            received = IERC20(_outputToken).balanceOf(address(this)) - before;
        } catch {
            // Swap failed — return dust tokens to the user.
            token.transfer(msg.sender, amount);
            received = 0;
        }
    }

    /**
     * @dev V3 path: tokenIn → WBNB (V3 exactInputSingle) → outputToken (V2).
     *      Step 1 failure: returns tokenIn to the caller.
     *      Step 2 failure: WBNB remains in the contract; recoverable via emergencyWithdraw.
     */
    function _swapV3ToOutputToken(
        IERC20 token,
        uint256 amount,
        uint24 v3Fee,
        uint256 minAmountOut,
        address _outputToken,
        uint256 deadline
    ) internal returns (uint256 received) {
        token.approve(address(pancakeRouterV3), amount);

        // Step 1: tokenIn → WBNB via V3
        try pancakeRouterV3.exactInputSingle(
            IPancakeV3SwapRouter.ExactInputSingleParams({
                tokenIn:           address(token),
                tokenOut:          WBNB,
                fee:               v3Fee,
                recipient:         address(this),
                amountIn:          amount,
                amountOutMinimum:  0,   // floor applied at final outputToken step
                sqrtPriceLimitX96: 0
            })
        ) returns (uint256 wbnbAmount) {
            if (wbnbAmount == 0) return 0;

            // Step 2: WBNB → outputToken via V2 (typically deeper liquidity)
            IERC20(WBNB).approve(address(pancakeRouterV2), wbnbAmount);

            address[] memory path = new address[](2);
            path[0] = WBNB;
            path[1] = _outputToken;

            uint256 before = IERC20(_outputToken).balanceOf(address(this));

            try pancakeRouterV2.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                wbnbAmount, minAmountOut, path, address(this), deadline
            ) {
                received = IERC20(_outputToken).balanceOf(address(this)) - before;
            } catch {
                // WBNB is now held by this contract; owner can recover via emergencyWithdraw.
                received = 0;
            }
        } catch {
            // V3 step failed before any state change — safely return tokens.
            token.transfer(msg.sender, amount);
            received = 0;
        }
    }

    // ─── View Helpers ─────────────────────────────────────────────────────────

    /**
     * @notice Estimate outputToken received for a list of tokens/amounts via V2.
     * @dev Uses V2 getAmountsOut with path [token, WBNB, outputToken].
     *      Returns 0 for tokens with no V2 liquidity — use as off-chain hint only.
     */
    function getEstimatedOutputs(
        address[] calldata tokens,
        uint256[] calldata amounts
    ) external view returns (uint256[] memory estimates) {
        require(tokens.length == amounts.length, "Length mismatch");
        estimates = new uint256[](tokens.length);
        address _out = outputToken;

        for (uint256 i = 0; i < tokens.length; i++) {
            address[] memory path = new address[](3);
            path[0] = tokens[i];
            path[1] = WBNB;
            path[2] = _out;

            try pancakeRouterV2.getAmountsOut(amounts[i], path) returns (uint256[] memory out) {
                estimates[i] = out[2];
            } catch {
                estimates[i] = 0;
            }
        }
    }

    // ─── Emergency ────────────────────────────────────────────────────────────

    /**
     * @notice Recover any token or BNB stuck in the contract.
     * @param token  Token address, or address(0) for native BNB.
     * @param amount Amount to withdraw.
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (amount == 0) return;
        if (token == address(0)) {
            (bool ok, ) = payable(owner()).call{value: amount}("");
            if (!ok) revert TransferFailed();
        } else {
            IERC20(token).transfer(owner(), amount);
        }
    }

    receive() external payable {}
}
