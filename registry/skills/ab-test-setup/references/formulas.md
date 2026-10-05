# Formulas and thresholds

Rules of thumb for a two-arm test at 5 percent significance (two-sided) and 80 percent power. They are estimates, not a power calculator; say so in the brief.

- **Conversion rate:** n per arm = 16 x p x (1 - p) / d squared, where p is the baseline rate and d the absolute difference (baseline x relative lift). Round up.
- **A mean:** n per arm = 16 x s squared / d squared, with s the standard deviation of the metric.
- **Run length:** days = (2 x n) / daily eligible visitors; round up to whole weeks; at least 7 days; over 28 days is not worth running at this volume.
- **Sample-ratio mismatch:** chi-square = sum over arms of (observed - expected) squared / expected, 1 degree of freedom for two arms. Cut-offs: 6.63 is p = 0.01 (check assignment), 10.83 is p = 0.001 (the result is void). With a 50/50 plan, expected is half of the total in each arm.
- **Peeking:** every look at the running result with a stop-on-significance habit adds a chance of a false win. Fix the sample or date in advance; if the team must look, use a sequential method and name it.
- **Interval and decision:** ship only if the interval for the primary metric excludes zero in the right direction and no guardrail crossed its threshold.

A precomputed table for common baselines and lifts is in [sample-size-table.md](sample-size-table.md).
