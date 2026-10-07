# Working rules

How an agent executes a kill-switch task. The agent does not choose a version, a type, a string, a file, or a call that these pages do not already name.

## Precedence

When two pages disagree, this order wins:

1. [security.md](security.md)
2. [system.md](system.md)
3. [dictionary.md](dictionary.md)
4. [quality.md](quality.md)
5. The task Spec
6. The task Plan
7. Code comments

The agent writes this line and stops. It does not pick a side.

```text
BLOCKED: <page and section> · <the two texts> · no third option
```

## Rules

| ID | Rule |
|---|---|
| WR-01 | A task starts only when every task in Depends on is merged, and its Spec names no open choice. |
| WR-02 | Done means every Acceptance line in the Spec passed, the QC gate in [quality.md](quality.md) is green, the prompt file exists, and a human merged the PR. The agent does not merge. |
| WR-03 | Branch `ks/<id>-<slug>` from `main`. Worktree `../ks-<id>`. One agent, one task, one worktree. |
| WR-04 | The agent edits only paths under the Spec's Owns. A file that is not listed is not created. |
| WR-05 | UI strings and thrown messages are copied from [dictionary.md](dictionary.md). Types and function signatures are copied from [system.md](system.md). Versions are copied from system §1. |
| WR-06 | The agent saves the prompt it was given as `docs/prompts/<ID>.md` in the same change. |
| WR-07 | The PR body is exactly the template in [quality.md](quality.md) §4. |
| WR-08 | A comment does not hold a decision. A change to a requirement is a change to the Spec. |
| WR-09 | `dashboard/index.html` is not edited by K1–K16. |
| WR-10 | K0 is a human file. An agent does not create `docs/decisions/framework-account.md` and does not pick `permission-token` or `eip-7702`. |
