# eval-board agent guide

A code repo of the no-market product. Its specs, decisions and glossary live
in the private repo [`no-market/roadmap`](https://github.com/no-market/roadmap);
this repo holds the code and its implementation tickets.

## Roadmap

Work arrives as a parent issue labelled `spec`, created from a roadmap session.
Its `Spec:` line is the spec's URL in the roadmap, and `/to-tickets` cuts it
into sub-issues that point back at it under `## Parent`.

- **Follow the chain** from an issue to its spec: `## Parent`, then the
  parent's `Spec:` line. Read the spec, `GLOSSARY.md` and `docs/adr/` through
  `gh`:

  ```sh
  gh api repos/no-market/roadmap/contents/<path> -H "Accept: application/vnd.github.raw"
  ```

- **The roadmap is read-only from here.** Everything for it goes into a
  proposal on the parent; a roadmap session records it.
- **Pull requests close their sub-issues** with `Closes #N`. The parent is
  closed from the roadmap.
- **Close the loop on the parent.** Before a pull request goes to review,
  comment on the parent with one `Proposal for the roadmap` for it, also when
  the build followed the spec. Keep the sections that have something; a build
  that followed the spec has none, and says `Followed the spec.`

  ```markdown
  ## Proposal for the roadmap

  Pull request: #<N>

  ### Decisions
  <decisions and terms made or changed while building>
  ### Retro
  <what went off plan, and why>
  ### Follow-ups
  <work found but left for later>
  ### Hand-off
  <fixes to the roadmap's hand-off guide or skills>
  ```

The whole hand-off is in the roadmap's `docs/agents/code-repos.md`.

## Agent skills

### Issue tracker

Implementation tickets are GitHub Issues in this repo, read and written with
`gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage labels, plus `spec` for parent issues. See
`docs/agents/triage-labels.md`.

### Domain docs

The glossary, ADRs and specs live in the roadmap; this repo keeps none. See
`docs/agents/domain.md`.

### Repo skills

Skills go in `.agents/skills/`; `.claude/skills` is a symlink to it, so Codex
and Claude Code read the same skills.
