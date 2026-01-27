// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IERC20.sol";
import "./interfaces/IPancakeRouter02.sol";

/**
 * @title DustSwapRouter
 * @notice Batch swap multiple dust tokens to BNB or other tokens through PancakeSwap
 * @dev Integrates with PancakeSwap Router V2 for optimal routing
 */
contract DustSwapRouter is Ownable, ReentrancyGuard {
    IPancakeRouter02 public immutable pancakeRouter;
    address public immutable WBNB;

    event BatchSwapCompleted(
        address indexed user,
        uint256 tokensSwapped,
        uint256 totalBNBReceived
    );

    event SingleSwapCompleted(
        address indexed user,
        address indexed tokenIn,
        uint256 amountIn,
        uint256 amountOut
    );

    event EmergencyWithdraw(
        address indexed user,
        address indexed token,
        uint256 amount
    );

    error InvalidRouter();
    error InvalidToken();
    error InsufficientOutput();
    error TransferFailed();
    error DeadlineExpired();
    error EmptySwapList();

    /**
     * @notice Constructor
     * @param _pancakeRouter Address of PancakeSwap Router V2
     */
    constructor(address _pancakeRouter) Ownable(msg.sender) {
        if (_pancakeRouter == address(0)) revert InvalidRouter();

        pancakeRouter = IPancakeRouter02(_pancakeRouter);
        WBNB = pancakeRouter.WETH();
    }

    /**
     * @notice Batch swap multiple tokens to BNB in a single transaction
     * @param tokens Array of token addresses to swap
     * @param amounts Array of token amounts to swap (must match tokens length)
     * @param minAmountsOut Array of minimum BNB amounts to receive per swap
     * @param deadline Timestamp deadline for the transaction
     */
    function batchSwapExactTokensForETH(
        address[] calldata tokens,
        uint256[] calldata amounts,
        uint256[] calldata minAmountsOut,
        uint256 deadline
    ) external nonReentrant returns (uint256 totalBNBReceived) {
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (tokens.length == 0) revert EmptySwapList();
        if (tokens.length != amounts.length || tokens.length != minAmountsOut.length) {
            revert("Array lengths mismatch");
        }

        uint256 initialBalance = address(this).balance;

        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == address(0) || tokens[i] == WBNB) revert InvalidToken();
            if (amounts[i] == 0) continue;

            // Transfer tokens from user to this contract
            IERC20 token = IERC20(tokens[i]);
            uint256 balanceBefore = token.balanceOf(address(this));

            bool transferSuccess = token.transferFrom(msg.sender, address(this), amounts[i]);
            if (!transferSuccess) revert TransferFailed();

            uint256 balanceAfter = token.balanceOf(address(this));
            uint256 actualAmount = balanceAfter - balanceBefore;

            // Approve PancakeSwap router
            token.approve(address(pancakeRouter), actualAmount);

            // Create swap path: Token -> WBNB
            address[] memory path = new address[](2);
            path[0] = tokens[i];
            path[1] = WBNB;

            // Execute swap
            try pancakeRouter.swapExactTokensForETH(
                actualAmount,
                minAmountsOut[i],
                path,
                address(this),
                deadline
            ) returns (uint[] memory amounts_) {
                emit SingleSwapCompleted(
                    msg.sender,
                    tokens[i],
                    actualAmount,
                    amounts_[amounts_.length - 1]
                );
            } catch {
                // If swap fails, return tokens to user
                token.transfer(msg.sender, actualAmount);
            }
        }

        // Calculate total BNB received
        totalBNBReceived = address(this).balance - initialBalance;

        // Transfer all BNB to user
        if (totalBNBReceived > 0) {
            (bool success, ) = payable(msg.sender).call{value: totalBNBReceived}("");
            if (!success) revert TransferFailed();
        }

        emit BatchSwapCompleted(msg.sender, tokens.length, totalBNBReceived);
    }

    /**
     * @notice Batch swap multiple tokens to a target token
     * @param tokensIn Array of input token addresses
     * @param amountsIn Array of input amounts
     * @param tokenOut Target output token address
     * @param minAmountsOut Array of minimum output amounts per swap
     * @param deadline Timestamp deadline
     */
    function batchSwapExactTokensForTokens(
        address[] calldata tokensIn,
        uint256[] calldata amountsIn,
        address tokenOut,
        uint256[] calldata minAmountsOut,
        uint256 deadline
    ) external nonReentrant returns (uint256 totalTokensReceived) {
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (tokensIn.length == 0) revert EmptySwapList();
        if (tokenOut == address(0)) revert InvalidToken();
        if (tokensIn.length != amountsIn.length || tokensIn.length != minAmountsOut.length) {
            revert("Array lengths mismatch");
        }

        IERC20 outputToken = IERC20(tokenOut);
        uint256 initialBalance = outputToken.balanceOf(address(this));

        for (uint256 i = 0; i < tokensIn.length; i++) {
            if (tokensIn[i] == address(0) || tokensIn[i] == tokenOut) continue;
            if (amountsIn[i] == 0) continue;

            // Transfer tokens from user
            IERC20 tokenIn = IERC20(tokensIn[i]);
            uint256 balanceBefore = tokenIn.balanceOf(address(this));

            bool transferSuccess = tokenIn.transferFrom(msg.sender, address(this), amountsIn[i]);
            if (!transferSuccess) revert TransferFailed();

            uint256 balanceAfter = tokenIn.balanceOf(address(this));
            uint256 actualAmount = balanceAfter - balanceBefore;

            // Approve router
            tokenIn.approve(address(pancakeRouter), actualAmount);

            // Create swap path: TokenIn -> WBNB -> TokenOut
            address[] memory path = new address[](3);
            path[0] = tokensIn[i];
            path[1] = WBNB;
            path[2] = tokenOut;

            // Execute swap
            try pancakeRouter.swapExactTokensForTokens(
                actualAmount,
                minAmountsOut[i],
                path,
                address(this),
                deadline
            ) returns (uint[] memory amounts_) {
                emit SingleSwapCompleted(
                    msg.sender,
                    tokensIn[i],
                    actualAmount,
                    amounts_[amounts_.length - 1]
                );
            } catch {
                // If swap fails, return tokens to user
                tokenIn.transfer(msg.sender, actualAmount);
            }
        }

        // Calculate total output tokens received
        totalTokensReceived = outputToken.balanceOf(address(this)) - initialBalance;

        // Transfer output tokens to user
        if (totalTokensReceived > 0) {
            bool success = outputToken.transfer(msg.sender, totalTokensReceived);
            if (!success) revert TransferFailed();
        }

        emit BatchSwapCompleted(msg.sender, tokensIn.length, totalTokensReceived);
    }

    /**
     * @notice Get estimated output amounts for a batch swap to BNB
     * @param tokens Array of input token addresses
     * @param amounts Array of input amounts
     * @return estimatedOutputs Array of estimated BNB outputs
     */
    function getEstimatedBNBOutputs(
        address[] calldata tokens,
        uint256[] calldata amounts
    ) external view returns (uint256[] memory estimatedOutputs) {
        estimatedOutputs = new uint256[](tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == address(0) || amounts[i] == 0) {
                estimatedOutputs[i] = 0;
                continue;
            }

            address[] memory path = new address[](2);
            path[0] = tokens[i];
            path[1] = WBNB;

            try pancakeRouter.getAmountsOut(amounts[i], path) returns (uint[] memory amountsOut) {
                estimatedOutputs[i] = amountsOut[1];
            } catch {
                estimatedOutputs[i] = 0;
            }
        }
    }

    /**
     * @notice Emergency withdraw stuck tokens
     * @param token Token address to withdraw (address(0) for BNB)
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) external {
        if (amount == 0) return;

        if (token == address(0)) {
            // Withdraw BNB
            (bool success, ) = payable(msg.sender).call{value: amount}("");
            if (!success) revert TransferFailed();
        } else {
            // Withdraw ERC20
            IERC20(token).transfer(msg.sender, amount);
        }

        emit EmergencyWithdraw(msg.sender, token, amount);
    }

    /**
     * @notice Required to receive BNB from PancakeSwap
     */
    receive() external payable {}
}
