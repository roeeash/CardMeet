---
description: Run one deployment-plan cycle end to end (Planner -> Coder -> Reviewer) and stop when the cycle is complete.
argument-hint: "[optional: cycle number to target, otherwise the next unchecked cycle]"
allowed-tools: Task, Read, Edit, Bash, Grep, Glob, TaskCreate, TaskUpdate
---

# /workflow — one deployment cycle

You are the **orchestrator** of a three-agent workflow that advances `PLAN.md` by **exactly one cycle**. A cycle is complete when its work is implemented, reviewed, approved, and its checkbox is ticked. **Then you stop** — one run of `/workflow` = one cycle.

Optional argument: `$ARGUMENTS` — a specific cycle number to run. If empty, target the **first unchecked** cycle in the plan's "Cycle map".

## Procedure

1. **Identify the cycle.** Read `PLAN.md`. Determine the current cycle: `$ARGUMENTS` if given, else the first `- [ ]` in the Cycle map. If all cycles are checked, report "All cycles complete" and stop. Announce which cycle you are running.

2. **PLAN.** Launch the `planner` subagent (Task tool, `subagent_type: planner`). Pass it the cycle number and tell it to plan only that cycle. Capture its returned plan verbatim.
   - If the planner reports a **Blocker**, stop the run and surface it to the user. Do not proceed to coding.

3. **CODE.** Launch the `coder` subagent (`subagent_type: coder`). Pass it the planner's full plan plus the cycle number. It implements the files and tests and runs `pytest`. Capture its implementation report.

4. **REVIEW.** Launch the `reviewer` subagent (`subagent_type: reviewer`). Pass it the cycle number, the planner's plan, and the coder's report. It independently re-runs the tests and returns **APPROVE** or **REQUEST CHANGES**.

5. **Iterate if needed.** If the reviewer returns **REQUEST CHANGES**, send its findings back to the `coder` subagent to fix, then re-run the `reviewer`. Repeat at most **3** times. If still not approved after 3 rounds, stop and report the outstanding findings to the user (do not tick the box).

6. **Close the cycle (only on APPROVE).** You (the orchestrator) then:
   - Tick that cycle's checkbox in the "Cycle map" of `DEPLOYMENT_PLAN.md` (`- [ ]` -> `- [x]`) using Edit.
   - Fill the cycle's `**Outcome:**` line with a one-sentence summary of what shipped.
   - Report a short completion summary: cycle number, files changed, test result, reviewer verdict.

7. **Stop.** Do not start the next cycle. Tell the user to run `/workflow` again to advance to the next one.

## Rules

- Exactly **one** cycle per invocation.
- The three workers all run on Haiku (defined in `.claude/agents/`). You only orchestrate, gate, and update the plan file.
- Never tick a checkbox without an explicit APPROVE from the reviewer.
- Keep the user informed with a brief line at each stage (Planning / Coding / Reviewing / Done), not a wall of text.
- If anything blocks (planner blocker, repeated review failure, failing tests), stop cleanly and explain — never fake completion.
