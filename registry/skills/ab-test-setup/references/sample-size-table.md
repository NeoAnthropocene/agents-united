# Sample size per arm

Two arms, 5 percent significance, 80 percent power, n = 16 x p x (1 - p) / d squared with d = baseline x relative lift (see [formulas.md](formulas.md)). Rounded up; **estimates**. Divide twice the figure by the daily eligible visitors to get the days.

| Baseline | +5% relative | +10% relative | +20% relative | +30% relative | +50% relative |
|---|---|---|---|---|---|
| 1% | 633,600 | 158,400 | 39,600 | 17,600 | 6,336 |
| 2% | 313,600 | 78,400 | 19,600 | 8,712 | 3,136 |
| 3% | 206,934 | 51,734 | 12,934 | 5,749 | 2,070 |
| 5% | 121,600 | 30,400 | 7,600 | 3,378 | 1,216 |
| 10% | 57,600 | 14,400 | 3,600 | 1,600 | 576 |
| 20% | 25,600 | 6,400 | 1,600 | 712 | 256 |
| 30% | 14,934 | 3,734 | 934 | 415 | 150 |
| 50% | 6,400 | 1,600 | 400 | 178 | 64 |

Read it as: a 4 percent baseline is between the 3 and 5 percent rows; for a +20% lift that is about 7,600 to 12,900 per arm, and the script gives the exact 9,600. A cell above what two weeks of traffic can supply means the test is not feasible as designed.
