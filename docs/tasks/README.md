# Kill-switch lane tasks

Draft. One Spec and one Plan per task. The agent executes the Spec. It does not choose a version, a type, a string, or a call.

Start with the lane pages. Precedence is in [working rules](../lane/working-rules.md): [security](../lane/security.md), then [system](../lane/system.md), then [dictionary](../lane/dictionary.md), then [quality](../lane/quality.md), then the task Spec, then the Plan.

[docs/architecture.md](../architecture.md) is the product description. It does not override those pages.

The screen lists Permit2, EIP-7702, ENSv2, and `PermissionToken` together. K0 records the watcher account in [`docs/decisions/framework-account.md`](../decisions/framework-account.md). That file is decided: `permission-token`. K17 reads [`docs/decisions/ens-v2.md`](../decisions/ens-v2.md).

| ID | Name | Wave | Depends on | Tests | Estimate (h) | Owner | Status |
|---|---|---|---|---|---|---|---|
| [K0](K0-framework-account/spec.md) | Framework account decision · [Plan](K0-framework-account/plan.md) | Wave 0 | — | — | 0.5 | Human | Done |
| [K1](K1-app-scaffold/spec.md) | App scaffold · [Plan](K1-app-scaffold/plan.md) | Wave 1 | — | K-T-1 | 1.5 | Agent | Done |
| [K2](K2-wallet-session/spec.md) | Wallet session · [Plan](K2-wallet-session/plan.md) | Wave 1 | K1 | K-T-2 | 1.5 | Agent | Done |
| [K3](K3-permission-token-index/spec.md) | PermissionToken index · [Plan](K3-permission-token-index/plan.md) | Wave 1 | K1 | K-T-3 | 2.5 | Agent | Done |
| [K4](K4-agent-groups/spec.md) | Agent groups · [Plan](K4-agent-groups/plan.md) | Wave 1 | K3 | K-T-4 | 1.0 | Agent | Done |
| [K5](K5-erc20-allowances/spec.md) | ERC-20 allowance index · [Plan](K5-erc20-allowances/plan.md) | Wave 1 | K4 | K-T-5 | 2.0 | Agent | Done |
| [K6](K6-erc721-operators/spec.md) | ERC-721 operator index · [Plan](K6-erc721-operators/plan.md) | Wave 1 | K4 | K-T-6 | 1.5 | Agent | Done |
| [K7](K7-permit2/spec.md) | Permit2 standing allowance index · [Plan](K7-permit2/plan.md) | Wave 1 | K4 | K-T-7 | 2.0 | Agent | Done |
| [K8](K8-eip7702-read/spec.md) | EIP-7702 code read · [Plan](K8-eip7702-read/plan.md) | Wave 1 | K4 | K-T-8 | 1.0 | Agent | Done |
| [K9](K9-agent-screen/spec.md) | Agent screen · [Plan](K9-agent-screen/plan.md) | Wave 1 | K2, K4, K5, K6, K7, K8 | K-T-9 | 2.0 | Agent | Done |
| [K10](K10-click-revoke-permission/spec.md) | Click revoke PermissionToken · [Plan](K10-click-revoke-permission/plan.md) | Wave 1 | K2, K9 | K-T-10 | 2.0 | Agent | Done |
| [K11](K11-click-revoke-allowance/spec.md) | Click revoke allowance · [Plan](K11-click-revoke-allowance/plan.md) | Wave 1 | K2, K9 | K-T-11 | 1.5 | Agent | Done |
| [K14](K14-click-revoke-erc721/spec.md) | Click revoke ERC-721 operator · [Plan](K14-click-revoke-erc721/plan.md) | Wave 1 | K2, K9 | K-T-14 | 1.5 | Agent | Done |
| [K15](K15-click-revoke-permit2/spec.md) | Click revoke Permit2 · [Plan](K15-click-revoke-permit2/plan.md) | Wave 1 | K2, K9 | K-T-15 | 1.5 | Agent | Done |
| [K16](K16-click-clear-7702/spec.md) | Click clear EIP-7702 · [Plan](K16-click-clear-7702/plan.md) | Wave 1 | K2, K8, K9 | K-T-16 | 2.0 | Agent | Done |
| [K17](K17-ens-v2/spec.md) | ENSv2 role index · [Plan](K17-ens-v2/plan.md) | Wave 2 | K2 | K-T-17 | 2.0 | Agent | Done |
| [K12](K12-auto-revoke/spec.md) | Watcher auto-revoke · [Plan](K12-auto-revoke/plan.md) | Wave 2 | K0, K5 | K-T-12 | 3.0 | Agent | Done |
| [K13](K13-boundary/spec.md) | Index boundary · [Plan](K13-boundary/plan.md) | Wave 1 | K1 | K-T-13 | 1.0 | Agent | Done |

Each task folder holds `spec.md` and `plan.md`.

A comment never holds a decision. When a requirement changes, the Spec text changes. If two pages disagree, the agent writes the BLOCKED line and stops.
