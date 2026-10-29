# Domain Docs

How the engineering skills should consume this repo's domain documentation
when exploring the codebase.

## Before exploring, read these

The glossary, ADRs, specs and research notes all live in `no-market/roadmap`;
this repo keeps no `GLOSSARY.md`, `docs/adr/` or specs of its own. Read them
through `gh`:

```sh
gh api repos/no-market/roadmap/contents/<path> -H "Accept: application/vnd.github.raw"
gh api repos/no-market/roadmap/contents/docs/adr --jq '.[].name'
```

- **`GLOSSARY.md`**: the product-wide vocabulary.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in.
- **The spec** behind the issue you're working on, through its parent's
  `Spec:` line.
- **`docs/research/`**: read notes relevant to the question at hand before
  researching it again.

## New terms and decisions are proposals

When `/domain-modeling` resolves a term or a decision here, write it in the
glossary's or ADR's format under `### Decisions` in the pull request's
`Proposal for the roadmap` on the parent issue (see `AGENTS.md`). A roadmap
session records it there.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor
proposal, a hypothesis, a test name), use the term as defined in the
glossary. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either
you're inventing language the project doesn't use (reconsider) or there's a
real gap (write a proposal for the roadmap).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than
silently overriding:

> _Contradicts ADR-0004 (Python for the backend), but worth reopening because…_
