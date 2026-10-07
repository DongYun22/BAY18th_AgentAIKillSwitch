# K0 Plan · Framework account decision

## Ready when

[docs/architecture.md](../../architecture.md) is on the branch.

## Branch

None. This is a document a human writes on whatever branch is current. An agent does not open a branch for K0.

## Steps

1. Read [docs/architecture.md](../../architecture.md) section "Framework account".
2. If the team has not chosen, stop. Do not create `docs/decisions/framework-account.md` with a guessed `Choice`.
3. If the team has chosen, a human writes the file in the Spec's field order with `Status: decided`.
4. Do not edit contracts, the watcher, or the app in the same change.

## Commands

None.

## Risks and fallbacks

- An agent treats an empty repo as permission to pick `eip-7702`. The Spec forbids that. K12's first step checks the file and stops.

## Review focus

`Choice` is one of the two allowed strings. No third option.

## Time box

0.5 hours, human only.

## Agent prompt

```text
Do not implement K0. WR-10 in docs/lane/working-rules.md applies. Do not create docs/decisions/framework-account.md.
If a human asks you to record a choice, write only that file, with Status, Choice, Date,
and Decided by, and change no other file. Choice is permission-token or eip-7702.
```
