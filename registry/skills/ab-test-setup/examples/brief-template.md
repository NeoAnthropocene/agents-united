# Experiment brief template

Copy this block, fill every line, leave none blank.

```text
EXPERIMENT   <id> <name>
HYPOTHESIS   Because <evidence>, <change> will move <metric> by <amount>
PRIMARY      <numerator> / <denominator> within <window>
GUARDRAIL    <metric> must not worsen by more than <x>
MDE          <abs> absolute (<rel> relative)   N per arm <n>   RUN <days> days
UNIT/SPLIT   <user|account|session>  50/50
STOP         fixed sample or date, whichever is later; no peeking
DECIDE       ship if ...; kill if ...; otherwise iterate once
CHECKS       assignment sticky; event fires in both arms; SRM at day 3 and at the end
ESTIMATES    figures computed by hand from <source, date range>, not from a calculator
OWNERS       build <Deniz>  verify <Emre>  copy <Kaan>  consent <Defne>
```
