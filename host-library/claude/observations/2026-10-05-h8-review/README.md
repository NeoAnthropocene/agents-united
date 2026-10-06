# H8 review archive (Plan 035, Sitting D, 2026-10-05 and 2026-10-06)

The record behind `../2026-10-05-claude-2.1.289-hardening-h8.md`: what the six skills scored against no skill, with every answer and every verdict. It is kept so that a later H8 run on other skills can be compared with it and can reuse the method. It is a record, not a maintained tool.

| File or folder | What it is |
| --- | --- |
| `review-iteration-1.html` | Open it in a browser. Iteration 1: 12 prompts with the skill and 12 without, each prompt, both answers, every assertion with PASS or FAIL and the quoted evidence. |
| `review-iteration-2.html` | Iteration 2: the three revised skills re-run headless, with the latest evidence per skill at the top, and the fixture evals for `seo-audit` and `conversion-funnel-optimization`. |
| `review-intake.html` | The follow-up of 2026-10-06 (see `../2026-10-06-claude-2.1.289-inputs-first.md`): eleven headless runs of the inputs-first rule and the lead's data inventory, before and after, on data-poor prompts and a data-rich control. |
| `data/assertions-iteration-1.json`, `data/assertions-iteration-2.json`, `data/assertions-iteration-3.json` | The assertions, written from each eval's `expected_output` (iteration 3: from the intended behaviour) before any without-skill or after answer was read. |
| `data/iteration-1/<skill>/eval-<id>/{with_skill,without_skill}/` | `grading.json` (each assertion, passed or not, with its evidence), `timing.json` (tokens, time, cost, which skills loaded or were refused) and `outputs/answer.md`. Same layout for `data/iteration-2/`; `data/iteration-3/<prompt>/<before|after-v1|after-v2>/` for the follow-up. |
| `data/benchmark-iteration-1.json`, `data/benchmark-iteration-2.json` | Pass rate, tokens, time and cost per skill; the assertions that passed in both configurations and the ones that failed in both. |
| `scripts/` | The scripts that produced them: `extract*.mjs` (read the host's session records), `benchmark*.mjs`, `review*.mjs`, `costs.mjs`, `run-headless.sh`. They have the paths of the machine of the run hard-coded (`C:/github/scratch-pilot/h8-workspace`) and the inputs they read (the raw answers, the prompts) are in the review pages. |

## How a run was made

1. A fresh scratch project with `agents add digital-agency -t claude --native --session-guard local -y`, `agents doctor --host claude` healthy.
2. Per prompt, a fresh session as the role that loads the skill: `claude --agent <role> --model sonnet --effort medium`, typed by the maintainer (iteration 1) or `claude -p ... --permission-mode auto --output-format json --max-budget-usd 0.8 < /dev/null` (iteration 2). The prompt is the eval's `prompt` verbatim.
3. The no-skill configuration: in iteration 1 `skillOverrides` with the skill set to `"off"`; in iteration 2 the skill's folder deleted from a scratch copy. The override refuses the `Skill` call but does not stop a `Read` of the folder, so the deletion is the clean baseline.
4. Grading: each assertion passes only with concrete evidence quoted from the answer or from a file the run wrote.
5. Roles that write into the project (`docs/cro/...`) leave files behind; move them out before the next run of the same project.

## Limits

One run per configuration: the run-to-run noise measured here is about one assertion. Eval prompts of `seo-audit` eval 1 and the new `conversion-funnel-optimization` eval 4 changed between iterations, so those scores are not comparable with iteration 1.
