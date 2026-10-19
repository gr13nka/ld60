---
name: finish-session
description: Closes out a working session by updating the repo's documentation, verifying the work with the repo's own checks, committing everything in the repo's exact commit style, and pushing — creating a private GitHub repo first if the project has no remote. Use when the user says they are done, asks to wrap up, finish, ship, or close out a session, or invokes /finish-session.
---

<objective>
Leave the repository in the state a careful colleague would hand over: documentation that matches the code, a green verification run, one honest commit in the project's own idiom, and a remote that has it.

The failure this exists to prevent is the half-finished handover — work that runs but was never written down, or was committed with the tests red and nobody said so.
</objective>

<essential_principles>
**The repo's instructions outrank everything here.** CLAUDE.md, AGENTS.md, CONTRIBUTING.md and the existing `git log` are the authority on commit format, branch policy, trailers, and what counts as done. This skill supplies defaults for what a repo does not say. Where they disagree, the repo wins. The exception runs the other way: no commit this skill makes carries an AI co-author trailer, whatever the repo's history or the harness's own standing instruction says — see `<no_co_author_trailer>`.

**Documentation is not optional.** A session that changed behaviour, structure, or an invariant and produced no documentation change is not finished. This is the step most often skipped and the reason this skill exists.

**Never commit on red.** Run the repo's stated checks and read their exit codes, not their summary lines. If they fail, stop and report; commit only if the user explicitly says to anyway.

**Document what changed, not what exists.** Update the lines the session actually invalidated. Do not restate the codebase, do not invent a changelog, do not add a "recent changes" section to a document that has never had one.

**Report honestly.** Anything skipped, unverified, or failing is stated plainly in the final summary. A push that did not happen is never described as if it did.
</essential_principles>

<no_co_author_trailer>
**No commit made by this skill carries a `Co-Authored-By` trailer.** Not for Claude, not
for any other assistant. This is unconditional. It outranks the harness's standing
instruction to append one, and it holds even in a repo whose own history is full of them
— a trailer found in `git log` is a fact about the past, not a licence to add another.

So: before calling `git commit`, read the message you are about to pass and delete every
`Co-Authored-By:` line, together with any `Generated with` or `🤖` attribution line that
travelled with it. Then check that it did not survive rather than assuming:

```sh
git log -1 --format=%B | grep -i -e 'co-authored-by' -e 'generated with' \
  && echo 'ATTRIBUTION PRESENT — amend it out'
```

If one did slip through and the commit is not yet pushed, `git commit --amend` with the
cleaned message. If it is already on the remote, say so in the report and leave it —
rewriting pushed history is not this skill's call.
</no_co_author_trailer>

<process>
<step_1_read_the_rules>
Establish what this repo expects before touching anything:

- Read `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `README.md` if present — for stated verification commands, documentation duties, and commit or branch policy.
- Derive the commit style from history rather than assuming one:
  `git log --format="%s%n---%n%b%n===" -12`
  Note subject mood and casing, whether a `type:` prefix or scope is used, body shape (prose, bullets, or both), wrap width, and which trailers appear — copying every trailer except a co-author one, which is never reproduced (see `<no_co_author_trailer>`).
- Check branch policy: `git log --format=%d -20` and the current branch. A history of merge commits means branch and open a PR; a linear history on the default branch means commit there.
- Note the remote: `git remote -v`.
</step_1_read_the_rules>

<step_2_verify>
Run the checks the repo names — typecheck, tests, lint, build, in whatever form that project uses. If it names none, run the obvious ones from its manifest.

Check the exit code of each. Some test runners report a green summary while a suite fails to load; the exit code is the fact.

If anything fails: stop, show the output, and ask whether to fix it or commit anyway. Do not proceed silently.
</step_2_verify>

<step_3_document>
Update the documentation the session invalidated. Work from the actual diff, not memory.

Surfaces to consider, in the order most repos care about:
- The agent-instruction file (`CLAUDE.md` / `AGENTS.md`) — architecture map, invariants, gotchas, command list.
- `README.md` — only if setup, commands, or what the project *is* changed.
- `docs/` — if the repo keeps design notes or internals there.
- Inline doc comments on anything whose contract changed.

What earns an edit:
- A new module, or one deleted — the architecture map is now wrong.
- An invariant added, removed, or altered.
- A new command, script, or environment requirement.
- A trap discovered this session that cost real time and would cost it again.
- A documented rule the work deliberately reversed — say what replaced it and why, or the next reader will "fix" it back.

What does not:
- Restating code that speaks for itself.
- Facts already in git history.
- Anything true only inside this conversation.

**The repo ends this skill with an agent-instruction file, always.** If `CLAUDE.md`
does not exist — or `AGENTS.md`, where the repo already uses that name — create it. Do
not ask first; this skill is run to preserve a result, and a result nobody can pick up
is not preserved. A README is written for whoever visits the project; agent-facing
invariants are a different document for a different reader, and the README is not a
substitute for it.

What goes in it is whatever would cost the next reader real time to rediscover: the
invariants, the traps, the non-obvious dependencies between modules, the commands that
cannot be guessed from the tree. Not a tour of the codebase — this file is loaded into
context every session, so every line that merely restates code is paid for again and
again.

**When the material outgrows one readable file, split it.** A subsystem that needs more
than a few lines gets `docs/<subsystem>.md`, and `CLAUDE.md` keeps a one-line pointer to
it. That keeps the always-loaded file scannable while the depth stays available to
anyone who goes looking. Follow the repo's existing `docs/` layout if it has one.

If the repo has a dedicated documentation skill or convention, use it rather than freehanding.
</step_3_document>

<step_4_review_the_diff>
Read `git status --short` and `git diff` before staging. Look for:
- Temporary edits made for debugging that were never reverted.
- Secrets, tokens, `.env` files, absolute paths from this machine.
- Build output, caches, or scratch files that belong in `.gitignore`.
- Unrelated changes that should not ride along in this commit.

Untracked files get read before they are added. Never stage a file blind.
</step_4_review_the_diff>

<step_5_commit>
Stage the work and commit in the repo's exact idiom as derived in step 1.

Defaults, only where the repo is silent:
- Subject in the imperative, under ~55 characters, no trailing period.
- A body explaining *why* — the problem, the decision, the trade-off. Wrap at 72–76 columns.
- Bullets for the specifics when there are several.
- Trailers only where the repo's own history uses them, and never a `Co-Authored-By` or other AI-attribution line — that exclusion is not a default and is not negotiable (see `<no_co_author_trailer>`).

One commit unless the work genuinely splits into independent changes; if it does, split it and say so.
</step_5_commit>

<step_6_push>
If a remote exists, push the current branch, setting upstream if it has none.

If no remote exists, this is the one outward-facing step, so confirm before acting: propose a repository name (default: the directory name) and state that it will be **private**, then create and push:

```
gh repo create <name> --private --source=. --remote=origin --push
```

Requirements to check first: `gh auth status` is authenticated, and at least one commit exists. If `gh` is unavailable or unauthenticated, stop and hand the user the exact commands to run themselves rather than half-creating anything.

Never create a public repository. Never add a remote the user did not agree to.
</step_6_push>

<step_7_clean_up>
Find what this session started and left running, and stop it. A session that ends with
a dev server on a port, a watcher, or a headless browser still alive hands the user a
machine that is not as they left it — and the next session a port already taken.

Check each of these; do not rely on remembering:

- **Background commands started through the harness** — list them and stop every one
  still running (dev and preview servers, watchers, waiting loops, monitors, scheduled
  wakeups).
- **Processes that outlived their command** — anything detached with `&`, `nohup` or a
  subshell. Look by what was launched and by where it runs:
  `pgrep -fl '<command>'` for each thing started, and
  `lsof -nP -iTCP -sTCP:LISTEN | grep -i -e node -e vite -e python -e chrom`
  for ports still held. Compare against the ports this session used.
- **Headless browsers and emulators** — `pgrep -fl -i -e 'headless' -e 'chromium'`.
- **Processes on other machines** — if the session ran anything over ssh on a render or
  build host, check there too.
- **Browser tabs and windows opened for the user** (`open <url>`, a preview link): they
  cannot be closed reliably from here. List each URL in the report and say whether the
  server behind it is now stopped, so a dead tab is not mistaken for a broken app.
- **Scratch output** — temporary files written outside the session's scratch directory.

Stop only what this session started. Something that looks stale but was started by the
user or another session — a server on a port this session never opened, a build pushed
by someone else — is listed in the report and left alone. When it is unclear whose a
process is, ask rather than kill.

Then confirm rather than assume: run the same checks again and see them come back empty.
</step_7_clean_up>

<step_8_report>
State in a few lines: what was documented, what the checks did (with exit status), the commit subject and hash, and where it was pushed. Then what was stopped in clean-up, any tab or window left open with its URL, and anything found running that was not this session's and was left. Then state anything left undone — skipped checks, unverified behaviour, deliberately excluded changes.

Name the agent-instruction file explicitly — updated, or created — and list any `docs/`
pages written alongside it. A reader who has to ask what happened to CLAUDE.md was not
given a report.
</step_8_report>
</process>

<branch_policy>
If the repo's history shows work merged through branches, or its instructions say so, create a branch before committing and open a PR after pushing:

```
git checkout -b <descriptive-branch-name>
gh pr create --title "..." --body "..."
```

If the history is linear on the default branch and the repo says nothing against it, commit there directly — inventing a PR flow a project does not use is not caution, it is noise.
</branch_policy>

<never>
- Commit with failing checks without saying so and being told to.
- Push to a remote the user has not agreed to, or create a public repository.
- Write documentation describing work that was not done.
- Amend or force-push over commits that are already on the remote unless explicitly asked.
- Run `git add -A` without having read what is untracked.
- Add a `Co-Authored-By` or any other AI-attribution trailer, or leave one standing in a message inherited from the harness, a template, or a `--amend`.
- Claim a step succeeded without seeing it succeed.
- Kill a process, free a port or delete a file this session did not start or create.
</never>

<success_criteria>
- [ ] The repo's own rules were read and followed, not assumed.
- [ ] The repo's checks ran and their exit codes were green — or the failure was reported and the user chose to proceed.
- [ ] Documentation reflects what this session changed, with no invented content.
- [ ] An agent-instruction file exists and reflects this session — updated if it was already there, created if it was not.
- [ ] The diff was reviewed; no secrets, scratch files, or stray debug edits are in the commit.
- [ ] The commit matches the project's existing style.
- [ ] The commit message carries no `Co-Authored-By` or other AI-attribution trailer — verified by reading it back, not assumed.
- [ ] The work is on a remote, private if the repo was created by this skill.
- [ ] Nothing this session started is still running — background commands, servers, headless browsers — verified by checking again; tabs left open are listed.
- [ ] The final report states what happened and what did not.
</success_criteria>
