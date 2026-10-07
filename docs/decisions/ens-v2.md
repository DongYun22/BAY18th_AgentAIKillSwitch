# Status

Value: decided

# Registry

Value: 0xD4eBcbBdF463C9c45784603Db0dDD499BC44A8B4

# Assignee event

Value: EACRolesChanged(uint256 indexed resource, address indexed account, uint256 oldRoleBitmap, uint256 newRoleBitmap)

# Admin rule

Value: hasRoles(resource, adminBitmap, connected) is true. adminBitmap shifts the regular-role bits up by 128 and keeps the admin-role bits that are already set. Resource 0 uses hasRootRoles and revokeRootRoles, because revokeRoles reverts on ROOT_RESOURCE.

# Date

Value: 2026-10-05

# Decided by

Value: Henry Choi

# Source

Value: ETHRegistry on https://docs.ens.domains/learn/deployments/ . The contract was created on Sepolia in block 11820399. The event is IEnhancedAccessControl.EACRolesChanged in ensdomains/contracts-v2. This index reads that one registry. Per-name UserRegistry contracts are separate addresses and are not scanned.
