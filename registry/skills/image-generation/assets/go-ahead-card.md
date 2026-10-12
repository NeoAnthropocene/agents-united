# The go-ahead card

Fill one in before the first call of a go, put it in your message to the user or the lead, and keep it in the report. A go covers what the card says and nothing else: a different provider, a larger size, more images or another input file is a new card and a new go.

```text
Images:        <how many, and for which placements>
Provider:      <gemini | openai | seedream>   Model: <from references/providers.md>
Quality:       <fast | balanced | quality>
Size / Ratio:  <1K | 2K | 4K> / <the aspect ratio of each placement>
Estimate:      <N images x $price = $total; at most $worst case with two regenerations each>
               (OpenAI: no published price; the first image is a probe, and the user sets the ceiling after reading its charge)
Ceiling:       <the most the user lets this go cost, in dollars, in their words>
Words go to:   <Google (Gemini API) | OpenAI | BytePlus (ModelArk)>; no client secret, personal data or unreleased detail in them
Input images:  <none | each path, the row of references/input-images-and-paths.md that allows it, and who cleared the rights>
Label:         <the label the placement requires | label rule not checked>
Said go:       <who, and their words>
```

How to fill it:

- **Estimate.** Gemini and Seedream: the number of images times the price at the size, from `references/providers.md`; the worst case is three calls per asset. `node ${CLAUDE_SKILL_DIR}/scripts/call-check.mjs <call.json> --images <n>` prints both.
- **Ceiling.** If the user gave none, ask for one. A go without a ceiling is not yet a go for a paid provider.
- **Input images.** Every path appears here or the call carries no `inputImagePaths`. A path that is not on the card does not go.
- **Said go.** Quote it. The same words go into `approvedBy` of each provenance file.
