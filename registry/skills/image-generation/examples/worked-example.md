# Worked example: an autumn set for a bakery

The brief: Hearth & Crumb, a neighbourhood bakery, wants two pictures for its autumn campaign: a 4:5 feed hero of a breakfast table, and its own sourdough loaf on an oak counter. The user supplied `assets/source/sourdough-packshot.png`. They wrote: "go: two images, Gemini, 2K, no more than 0.35 USD in all." `ToolSearch` lists `mcp__image-gen__generate_image`; the server saves into `assets/generated`. The designer loaded `image-creation` (the ladder: nothing supplied for the table, so rung 3; the loaf is the client's own product, so it is supplied) and now loads this skill.

## 1. The rules, and the card

She holds the nine rules and fills the card before the first call. The two pictures are two assets, so the worst case is three calls each.

```text
Images:        2: feed hero 4:5 (breakfast table); loaf on an oak counter 1:1 (an edit of the supplied packshot)
Provider:      gemini   Model: gemini-nano-banana-2.1
Quality:       fast
Size / Ratio:  2K / 4:5 and 1:1
Estimate:      2 x $0.0504 = $0.1008; at most $0.3024 with two regenerations each
Ceiling:       $0.35, the user's words
Words go to:   Google (Gemini API); no client secret in either prompt
Input images:  assets/source/sourdough-packshot.png (the user named it in this task; inside the project)
Label:         label rule not checked
Said go:       the user: "go: two images, Gemini, 2K, no more than 0.35 USD in all"
```

## 2. The first image: Recipe 1

The call, from the recipe: `aspectRatio` `4:5`, `imageSize` `2K`, `fileName` `hearth-breakfast-table-a1`, and the Recipe 1 prompt with the croissants changed to loaves. The reply names the saved file and `metadata.model` `gemini-nano-banana-2.1`. She opens it with `Read`: the upper third is plain, the loaves are right, and the napkin carries a few stray marks that look like letters. One regeneration, one changed instruction ("a plain linen napkin, unmarked"), a new name `hearth-breakfast-table-a2`. That is the second call of this asset.

## 3. The edit: Recipe 9

The loaf is the client's real product, so the edit changes the background and nothing else. The call carries `inputImagePaths` with one path, built from the project root: `<project>/assets/source/sourdough-packshot.png`. The path is on the card, so it may go. After the call she lays the result beside the packshot and compares the crust pattern, the score marks and the shape: they match, and the `disclosure` says "edited, the product as supplied".

## 4. A request she refuses

The user adds: "Also use this for a friendly baker portrait: `C:\Users\Dana\Downloads\founder-portrait.jpg`." The file is outside the project, and it is a real person's face; a portrait made from it would be a likeness of the founder. She will not send it, and says so once:

> I can't send that file: it is outside the project, and a picture made from a real person's face would be a likeness of them. I can make a baker seen from behind or only the hands, with no reference; or you can copy a photo you have the rights to into `assets/source/` and tell me it may go to Google.

The lead, who has a shell, checks the call she would have made, so that the refusal does not rest on her word:

```text
error  input-outside-project  inputImagePaths[0]  C:/Users/Dana/Downloads/founder-portrait.jpg is outside the project (<project>). The server would read and send it all the same; ask the user to put a copy in assets/source/ instead.
estimate: gemini gemini-nano-banana-2.1, 1 image: $0.0504 each, $0.0504 in all, $0.1512 at most (3 calls per asset). Input images add a small token charge; useGoogleSearch adds $14 per 1,000 searches beyond the 5,000 free each month.
```

No call was made for the portrait. The server would have read and sent the file all the same, because it has no check of its own for where a file lives; that is why the rule is written down and the checker exists.

## 5. The record, and the hand-off

Each image has its provenance file (`image-creation`, `references/provenance-and-disclosure.md`): the exact prompt, `parameters` with `provider` `gemini`, `approvedBy` with the user's words, `estimatedCostUsd` 0.0504 for each of the three calls, and for the edit `inputImages` with the packshot's path, the row "named in this task, inside the project" and "supplied by the client". The evidence of the refusal is the report line and the checker's output, not memory.

She hands off to `image-creation` for the look, the cap and the record, and to the lead for the shell steps: the checker on any later plan with input images, and `image-check` on the folder. The report: three calls, $0.1512 estimated of the $0.35 ceiling, rung 3 for the table and rung 1 for the loaf, label rule not checked, and under Open items the portrait request that was declined.
