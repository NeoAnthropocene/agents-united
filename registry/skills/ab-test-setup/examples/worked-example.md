# Worked examples (invented numbers, for checking your own arithmetic)

## A feasible test

Pricing page, 1,500 eligible visitors a day, baseline paid-plan click rate 4.0 percent (last 28 days). The team hopes for 20 percent relative, so d = 0.008.

n = 16 x 0.04 x 0.96 / 0.008 squared = 0.6144 / 0.000064 = **9,600 per arm**, 19,200 in total. 19,200 / 1,500 = 12.8 days, so run **14 days**. Stopping rule: stop at 14 days or 9,600 per arm, whichever is later. Decision rule: ship if the variant is higher, the interval excludes zero and the guardrail (refund requests) did not rise by more than 5 percent relative.

Check: `node scripts/sample-size.mjs --baseline 0.04 --lift 0.20 --daily 1500` prints 9600 and 14 days.

## An infeasible test

A page with a 1.0 percent baseline and a hoped-for 10 percent relative lift: d = 0.001, n = 16 x 0.0099 / 0.000001 = **158,400 per arm**, which is 217 days at the same traffic. Not feasible: make the change bolder, or test a metric earlier in the funnel.

## A sample-ratio mismatch

Planned 50/50, observed 10,300 against 9,700 at day 3 (total 20,000, expected 10,000 each). Chi-square = 300 squared / 10,000 + 300 squared / 10,000 = 18, above the 10.83 cut-off for p = 0.001. **Stop and investigate**; do not read the result.

Check: `node scripts/srm-check.mjs 10300 9700` prints "chi-square 18.00: invalid".
