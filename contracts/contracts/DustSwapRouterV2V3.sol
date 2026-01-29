// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IPancakeRouter02.sol";
import "./interfaces/IPancakeV3SwapRouter.sol";

/**
 * @title DustSwapRouterV2V3
 * @notice Batch swap dust tokens to BNB with 10% service fee
 * @dev Supports both PancakeSwap V2 and V3 with client-side routing
 */
contract DustSwapRouterV2V3 is Ownable, ReentrancyGuard {
    IPancakeRouter02 public immutable pancakeRouterV2;
    IPancakeV3SwapRouter public immutable pancakeRouterV3;
    address public immutable WBNB;
    address public feeRecipient;

    uint256 public constant SERVICE_FEE_PERCENT = 10; // 10%
    uint256 public constant FEE_DENOMINATOR = 100;

    enum RouterVersion {
        V2,
        V3
    }

    struct SwapInstruction {
        address token;
        uint256 amount;
        uint256 minAmountOut;
        RouterVersion version;
        uint24 v3Fee; // Only used for V3 (100, 500, 2500, 10000)
    }

    event BatchSwapCompleted(
        address indexed user,
        uint256 tokensSwapped,
        uint256 totalBNBReceived,
        uint256 serviceFee,
        uint256 userAmount
    );

    event SingleSwapCompleted(
        address indexed user,
        address indexed token,
        uint256 amountIn,
        uint256 bnbOut,
        RouterVersion version
    );

    event FeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);

    error InvalidRouter();
    error InvalidToken();
    error InvalidFeeRecipient();
    error TransferFailed();
    error DeadlineExpired();
    error EmptySwapList();
    error InvalidFee();
    error InsufficientOutput();

    /**
     * @notice Constructor
     * @param _pancakeRouterV2 PancakeSwap Router V2 address
     * @param _pancakeRouterV3 PancakeSwap Router V3 address
     * @param _feeRecipient Address to receive service fees
     */
    constructor(
        address _pancakeRouterV2,
        address _pancakeRouterV3,
        address _feeRecipient
    ) Ownable(msg.sender) {
        if (_pancakeRouterV2 == address(0) || _pancakeRouterV3 == address(0)) {
            revert InvalidRouter();
        }
        if (_feeRecipient == address(0)) revert InvalidFeeRecipient();

        pancakeRouterV2 = IPancakeRouter02(_pancakeRouterV2);
        pancakeRouterV3 = IPancakeV3SwapRouter(_pancakeRouterV3);
        WBNB = pancakeRouterV2.WETH();
        feeRecipient = _feeRecipient;
    }

    /**
     * @notice Batch swap multiple tokens to BNB with service fee
     * @dev Client determines routing off-chain, contract executes swaps
     * @param instructions Array of swap instructions from client
     * @param deadline Transaction deadline
     * @return userAmount BNB amount sent to user after fee
     */
    function batchSwapToBNB(
        SwapInstruction[] calldata instructions,
        uint256 deadline
    ) external nonReentrant returns (uint256 userAmount) {
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (instructions.length == 0) revert EmptySwapList();

        uint256 initialBalance = address(this).balance;

        // Execute each swap
        for (uint256 i = 0; i < instructions.length; i++) {
            SwapInstruction memory instruction = instructions[i];

            if (instruction.token == address(0) || instruction.token == WBNB) {
                revert InvalidToken();
            }
            if (instruction.amount == 0) continue;

            // Transfer tokens from user to this contract
            IERC20 token = IERC20(instruction.token);
            uint256 balanceBefore = token.balanceOf(address(this));

            bool transferSuccess = token.transferFrom(
                msg.sender,
                address(this),
                instruction.amount
            );
            if (!transferSuccess) revert TransferFailed();

            uint256 actualAmount = token.balanceOf(address(this)) - balanceBefore;

            // Execute swap based on version
            uint256 bnbReceived;
            if (instruction.version == RouterVersion.V2) {
                bnbReceived = _swapV2ToBNB(
                    token,
                    actualAmount,
                    instruction.minAmountOut,
                    deadline
                );
            } else {
                bnbReceived = _swapV3ToBNB(
                    token,
                    actualAmount,
                    instruction.minAmountOut,
                    instruction.v3Fee
                );
            }

            if (bnbReceived > 0) {
                emit SingleSwapCompleted(
                    msg.sender,
                    instruction.token,
                    actualAmount,
                    bnbReceived,
                    instruction.version
                );
            }
        }

        // Calculate total BNB received
        uint256 totalBNBReceived = address(this).balance - initialBalance;

        if (totalBNBReceived == 0) revert InsufficientOutput();

        // Calculate 10% service fee
        uint256 serviceFee = (totalBNBReceived * SERVICE_FEE_PERCENT) / FEE_DENOMINATOR;
        userAmount = totalBNBReceived - serviceFee;

        // Send service fee to fee recipient
        if (serviceFee > 0) {
            (bool feeSuccess, ) = payable(feeRecipient).call{value: serviceFee}("");
            if (!feeSuccess) revert TransferFailed();
        }

        // Send remaining BNB to user
        if (userAmount > 0) {
            (bool userSuccess, ) = payable(msg.sender).call{value: userAmount}("");
            if (!userSuccess) revert TransferFailed();
        }

        emit BatchSwapCompleted(
            msg.sender,
            instructions.length,
            totalBNBReceived,
            serviceFee,
            userAmount
        );
    }

    /**
     * @notice Execute V2 swap to BNB
     * @dev Uses SupportingFeeOnTransferTokens to handle tax tokens correctly
     */
    function _swapV2ToBNB(
        IERC20 token,
        uint256 amount,
        uint256 minAmountOut,
        uint256 deadline
    ) internal returns (uint256 bnbReceived) {
        uint256 balanceBefore = address(this).balance;

        token.approve(address(pancakeRouterV2), amount);

        address[] memory path = new address[](2);
        path[0] = address(token);
        path[1] = WBNB;

        // Use SupportingFeeOnTransferTokens for tax tokens
        // This function measures actual received amounts instead of calculated
        try pancakeRouterV2.swapExactTokensForETHSupportingFeeOnTransferTokens(
            amount,
            minAmountOut,
            path,
            address(this),
            deadline
        ) {
            bnbReceived = address(this).balance - balanceBefore;
        } catch {
            // Return tokens to user if swap fails
            token.transfer(msg.sender, amount);
            bnbReceived = 0;
        }
    }

    /**
     * @notice Execute V3 swap to BNB
     * @dev Internal function, returns BNB received
     */
    function _swapV3ToBNB(
        IERC20 token,
        uint256 amount,
        uint256 minAmountOut,
        uint24 fee
    ) internal returns (uint256 bnbReceived) {
        // First swap token to WBNB on V3
        token.approve(address(pancakeRouterV3), amount);

        IPancakeV3SwapRouter.ExactInputSingleParams memory params =
            IPancakeV3SwapRouter.ExactInputSingleParams({
                tokenIn: address(token),
                tokenOut: WBNB,
                fee: fee,
                recipient: address(this),
                amountIn: amount,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: 0
            });

        try pancakeRouterV3.exactInputSingle(params) returns (uint256 wbnbAmount) {
            // Unwrap WBNB to BNB using V2 router
            IERC20(WBNB).approve(address(pancakeRouterV2), wbnbAmount);

            address[] memory path = new address[](1);
            path[0] = WBNB;

            uint256 balanceBefore = address(this).balance;

            pancakeRouterV2.swapExactTokensForETH(
                wbnbAmount,
                wbnbAmount, // Accept any amount since we already swapped
                path,
                address(this),
                block.timestamp + 300
            );

            bnbReceived = address(this).balance - balanceBefore;
        } catch {
            // Return tokens to user if swap fails
            token.transfer(msg.sender, amount);
            bnbReceived = 0;
        }
    }

    /**
     * @notice Update fee recipient address
     * @param _newFeeRecipient New fee recipient address
     */
    function setFeeRecipient(address _newFeeRecipient) external onlyOwner {
        if (_newFeeRecipient == address(0)) revert InvalidFeeRecipient();

        address oldRecipient = feeRecipient;
        feeRecipient = _newFeeRecipient;

        emit FeeRecipientUpdated(oldRecipient, _newFeeRecipient);
    }

    /**
     * @notice Emergency withdraw stuck tokens or BNB
     * @param token Token address (address(0) for BNB)
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (amount == 0) return;

        if (token == address(0)) {
            (bool success, ) = payable(owner()).call{value: amount}("");
            if (!success) revert TransferFailed();
        } else {
            IERC20(token).transfer(owner(), amount);
        }
    }

    /**
     * @notice Receive BNB from swaps
     */
    receive() external payable {}
}
