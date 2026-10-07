// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title PermissionToken
/// @notice Soulbound (non-transferable) ERC-721 representing a delegated AI Agent wallet permission.
/// @dev Each token encodes a Policy (spending limit, contract allowlist, expiry) and sits in a
///      parent-child delegation tree. A token's issuer (the owner of its parent token) can freeze it
///      (reversible) or revoke it (permanent, cascades to every descendant). Revoking or freezing a
///      token is authorized by ownership of its *parent* token — you can only recall what you
///      yourself delegated. A root token (no parent) can only be managed by its own owner.
///
///      Scope notes (intentional simplifications for a 60-hour prototype):
///      - No cumulative spend tracking across sibling tokens; `spendingLimit` is evaluated
///        independently per token, not deducted from a shared parent budget.
///      - No ERC-4337 / UserOperation integration; validation happens in a plain `execute()`
///        call (see AgentWallet.sol), not inside account-abstraction validation.
///      - `allowlist` uses deny-by-default semantics: an empty allowlist permits no target.
///        Attenuation requires a child's allowlist to be a subset of its parent's allowlist.
///
///      V2 — on-chain circuit breaker: a root owner may register a *guardian* contract for its
///      delegation tree (typically the AgentWallet). The guardian can only `guardianFreeze` tokens
///      in that tree — never unfreeze or revoke them. This lets the wallet freeze a token inside the
///      very transaction in which the token's holder attempts a policy violation, instead of
///      waiting for an off-chain watcher to notice and react blocks later. Unfreezing or revoking
///      stays with the human issuer (or a watcher acting with the issuer's key).
contract PermissionToken is ERC721 {
    struct Policy {
        uint256 spendingLimit; // max value (wei or token units) a single execute() call may move
        address[] allowlist;   // contract addresses this token may call; empty = nothing allowed
        uint64 expiry;         // unix timestamp after which the token is no longer valid
    }

    uint256 private _nextTokenId = 1;

    mapping(uint256 => Policy) private _policies;
    mapping(uint256 => uint256) public parentTokenId;  // 0 = root (no parent)
    mapping(uint256 => uint256[]) public childTokenIds;
    mapping(uint256 => bool) public frozen;            // reversible pause; checked up the ancestor chain
    mapping(uint256 => address) public guardianOf;     // V2: rootId => contract allowed to freeze in that tree

    event PermissionMinted(
        uint256 indexed tokenId,
        address indexed to,
        uint256 indexed parentId,
        uint256 spendingLimit,
        uint64 expiry
    );
    event PermissionFrozen(uint256 indexed tokenId, address indexed by);
    event PermissionUnfrozen(uint256 indexed tokenId, address indexed by);
    event PermissionRevoked(uint256 indexed tokenId, address indexed by);
    event GuardianSet(uint256 indexed rootId, address indexed guardian);

    error NotTransferable();
    error NotAuthorized();
    error TokenNotValid();
    error PolicyExceedsParent();

    constructor() ERC721("AgentPermissionToken", "AGENTPERM") {}

    // ---------------------------------------------------------------------
    // Soulbound enforcement: allow mint (from == 0) and burn (to == 0),
    // block every wallet-to-wallet transfer.
    // ---------------------------------------------------------------------

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert NotTransferable();
        return super._update(to, tokenId, auth);
    }

    // ---------------------------------------------------------------------
    // Minting / delegation
    // ---------------------------------------------------------------------

    /// @notice Mint a root permission token to yourself — the entry point for a human owner
    ///         ("Cold" identity) establishing the top of a delegation tree.
    function mintRoot(Policy calldata policy) external returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _policies[tokenId] = policy;
        parentTokenId[tokenId] = 0;
        _safeMint(msg.sender, tokenId);
        emit PermissionMinted(tokenId, msg.sender, 0, policy.spendingLimit, policy.expiry);
    }

    /// @notice Delegate a narrower permission to `to` (e.g. an AI Agent's execution address) as a
    ///         child of `parentId`. Caller must own `parentId`, and the child policy must not
    ///         exceed the parent's policy (attenuation: spendingLimit, expiry, allowlist ⊆ parent's).
    function mintChild(address to, uint256 parentId, Policy calldata policy) external returns (uint256 tokenId) {
        if (ownerOf(parentId) != msg.sender) revert NotAuthorized();
        if (!isValid(parentId)) revert TokenNotValid();

        Policy memory parentPolicy = _policies[parentId];
        if (policy.spendingLimit > parentPolicy.spendingLimit) revert PolicyExceedsParent();
        if (policy.expiry > parentPolicy.expiry) revert PolicyExceedsParent();
        if (!_isSubset(policy.allowlist, parentPolicy.allowlist)) revert PolicyExceedsParent();

        tokenId = _nextTokenId++;
        _policies[tokenId] = policy;
        parentTokenId[tokenId] = parentId;
        childTokenIds[parentId].push(tokenId);
        _safeMint(to, tokenId);
        emit PermissionMinted(tokenId, to, parentId, policy.spendingLimit, policy.expiry);
    }

    // ---------------------------------------------------------------------
    // Freeze / unfreeze — reversible pause, issuer-only
    // ---------------------------------------------------------------------

    function freeze(uint256 tokenId) external {
        if (!_canManage(msg.sender, tokenId)) revert NotAuthorized();
        frozen[tokenId] = true;
        emit PermissionFrozen(tokenId, msg.sender);
    }

    function unfreeze(uint256 tokenId) external {
        if (!_canManage(msg.sender, tokenId)) revert NotAuthorized();
        frozen[tokenId] = false;
        emit PermissionUnfrozen(tokenId, msg.sender);
    }

    // ---------------------------------------------------------------------
    // V2 guardian — freeze-only circuit breaker, opted into per delegation tree by the root owner
    // ---------------------------------------------------------------------

    /// @notice Root owner authorizes `guardian` (e.g. the AgentWallet) to freeze tokens in this
    ///         tree. Pass address(0) to remove it.
    function setGuardian(uint256 rootId, address guardian) external {
        if (parentTokenId[rootId] != 0 || !_exists(rootId) || ownerOf(rootId) != msg.sender) revert NotAuthorized();
        guardianOf[rootId] = guardian;
        emit GuardianSet(rootId, guardian);
    }

    /// @notice Freeze `tokenId` on behalf of its tree's guardian. Freeze-only: the guardian can
    ///         stop a token instantly but cannot unfreeze or revoke it.
    function guardianFreeze(uint256 tokenId) external {
        if (!_exists(tokenId)) revert TokenNotValid();
        address g = guardianOf[rootOf(tokenId)];
        if (g == address(0) || g != msg.sender) revert NotAuthorized();
        frozen[tokenId] = true;
        emit PermissionFrozen(tokenId, msg.sender);
    }

    // ---------------------------------------------------------------------
    // Revoke — irreversible, cascades to every descendant (the kill switch)
    // ---------------------------------------------------------------------

    function revoke(uint256 tokenId) external {
        if (!_canManage(msg.sender, tokenId)) revert NotAuthorized();
        _revokeRecursive(tokenId, msg.sender);
    }

    function _revokeRecursive(uint256 tokenId, address by) internal {
        if (!_exists(tokenId)) return; // already revoked as part of an ancestor's cascade
        uint256[] memory children = childTokenIds[tokenId];
        for (uint256 i = 0; i < children.length; i++) {
            _revokeRecursive(children[i], by);
        }
        delete childTokenIds[tokenId];
        _burn(tokenId);
        emit PermissionRevoked(tokenId, by);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function getPolicy(uint256 tokenId) external view returns (Policy memory) {
        return _policies[tokenId];
    }

    function getChildren(uint256 tokenId) external view returns (uint256[] memory) {
        return childTokenIds[tokenId];
    }

    /// @notice The root of the delegation tree `tokenId` belongs to.
    function rootOf(uint256 tokenId) public view returns (uint256 root) {
        root = tokenId;
        while (parentTokenId[root] != 0) root = parentTokenId[root];
    }

    /// @notice A token is valid if it (still) exists, has not expired, and neither it nor any
    ///         ancestor in its delegation chain is frozen.
    function isValid(uint256 tokenId) public view returns (bool) {
        if (!_exists(tokenId)) return false;
        if (block.timestamp >= _policies[tokenId].expiry) return false;

        uint256 current = tokenId;
        while (true) {
            if (frozen[current]) return false;
            uint256 parent = parentTokenId[current];
            if (parent == 0) break;
            current = parent;
        }
        return true;
    }

    /// @notice Combined validity + spending-limit + allowlist check for a proposed action.
    function checkPolicy(uint256 tokenId, address target, uint256 value) external view returns (bool) {
        if (!isValid(tokenId)) return false;
        Policy memory p = _policies[tokenId];
        if (value > p.spendingLimit) return false;
        return _contains(p.allowlist, target);
    }

    // ---------------------------------------------------------------------
    // Internal helpers
    // ---------------------------------------------------------------------

    /// @dev A token is "managed" by whoever owns its parent (the issuer that delegated it).
    ///      A root token is managed only by its own owner.
    function _canManage(address caller, uint256 tokenId) internal view returns (bool) {
        uint256 parent = parentTokenId[tokenId];
        if (parent == 0) {
            return _exists(tokenId) && ownerOf(tokenId) == caller;
        }
        return _exists(parent) && ownerOf(parent) == caller;
    }

    function _exists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    function _contains(address[] memory list, address item) internal pure returns (bool) {
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i] == item) return true;
        }
        return false;
    }

    function _isSubset(address[] memory child, address[] memory parent) internal pure returns (bool) {
        for (uint256 i = 0; i < child.length; i++) {
            if (!_contains(parent, child[i])) return false;
        }
        return true;
    }
}
