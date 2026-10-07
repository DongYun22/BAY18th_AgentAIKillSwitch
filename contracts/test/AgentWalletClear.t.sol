// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PermissionToken} from "../src/PermissionToken.sol";
import {AgentWallet} from "../src/AgentWallet.sol";

contract MockErc20 {
    mapping(address => mapping(address => uint256)) public allowance;

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
}

contract AgentWalletClearTest is Test {
    PermissionToken internal permissionToken;
    AgentWallet internal agentWallet;
    MockErc20 internal token;

    address internal cold = makeAddr("cold");
    address internal hotAgent = makeAddr("hotAgent");
    address internal spender = makeAddr("spender");

    uint256 internal childId;

    function setUp() public {
        permissionToken = new PermissionToken();
        agentWallet = new AgentWallet(address(permissionToken));
        token = new MockErc20();

        address[] memory allowlist = new address[](0);
        vm.prank(cold);
        uint256 rootId = permissionToken.mintRoot(
            PermissionToken.Policy({spendingLimit: 1 ether, allowlist: allowlist, expiry: uint64(block.timestamp + 7 days)})
        );
        vm.prank(cold);
        childId = permissionToken.mintChild(
            hotAgent,
            rootId,
            PermissionToken.Policy({spendingLimit: 1 ether, allowlist: allowlist, expiry: uint64(block.timestamp + 1 days)})
        );

        vm.prank(address(agentWallet));
        token.approve(spender, 100);
    }

    function test_ManagerClearsAllowance() public {
        vm.prank(cold);
        agentWallet.clearErc20Allowance(childId, address(token), spender);
        assertEq(token.allowance(address(agentWallet), spender), 0);
    }

    function test_HotAgentCannotClear() public {
        vm.prank(hotAgent);
        vm.expectRevert(AgentWallet.NotManager.selector);
        agentWallet.clearErc20Allowance(childId, address(token), spender);
    }
}
