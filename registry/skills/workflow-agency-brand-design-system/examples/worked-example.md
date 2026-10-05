# Worked example (an invented brief, for checking your own work)

A scheduling tool whose primary blue `#1D4ED8` and accent amber `#F59E0B` are given.

## The delegation map

```text
S1 Jamileh  identity + tokens   out: design/design-tokens.json   evidence: amber fails as text on white (2.15), so amber is a fill with a dark label; text amber is a derived darker step (5.02)
S1 Kaan     voice guide         out: brand/voice.md              evidence: from 12 real samples supplied by the client
S2 Jamileh  component specs     out: design/components/*.md      evidence: states table per component
S3 Deniz    theme + components  out: src/styles/theme, src/components/ui   evidence: build output; grep shows no raw hex in components
S4 Emre     contrast + keyboard out: qa/system-gate.md           evidence: axe results, tab path, viewport matrix
S4 Defne    licences            out: compliance/assets.md        evidence: font licence, image sources
```

## How to read it

The two brand colours are given and untouched; the amber that carries text is a derived step (5.02 to 1 on white) and the brand amber (2.15 to 1) is a fill with a dark label. The token file is the contract, so S3 starts only when it has been read back; S4 verifies the built result and Defne checks the licences.
