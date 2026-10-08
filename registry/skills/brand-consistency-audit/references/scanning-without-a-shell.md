# Scanning without a shell

A role with `Grep` and `Glob` can do what `scripts/audit-assets.mjs` does, slower and by hand. The patterns below are for the `Grep` tool (ripgrep: no look-around). Use `output_mode: content` with `-n` for line numbers and `-o` to print only the matched part.

## The token set first

Read the tokens file and write out the list you will compare against: every colour as an upper-case six-digit hex, and the first font of each family. Turn an `rgb()` you meet into hex channel by channel before comparing (`rgb(243, 217, 177)` is `#F3D9B1`). Leave an `hsl()` to the script, or list it under not checked.

## Patterns

| Looking for | Pattern | Then |
|---|---|---|
| Hex colours | `#[0-9a-fA-F]{3,8}\b` | Drop link targets and ids (`href="#add"`, `id="#fee"`) and entities (`&#39;`); expand `#fff` to `#FFFFFF`; compare with the list |
| Functional colours | `rgba?\([^)]*\)` and `hsla?\([^)]*\)` | Convert; a translucent token is on brand, and its contrast is measured on the composite |
| Named colours | `(color\|background\|border\|fill\|stroke)[^;"}]*\b(white\|black\|red\|green\|blue\|gray\|grey\|orange\|yellow\|purple\|pink)\b` | Each is a finding unless a token holds that colour |
| Fonts | `font-family[^;"}]*` | The first name of each value against the tokens' first font |
| Font sizes | `font-size\s*[:=]\s*"?[0-9.]+(px\|rem\|em)` | Against the token sizes; a prototype may scale them on purpose: say so |
| A stretched logo | `scale\([^)]*\)` and `preserveAspectRatio="none"` | Two different scale factors, or `none`, distort the mark |
| A string from the copy | The string itself, with `-c` | Zero matches in the assets means the copy is missing or changed |
| Visible strings | `>[^<>{}]*[A-Za-z][^<>{}]*<` with `-o` | Each against the copy file; placeholders such as `[Photo: ...]` are listed, not counted as copy |

## Count from the output

List the unique values with their file and line in your notes, subtract the token list, and write the findings from what is left. Report "16 colours read, 4 not tokens", where 16 is the length of your list. Do not report a count you did not list.

## What a scan cannot see

Colours inside a raster image, values a script builds at run time, an inline style set by a framework, a font that the machine substitutes, the logo's clear space. Put each under "not checked", or look at it: `Read` an image (a downscaled copy hides small text and thin lines: say so) or ask the lead for a render.
