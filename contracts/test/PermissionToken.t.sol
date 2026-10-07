// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PermissionToken} from "../src/PermissionToken.sol";
import {AgentWallet} from "../src/AgentWallet.sol";

/// @dev A trivial target contract the AgentWallet is allowed to call, so tests exercise a real
///      external call rather than sending bare ETH to an EOA.
contract MockService {
    uint256 public totalReceived;
    event Paid(address from, uint256 amount);

    function pay() external payable {
        totalReceived += msg.value;
        emit Paid(msg.sender, msg.value);
    }
}

contract PermissionTokenTest is Test {
    PermissionToken internal permissionToken;
    AgentWallet internal agentWallet;
    MockService internal allowedService;
    MockService internal disallowedService;

    address internal cold = makeAddr("cold");       // human owner
    address internal hotAgent = makeAddr("hotAgent"); // AI agent execution address
    address internal subAgent = makeAddr("subAgent"); // second-level delegated agent
    address internal attacker = makeAddr("attacker");

    uint256 internal rootId;
    uint256 internal childId;

    function setUp() public {
        permissionToken = new PermissionToken();
        agentWallet = new AgentWallet(address(permissionToken));
        allowedService = new MockService();
        disallowedService = new MockService();

        vm.deal(address(agentWallet), 100 ether);

        address[] memory rootAllowlist = new address[](1);
        rootAllowlist[0] = address(allowedService);

        vm.prank(cold);
        rootId = permissionToken.mintRoot(
            PermissionToken.Policy({spendingLimit: 10 ether, allowlist: rootAllowlist, expiry: uint64(block.timestamp + 7 days)})
        );

        address[] memory childAllowlist = new address[](1);
        childAllowlist[0] = address(allowedService);

        vm.prank(cold);
        childId = permissionToken.mintChild(
            hotAgent,
            rootId,
            PermissionToken.Policy({spendingLimit: 1 ether, allowlist: childAllowlist, expiry: uint64(block.timestamp + 1 days)})
        );
    }

    // ---------------------------------------------------------------------
    // Soulbound behavior
    // ---------------------------------------------------------------------

    function test_TokenIsNonTransferable() public {
        vm.prank(hotAgent);
        vm.expectRevert(PermissionToken.NotTransferable.selector);
        permissionToken.transferFrom(hotAgent, attacker, childId);
    }

    // ---------------------------------------------------------------------
    // Attenuation
    // ---------------------------------------------------------------------

    function test_MintChild_RevertsWhenSpendingLimitExceedsParent() public {
        address[] memory allowlist = new address[](1);
        allowlist[0] = address(allowedService);

        vm.prank(cold);
        vm.expectRevert(PermissionToken.PolicyExceedsParent.selector);
        permissionToken.mintChild(
            hotAgent, rootId, PermissionToken.Policy({spendingLimit: 20 ether, allowlist: allowlist, expiry: uint64(block.timestamp + 1 days)})
        );
    }

    function test_MintChild_RevertsWhenAllowlistNotSubsetOfParent() public {
        address[] memory allowlist = new address[](1);
        allowlist[0] = address(disallowedService); // not in root's allowlist

        vm.prank(cold);
        vm.expectRevert(PermissionToken.PolicyExceedsParent.selector);
        permissionToken.mintChild(
            hotAgent, rootId, PermissionToken.Policy({spendingLimit: 1 ether, allowlist: allowlist, expiry: uint64(block.timestamp + 1 days)})
        );
    }

    function test_MintChild_RevertsWhenExpiryExceedsParent() public {
        address[] memory allowlist = new address[](1);
        allowlist[0] = address(allowedService);

        vm.prank(cold);
        vm.expectRevert(PermissionToken.PolicyExceedsParent.selector);
        permissionToken.mintChild(
            hotAgent, rootId, PermissionToken.Policy({spendingLimit: 1 ether, allowlist: allowlist, expiry: uint64(block.timestamp + 30 days)})
        );
    }

    function test_MintChild_RevertsWhenCallerDoesNotOwnParent() public {
        address[] memory allowlist = new address[](1);
        allowlist[0] = address(allowedService);

        vm.prank(attacker);
        vm.expectRevert(PermissionToken.NotAuthorized.selector);
        permissionToken.mintChild(
            hotAgent, rootId, PermissionToken.Policy({spendingLimit: 1 ether, allowlist: allowlist, expiry: uint64(block.timestamp + 1 days)})
        );
    }

    // ---------------------------------------------------------------------
    // AgentWallet execution: happy path + policy rejections
    // ---------------------------------------------------------------------

    function test_Execute_SucceedsWithinPolicy() public {
        vm.prank(hotAgent);
        agentWallet.execute(childId, address(allowedService), 0.5 ether, abi.encodeCall(MockService.pay, ()));
        assertEq(allowedService.totalReceived(), 0.5 ether);
    }

    function test_Execute_RevertsOverSpendingLimit() public {
        vm.prank(hotAgent);
        vm.expectRevert(AgentWallet.PolicyRejected.selector);
        agentWallet.execute(childId, address(allowedService), 2 ether, abi.encodeCall(MockService.pay, ()));
    }

    function test_Execute_RevertsForNonAllowlistedTarget() public {
        vm.prank(hotAgent);
        vm.expectRevert(AgentWallet.PolicyRejected.selector);
        agentWallet.execute(childId, address(disallowedService), 0.1 ether, abi.encodeCall(MockService.pay, ()));
    }

    function test_Execute_RevertsWhenCallerDoesNotOwnToken() public {
        vm.prank(attacker);
        vm.expectRevert(AgentWallet.NotTokenOwner.selector);
        agentWallet.execute(childId, address(allowedService), 0.1 ether, abi.encodeCall(MockService.pay, ()));
    }

    function test_Execute_RevertsAfterExpiry() public {
        vm.warp(block.timestamp + 2 days); // childId expires after 1 day
        vm.prank(hotAgent);
        vm.expectRevert(AgentWallet.PolicyRejected.selector);
        agentWallet.execute(childId, address(allowedService), 0.1 ether, abi.encodeCall(MockService.pay, ()));
    }

    // ---------------------------------------------------------------------
    // Freeze / unfreeze — reversible
    // ---------------------------------------------------------------------

    function test_Freeze_BlocksExecutionAndUnfreezeRestoresIt() public {
        vm.prank(cold);
        permissionToken.freeze(childId);
        assertFalse(permissionToken.isValid(childId));

        vm.prank(hotAgent);
        vm.expectRevert(AgentWallet.PolicyRejected.selector);
        agentWallet.execute(childId, address(allowedService), 0.1 ether, abi.encodeCall(MockService.pay, ()));

        vm.prank(cold);
        permissionToken.unfreeze(childId);
        assertTrue(permissionToken.isValid(childId));

        vm.prank(hotAgent);
        agentWallet.execute(childId, address(allowedService), 0.1 ether, abi.encodeCall(MockService.pay, ()));
    }

    function test_Freeze_RevertsWhenCallerIsNotIssuer() public {
        vm.prank(attacker);
        vm.expectRevert(PermissionToken.NotAuthorized.selector);
        permissionToken.freeze(childId);
    }

    function test_Freeze_OfAncestorInvalidatesDescendant() public {
        // freezing the root (which only the root's own owner, `cold`, can do) must also
        // invalidate the child, since the child's authority derives from the root.
        vm.prank(cold);
        permissionToken.freeze(rootId);
        assertFalse(permissionToken.isValid(childId));
    }

    // ---------------------------------------------------------------------
    // Revoke — irreversible, cascades (the actual kill switch)
    // ---------------------------------------------------------------------

    function test_Revoke_BurnsTokenAndBlocksExecution() public {
        vm.prank(cold);
        permissionToken.revoke(childId);

        assertFalse(permissionToken.isValid(childId));
        vm.expectRevert(); // ownerOf on a burned token reverts
        permissionToken.ownerOf(childId);

        // ownerOf() on a burned token reverts with ERC721NonexistentToken before our own
        // NotTokenOwner check is even reached — either way, execution is blocked.
        vm.prank(hotAgent);
        vm.expectRevert();
        agentWallet.execute(childId, address(allowedService), 0.1 ether, abi.encodeCall(MockService.pay, ()));
    }

    function test_Revoke_CascadesToGrandchildren() public {
        address[] memory subAllowlist = new address[](1);
        subAllowlist[0] = address(allowedService);

        vm.prank(hotAgent);
        uint256 subId = permissionToken.mintChild(
            subAgent, childId, PermissionToken.Policy({spendingLimit: 0.1 ether, allowlist: subAllowlist, expiry: uint64(block.timestamp + 1 hours)})
        );

        assertTrue(permissionToken.isValid(subId));

        // Cold revokes the middle-tier token (childId); this must cascade down to subId even
        // though Cold never directly interacted with subId.
        vm.prank(cold);
        permissionToken.revoke(childId);

        assertFalse(permissionToken.isValid(subId));
    }

    function test_Revoke_RevertsWhenCallerIsNotIssuer() public {
        vm.prank(attacker);
        vm.expectRevert(PermissionToken.NotAuthorized.selector);
        permissionToken.revoke(childId);
    }

    function test_Revoke_HotAgentCannotRevokeItsOwnToken() public {
        // The whole point of the kill switch: the Hot identity holding the token cannot protect
        // itself by revoking/hiding its own permission — only its issuer (Cold) can.
        vm.prank(hotAgent);
        vm.expectRevert(PermissionToken.NotAuthorized.selector);
        permissionToken.revoke(childId);
    }

    // ---------------------------------------------------------------------
    // V2 — guardian / on-chain circuit breaker
    // ---------------------------------------------------------------------

    function _enableGuardian() internal {
        vm.prank(cold);
        permissionToken.setGuardian(rootId, address(agentWallet));
    }

    function test_V2_SetGuardian_OnlyRootOwner() public {
        vm.prank(attacker);
        vm.expectRevert(PermissionToken.NotAuthorized.selector);
        permissionToken.setGuardian(rootId, attacker);

        // a child token is not a root, even for its own holder
        vm.prank(hotAgent);
        vm.expectRevert(PermissionToken.NotAuthorized.selector);
        permissionToken.setGuardian(childId, hotAgent);

        _enableGuardian();
        assertEq(permissionToken.guardianOf(rootId), address(agentWallet));
    }

    function test_V2_GuardianFreeze_OnlyRegisteredGuardian() public {
        vm.prank(attacker);
        vm.expectRevert(PermissionToken.NotAuthorized.selector);
        permissionToken.guardianFreeze(childId);

        // no guardian registered yet -> even the wallet cannot freeze
        vm.prank(address(agentWallet));
        vm.expectRevert(PermissionToken.NotAuthorized.selector);
        permissionToken.guardianFreeze(childId);
    }

    function test_V2_GuardianCannotUnfreezeOrRevoke() public {
        _enableGuardian();
        vm.prank(address(agentWallet));
        permissionToken.guardianFreeze(childId);

        vm.prank(address(agentWallet));
        vm.expectRevert(PermissionToken.NotAuthorized.selector);
        permissionToken.unfreeze(childId);

        vm.prank(address(agentWallet));
        vm.expectRevert(PermissionToken.NotAuthorized.selector);
        permissionToken.revoke(childId);
    }

    function test_V2_Violation_FreezesInSameTxWithoutMovingFunds() public {
        _enableGuardian();
        uint256 walletBefore = address(agentWallet).balance;

        vm.expectEmit(true, true, false, true, address(agentWallet));
        emit AgentWallet.PolicyViolation(childId, address(disallowedService), 0.1 ether);
        vm.prank(hotAgent);
        agentWallet.execute(childId, address(disallowedService), 0.1 ether, abi.encodeCall(MockService.pay, ()));

        assertTrue(permissionToken.frozen(childId));
        assertFalse(permissionToken.isValid(childId));
        assertEq(disallowedService.totalReceived(), 0);
        assertEq(address(agentWallet).balance, walletBefore);
    }

    function test_V2_OverLimitViolation_AlsoFreezes() public {
        _enableGuardian();
        vm.prank(hotAgent);
        agentWallet.execute(childId, address(allowedService), 2 ether, abi.encodeCall(MockService.pay, ()));
        assertTrue(permissionToken.frozen(childId));
        assertEq(allowedService.totalReceived(), 0);
    }

    function test_V2_RetryAfterViolation_IsRejectedEvenToAllowedTarget() public {
        // The exact pattern the live LLM showed on V1: blocked, then immediately retried an
        // allowlisted payment that went through before the off-chain watcher could revoke.
        _enableGuardian();
        vm.prank(hotAgent);
        agentWallet.execute(childId, address(disallowedService), 0.1 ether, abi.encodeCall(MockService.pay, ()));

        vm.prank(hotAgent);
        vm.expectRevert(AgentWallet.PolicyRejected.selector);
        agentWallet.execute(childId, address(allowedService), 0.1 ether, abi.encodeCall(MockService.pay, ()));
        assertEq(allowedService.totalReceived(), 0);
    }

    function test_V2_NonHolderCannotTriggerFreeze() public {
        // Otherwise anyone could freeze someone else's permission with a bad request.
        _enableGuardian();
        vm.prank(attacker);
        vm.expectRevert(AgentWallet.NotTokenOwner.selector);
        agentWallet.execute(childId, address(disallowedService), 0.1 ether, abi.encodeCall(MockService.pay, ()));
        assertFalse(permissionToken.frozen(childId));
    }

    function test_V2_IssuerCanUnfreezeAfterGuardianFreeze() public {
        _enableGuardian();
        vm.prank(hotAgent);
        agentWallet.execute(childId, address(disallowedService), 0.1 ether, abi.encodeCall(MockService.pay, ()));

        vm.prank(cold);
        permissionToken.unfreeze(childId);

        vm.prank(hotAgent);
        agentWallet.execute(childId, address(allowedService), 0.1 ether, abi.encodeCall(MockService.pay, ()));
        assertEq(allowedService.totalReceived(), 0.1 ether);
    }

    function test_V2_IssuerCanEscalateFreezeToRevoke() public {
        _enableGuardian();
        vm.prank(hotAgent);
        agentWallet.execute(childId, address(disallowedService), 0.1 ether, abi.encodeCall(MockService.pay, ()));

        vm.prank(cold);
        permissionToken.revoke(childId);
        vm.expectRevert(); // ERC721NonexistentToken
        permissionToken.ownerOf(childId);
    }

    function test_V2_GuardianOfOneTreeCannotFreezeAnother() public {
        _enableGuardian();
        address[] memory al = new address[](1);
        al[0] = address(allowedService);
        address otherOwner = makeAddr("otherOwner");
        vm.prank(otherOwner);
        uint256 otherRoot = permissionToken.mintRoot(
            PermissionToken.Policy({spendingLimit: 1 ether, allowlist: al, expiry: uint64(block.timestamp + 1 days)})
        );

        vm.prank(address(agentWallet));
        vm.expectRevert(PermissionToken.NotAuthorized.selector);
        permissionToken.guardianFreeze(otherRoot);
    }

    function test_V2_ViolationByGrandchild_FreezesOnlyThatBranch() public {
        _enableGuardian();
        address[] memory al = new address[](1);
        al[0] = address(allowedService);
        vm.prank(hotAgent);
        uint256 subId = permissionToken.mintChild(
            subAgent, childId, PermissionToken.Policy({spendingLimit: 0.5 ether, allowlist: al, expiry: uint64(block.timestamp + 1 hours)})
        );

        vm.prank(subAgent);
        agentWallet.execute(subId, address(disallowedService), 0.1 ether, abi.encodeCall(MockService.pay, ()));

        assertTrue(permissionToken.frozen(subId));
        assertFalse(permissionToken.frozen(childId));
        assertTrue(permissionToken.isValid(childId)); // parent agent keeps working
    }
}
