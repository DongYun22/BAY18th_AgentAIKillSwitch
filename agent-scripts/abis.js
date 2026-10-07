// Minimal human-readable ABIs — only the functions/events these scripts actually call.

export const PERMISSION_TOKEN_ABI = [
  "function mintRoot((uint256 spendingLimit, address[] allowlist, uint64 expiry) policy) returns (uint256)",
  "function mintChild(address to, uint256 parentId, (uint256 spendingLimit, address[] allowlist, uint64 expiry) policy) returns (uint256)",
  "function freeze(uint256 tokenId)",
  "function unfreeze(uint256 tokenId)",
  "function revoke(uint256 tokenId)",
  "function isValid(uint256 tokenId) view returns (bool)",
  "function getPolicy(uint256 tokenId) view returns ((uint256 spendingLimit, address[] allowlist, uint64 expiry))",
  "event PermissionMinted(uint256 indexed tokenId, address indexed to, uint256 indexed parentId, uint256 spendingLimit, uint64 expiry)",
  "event PermissionFrozen(uint256 indexed tokenId, address indexed by)",
  "event PermissionRevoked(uint256 indexed tokenId, address indexed by)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function getChildren(uint256 tokenId) view returns (uint256[])",
  "function frozen(uint256 tokenId) view returns (bool)",
  // V2 guardian (on-chain circuit breaker)
  "function setGuardian(uint256 rootId, address guardian)",
  "function guardianFreeze(uint256 tokenId)",
  "function guardianOf(uint256 rootId) view returns (address)",
  "function rootOf(uint256 tokenId) view returns (uint256)",
  "event GuardianSet(uint256 indexed rootId, address indexed guardian)",
  "event PermissionUnfrozen(uint256 indexed tokenId, address indexed by)",
  // custom errors, so ethers can decode revert reasons by name
  "error NotTransferable()",
  "error NotAuthorized()",
  "error TokenNotValid()",
  "error PolicyExceedsParent()",
  "error ERC721NonexistentToken(uint256 tokenId)",
];

export const AGENT_WALLET_ABI = [
  "function execute(uint256 tokenId, address target, uint256 value, bytes data) returns (bytes)",
  "event AgentTransactionExecuted(uint256 indexed tokenId, address indexed target, uint256 value, bytes data)",
  // V2: violation attempted -> token frozen in the same tx (tx status is 1, but nothing was sent)
  "event PolicyViolation(uint256 indexed tokenId, address indexed target, uint256 value)",
  "error NotTokenOwner()",
  "error PolicyRejected()",
  "error ExecutionFailed()",
  "function clearErc20Allowance(uint256 tokenId, address token, address spender)",
  "event Erc20AllowanceCleared(uint256 indexed tokenId, address indexed token, address indexed spender)",
  "error NotManager()",
  "error ClearFailed()",
];
