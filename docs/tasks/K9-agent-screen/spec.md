# K9 Spec · Agent screen

## Goal

After connect, the page shows the account block and one block per agent. Buttons are not wired.

## Source of truth

[docs/lane/system.md](../../lane/system.md) §7. [docs/lane/dictionary.md](../../lane/dictionary.md) screen table and the permission line. A disagreement is BLOCKED.

## Owns

- `app/src/view/render.ts`
- `app/src/view/render.test.ts`
- `app/src/main.ts` (load and render only)

## Requirements

1. `renderAgents(root: HTMLElement, model: ScreenModel): void` replaces the contents of `root`. `toScreen` returns the `ScreenModel` in system §3 and §7.
2. The account block, the agent blocks, the headings, and the line formats are dictionary D-05 through D-13 and the permission-line template. Empty lists use D-12. Zero agents use D-13 and still render the account block.
3. Join keys are system §7. An allowance whose owner is neither `cold` nor a group agent is dropped.
4. `main.ts`, after a Sepolia connect, runs K3, K4, K5, K6, K7, and K8 with the address list in system §7, calls `toScreen`, and calls `renderAgents`. A read error prepends a paragraph D-16 and does not call `renderAgents`, so a previous successful render stays.
5. The render contains no `button` elements.
6. `render.test.ts` is named `K-T-9`. It renders one agent with one `ACTIVE` permission and one ERC-20 row whose owner is that agent, and asserts the address, `ACTIVE`, the spender, D-18, and D-20. A model with `agents: []` asserts D-13 and still asserts D-05. `root.querySelectorAll('button').length` is 0.

## Security

The screen is a view. It does not attach click handlers that send transactions.

## Acceptance

- K-T-9 passes by name.
- A manual Sepolia connect against the deployed `PermissionToken` shows the known Hot Agent when the connected address is the parent owner `0xB6AF02FeEA21e2960A7C14FAf97bAdbE2E982836`. If that key is unavailable, the PR records the skip. The unit test still passes.

## Out of scope

Revoke buttons (K10, K11, K14, K15, K16). Watcher changes.
