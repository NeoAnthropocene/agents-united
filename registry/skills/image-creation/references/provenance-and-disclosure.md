# Provenance, disclosure and what never to generate

## The provenance file

One JSON file beside every generated image, named like the image with `.provenance.json` for its extension (`petpal-hero-sofa-a2.png` has `petpal-hero-sofa-a2.provenance.json`). You write it with `Write`; it is the record of what was asked, by whom, and what it cost. [../assets/provenance-template.json](../assets/provenance-template.json) is the form.

| Field | What goes in it |
|---|---|
| `file` | The saved file's name, from `resource.name` in the reply |
| `asset` | The asset's id, the same for every attempt at it (`petpal-hero-sofa`) |
| `attempt` | 1 for the first call, 2 and 3 for regenerations. A fourth image of one asset is a finding |
| `createdAt` | When the reply came, as an ISO time |
| `server` | `image-gen` and the package version the lead installed |
| `model` | `metadata.model` from the reply |
| `prompt` | The exact prompt sent, character for character |
| `parameters` | `provider` (`metadata.provider` in the reply; the server default when the reply has none), `aspectRatio` and `imageSize` as sent, and `quality` if you set it |
| `approvedBy` | Who said go, and their words ("the user: go, two images, 2K") |
| `estimatedCostUsd` | The price of this call at its size ([server-and-cost.md](server-and-cost.md)) |
| `disclosure` | What the image is and the label, if any, its placement requires (below) |

Optional: `inputImages` (for each input file: its path, the row of the table in `image-generation`, `references/input-images-and-paths.md`, that allowed it, and who cleared the rights), `usedIn` (the design files that place it), `notes` (what you saw when you opened it and what you would change). `measured` (width, height, bytes and SHA-256) is written by `scripts/image-check.mjs --stamp`, which the lead runs: you cannot measure a file.

A rejected attempt keeps its image and its file: the record of the attempts is how the cap is checked. Delete nothing.

## The label

Say in `disclosure` what the image is ("generated with Gemini", or "edited from the supplied packshot") and what label the placement needs. Several ad and social platforms ask for a label on generated or edited images; the rule is the platform's own rule, it differs and it changes, and you cannot read it from here. So: write the label the brief states; when the brief states none, write "label rule not checked" and put it under Open items for the lead or the user. Never write "no label required" without a source and a date.

Every image from the Gemini models carries an invisible SynthID watermark (Google's documentation). It helps detection; it is not a visible label and does not satisfy a platform that asks for one. The pages read for OpenAI and Seedream state no mark.

## Rights

What the user may do with the output is set by the terms of the provider that made it and the user's own account, not by this skill and not by you. Do not state a licence you have not read. Record where the image came from; the user answers for its use.

## Never generate

- a real person, a public figure or a lookalike;
- a customer, reviewer, endorser, expert or staff member, as a face beside a name or a quote;
- the client's real product, a real place that must be recognisable, or a result that a buyer would take for a claim;
- a logo, a mark, or any third party's brand or trademark;
- a screenshot, an interface, a chart or a diagram: they must be exact, so write them in SVG or HTML;
- any text, number or slogan: it is an overlay.

When a brief asks for one of these, say which rung it belongs on (usually 1, 2 or 4) and offer the placeholder and the image brief.

## What to report

For each image: the file, its rung and why, the number of calls (and the cost estimate), the label need or "label rule not checked", and what you saw when you opened it, including what a downscaled copy could not show. For the set: the total of calls and the estimated cost, and the step that needs a shell (`image-check --stamp`).

The evidence is the provenance files, not memory: they show that a go-ahead came first, that the recorded prompt is the prompt sent, and how many calls each asset took. Cite them.

The hand-offs: the shell step goes to the lead, the label rule to the lead or the user, and a request for any subject in the never-generate list goes back to the user with a placeholder and its image brief.
