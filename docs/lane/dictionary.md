# Dictionary

Copy these strings character for character. The ellipsis in the short address is U+2026 `…`, not three ASCII dots.

## Screen

| ID | Text |
|---|---|
| D-01 | `Kill-switch` |
| D-02 | `Connect` |
| D-03 | `Disconnect` |
| D-04 | `Switch to Sepolia` |
| D-05 | `Account` |
| D-06 | `Agent` |
| D-07 | `Permission` |
| D-08 | `Allowances` |
| D-09 | `Operators` |
| D-10 | `Permit2` |
| D-11 | `Delegation` |
| D-12 | `none` |
| D-13 | `No agents for this account` |
| D-14 | `Revoke` |
| D-15 | `Needs the agent key` |
| D-16 | `Index failed` |
| D-17 | `Revoke failed` |
| D-18 | `This approval stays until the agent key signs.` |
| D-19 | `Revoke agent` |
| D-20 | `Revoking the agent does not clear this approval.` |
| D-21 | `Roles` |

Permission line, one line, fields separated by single spaces:

```text
#<tokenId> <status> <spendingLimit> wei exp <expiry> allow <list>
```

`<list>` is the allowlist addresses joined by `,` with no spaces. An empty allowlist uses `none`. Example: `#2 ACTIVE 800000000000000 wei exp 1735689600 allow 0x000000000000000000000000000000000000dEaD`.

ERC-20 line: `<token> <spender> <amount>`

ERC-721 line: `<token> <operator>`

Permit2 line: `<token> <spender> <amount> exp <expiration>`

Delegation line: the implementation address, or D-12 when there is no delegation.

ENS line: `<resource> <agent>`. `<resource>` is the decimal resource id. `<agent>` is the checksummed assignee. An empty role list under D-21 is D-12.

Short address: `0x` + first 4 hex characters + `…` + last 4 hex characters. `shortAddress('0xB6AF02FeEA21e2960A7C14FAf97bAdbE2E982836')` is `0xB6AF…2836`.

## Thrown errors

| ID | Message | When |
|---|---|---|
| E-01 | `Missing VITE_FROM_BLOCK` | `readFromBlock` gets `undefined` or a string that is not base-10 digits |
| E-02 | `Wrong chain` | `assertChain` gets a chain id other than `11155111` |
| E-03 | `Not allowed` | a send function is called when the boolean check is false |
| E-04 | `Log scan failed` | `eth_getLogs` throws. No retry, no token list |
| E-05 | `Revoke failed` | the wallet rejects or the receipt status is 0. This is screen text D-17, not a second wording |

## Watcher stdout

| ID | Text |
|---|---|
| W-01 | `Needs the agent key` |
| W-02 | `K12 blocked` |
| W-03 | `K12 blocked: eip-7702 needs a later spec` |

The existing watcher line that contains `revoke tx:` stays. K12 does not rename it.
