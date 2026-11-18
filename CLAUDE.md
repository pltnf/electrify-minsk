# electrify-minsk

Project context for Claude Code.

## Work protocol

Every change must be traceable to a ticket and verifiable later. Board settings live in
[`.managic-agent.json`](.managic-agent.json) (`workspace`, `project`, `repo`, `default_branch`).

- **Work comes from tickets** on the Managic board, in the workspace and project named in `.managic-agent.json`. No ticket, no work: ask which one.
- **Branch:** `<wave-or-ticket>-YYYY-MM-DD`. Never push to the default branch. No force-push.
- **Commits** start with `[<first 8 chars of the ticket id>]`, e.g. `[a1b2c3d4] fix(scope): what changed`. One ticket per commit.
- **After the work** write `docs/reports/<branch>.md`: per ticket status, commit sha, tests, risks, Needs Nik. `scripts/managic-report --write-report` drafts it from `git log`.
- **Print a final block** `REPORT FOR JOA` (max 25 lines, plain text). `scripts/managic-report` prints it from the commits on the current branch.
- **Reporting back:** with `MANAGIC_AGENT_KEY` set, `scripts/managic-report` also posts one comment per ticket (status, branch, sha, tests) through the Managic agent API. Without the key it only prints. Never print, log or commit the key.
- **CI** runs on every push to a non-default branch. Job names are stable (the status is read through the GitHub API); do not rename them.
