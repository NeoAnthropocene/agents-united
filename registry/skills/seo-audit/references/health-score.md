# The health score: grades, the rule and a table

## Grades

| Severity | What it means |
|---|---|
| critical | blocks crawling, indexing or rendering of an important page |
| major | clearly loses visibility or clicks |
| minor | hygiene |

## The rule

Start at 100. Subtract 15 per critical finding, 7 per major finding and 2 per minor finding. The floor is 0.

The score is a summary of **this audit's scope**. It is not an industry metric, and two scores are not comparable across sites with a different scope or across tools with a different rule. Always state the rule and the scope next to the number.

With a shell: `node ${CLAUDE_SKILL_DIR}/scripts/health-score.mjs --critical 1 --major 2 --minor 1`, or point it at a findings table (it counts the rows whose severity cell is exactly critical, major or minor).

## The table, for the roles without a shell

The score for a number of criticals and majors, with no minor findings. Subtract 2 for each minor finding; if the result is below 0, the score is 0.

| Criticals | 0 majors | 1 major | 2 majors | 3 majors | 4 majors | 5 majors | 6 majors |
|---|---|---|---|---|---|---|---|
| 0 criticals | 100 | 93 | 86 | 79 | 72 | 65 | 58 |
| 1 critical | 85 | 78 | 71 | 64 | 57 | 50 | 43 |
| 2 criticals | 70 | 63 | 56 | 49 | 42 | 35 | 28 |
| 3 criticals | 55 | 48 | 41 | 34 | 27 | 20 | 13 |
| 4 criticals | 40 | 33 | 26 | 19 | 12 | 5 | 0 |
| 5 criticals | 25 | 18 | 11 | 4 | 0 | 0 | 0 |

Read it as: one critical, two majors and one minor is 71 minus 2, so **69**. The number matters less than the criticals it contains: a `noindex` on an important page is a critical finding at any score.
