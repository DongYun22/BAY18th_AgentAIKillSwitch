// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PermissionToken} from "./PermissionToken.sol";

/// @title AgentWallet
/// @notice Minimal policy-enforcing execution gateway for AI Agents. The address holding a given
///         PermissionToken (the "Hot" execution identity) calls execute() to perform an on-chain
///         action; this contract checks the token's validity and policy with PermissionToken
///         before forwarding the call. Deliberately skips ERC-4337 (UserOperations, EntryPoint,
///         Paymasters) — the security property (require-gated execution) is the same either way,
///         and the full account-abstraction stack is unnecessary complexity for this prototype.
contract AgentWallet {
    PermissionToken public immutable permissionToken;

    event AgentTransactionExecuted(uint256 indexed tokenId, address indexed target, uint256 value, bytes data);

    error NotTokenOwner();
    error PolicyRejected();
    error ExecutionFailed();
    error NotManager();
    error ClearFailed();

    event Erc20AllowanceCleared(uint256 indexed tokenId, address indexed token, address indexed spender);

    constructor(address permissionTokenAddress) {
        permissionToken = PermissionToken(permissionTokenAddress);
    }

    /// @notice Attempt to execute an action on behalf of `tokenId`. Reverts unless the caller
    ///         owns the token and the token's policy (validity + spending limit + allowlist)
    ///         allows this exact (target, value) pair.
    function execute(uint256 tokenId, address target, uint256 value, bytes calldata data)
        external
        returns (bytes memory)
    {
        if (permissionToken.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (!permissionToken.checkPolicy(tokenId, target, value)) revert PolicyRejected();

        (bool ok, bytes memory result) = target.call{value: value}(data);
        if (!ok) revert ExecutionFailed();

        emit AgentTransactionExecuted(tokenId, target, value, data);
        return result;
    }

    /// @notice Parent owner clears an ERC-20 allowance this wallet granted. Not an execute, and not an allowlist check.
    function clearErc20Allowance(uint256 tokenId, address token, address spender) external {
        uint256 parent = permissionToken.parentTokenId(tokenId);
        address manager = parent == 0 ? permissionToken.ownerOf(tokenId) : permissionToken.ownerOf(parent);
        if (msg.sender != manager) revert NotManager();

        (bool ok, bytes memory data) = token.call(abi.encodeWithSignature("approve(address,uint256)", spender, 0));
        if (!ok || (data.length >= 32 && !abi.decode(data, (bool)))) revert ClearFailed();

        emit Erc20AllowanceCleared(tokenId, token, spender);
    }

    /// @dev Lets the wallet hold ETH so it can forward `value` in execute() calls.
    receive() external payable {}
}
