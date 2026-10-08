# Claude Design token format

Claude Design (claude.ai/design and `/design`) reads a design system's tokens as **lists** of name, value and usage. Given the nested `$value` objects of `design-tokens.json`, its page shows a family empty. When the tokens are to go into Claude Design, write a second file, `claude-design-tokens.json`, next to `design-tokens.json`, by the rules below. `design-tokens.json` stays the source: derive the second file again after every change and never edit it by hand. You have no shell, so write it with `Write`, or list the conversion under `Open items` for the lead.

## The mapping

| In `design-tokens.json` | In `claude-design-tokens.json` |
|---|---|
| `color.<group>.<step>` | `color.tokens[]`: `name` is `<group>-<step>` (the word `color` is dropped), `value` the colour |
| `color.<role>.<name>` with an alias `{color.a.b}` | `name` is `<role>-<name>`, `value` is `{a-b}`: the flattened name of the target, which must be a colour token |
| `space.<n>` and `radius.<n>` | `spacing.tokens[]` with `name` `space-<n>`, `radius.tokens[]` with `name` `radius-<n>`; `value` as written |
| `font.family.<n>` | `type.families.<n>`, the family stack as a string |
| `font.size.<n>`, `font.weight.<n>`, `font.line-height.<n>` | one style `{name, fontSize, fontWeight, lineHeight}` in `type.groups[0].styles`, `name` is `<n>`; a weight or a line height needs a size with the same `<n>` |
| `$description` | `usage`, an empty string when there is none: list those tokens under `Open items` |
| anything else, such as `shadow.<n>` | its own family `{"tokens": [...]}` with `name` `shadow-<n>` |
| a dark theme | not converted here: the file has one theme, `light` |

## What the page drops
- A name outside `[A-Za-z0-9][A-Za-z0-9_.-]{0,63}`, or a name used twice across the families (only `type` is exempt).
- A colour that is not hex (`#rgb`, `#rrggbb`, alpha too), `rgb()`, `rgba()`, `hsl()` or `oklch()` with no function inside, or an alias of a colour token that exists. Named colours, `var()` and `color-mix()` are dropped.
- A length that is not a number, or a number in `px`, `rem`, `em` or `%`.

## Two worked examples
The first is the colour example of this skill ([examples/worked-example.md](../examples/worked-example.md)) converted:

```json
{
  "name": "Worked example",
  "version": 1,
  "color": {
    "themes": [{"id":"light","name":"Light"}],
    "tokens": [
      { "name": "blue-700", "value": "#1D4ED8", "usage": "" },
      { "name": "amber-500", "value": "#F59E0B", "usage": "" },
      { "name": "amber-700", "value": "#B45309", "usage": "" },
      { "name": "gray-500", "value": "#6B7280", "usage": "" },
      { "name": "gray-900", "value": "#111827", "usage": "" },
      { "name": "text-default", "value": "{gray-900}", "usage": "" },
      {
        "name": "text-muted",
        "value": "{gray-500}",
        "usage": "white surfaces only; use gray.600 on gray.100"
      },
      { "name": "action-primary", "value": "{blue-700}", "usage": "" },
      { "name": "accent-fill", "value": "{amber-500}", "usage": "fill only, label with text.default" }
    ]
  }
}
```

The second starts from a set with spacing, radius, type and a shadow:

```json
{
  "space": {
    "1": { "$value": "8px", "$type": "dimension" },
    "2": { "$value": "16px", "$type": "dimension", "$description": "gap between a label and its field" }
  },
  "radius": { "md": { "$value": "12px", "$type": "dimension" }},
  "font": {
    "family": { "base": { "$value": "Inter, system-ui, sans-serif", "$type": "fontFamily" }},
    "size": {
      "body": { "$value": "16px", "$type": "dimension" },
      "headline": { "$value": "40px", "$type": "dimension" }
    },
    "weight": { "headline": { "$value": 700, "$type": "fontWeight" }},
    "line-height": { "body": { "$value": "24px", "$type": "dimension" }}
  },
  "shadow": { "card": { "$value": "0 1px 3px rgba(0,0,0,0.2)", "$type": "shadow" }}
}
```

and becomes:

```json
{
  "name": "Spacing and type example",
  "version": 1,
  "color": { "themes": [ { "id": "light", "name": "Light" } ], "tokens": []},
  "type": {
    "fonts": [],
    "families": { "base": "Inter, system-ui, sans-serif" },
    "groups": [
      {
        "name": "Text",
        "family": "base",
        "styles": [
          { "name": "body", "fontSize": "16px", "lineHeight": "24px" },
          { "name": "headline", "fontSize": "40px", "fontWeight": 700}
        ]
      }
    ]
  },
  "spacing": {
    "tokens": [
      { "name": "space-1", "value": "8px", "usage": "" },
      { "name": "space-2", "value": "16px", "usage": "gap between a label and its field" }
    ]
  },
  "radius": { "tokens": [ { "name": "radius-md", "value": "12px", "usage": "" } ]},
  "shadow": { "tokens": [ { "name": "shadow-card", "value": "0 1px 3px rgba(0,0,0,0.2)", "usage": "" } ]}
}
```
