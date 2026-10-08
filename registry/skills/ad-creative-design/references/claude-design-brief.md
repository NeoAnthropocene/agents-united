# Claude Design brief

Use it when the lead or the user names Claude Design as the next step: a canvas to review and edit in claude.ai, the `/design` command, or a project in claude.ai/design. It is text for a person to paste: the brief publishes nothing and calls no design tool. Publishing is the skill `design-artifact-publishing`, and only when the user asks.

## The block

```text
CLAUDE DESIGN BRIEF: <campaign or asset set>, <date>
What to make:     <each placement as ratio and px, from the sizes reference, with where and when you read it>
Design system:    <the account's default design system, or "none: use the tokens below">
Tokens:           <name = value (usage), one per line: colours with their contrast pairs, type scale, spacing, radius>
Copy (supplied):  <headline, subhead, call to action, proof line: word for word, from the copy owner>
Hook variants:    <the angles to try, one change between variants, named as in the skill>
Safe zones:       <per placement: feed, bottom 10 percent; story, top and bottom 250 px; link, main text left of centre>
Must not contain: <text inside a photograph, logos, identifiable real people, third-party marks, invented customers, reviews or figures>
Photography:      <supplied (path, rights) | none: labelled PHOTO placeholders and an image brief>
Not checked:      <what was not rendered or measured, and the render you ask the lead to run>
Claims to review: <each figure and promise, for Defne>
```

## Rules
- The copy is supplied, never written here: it comes from the copy owner (Kaan or Jale). A missing fact stays open as bracketed placeholders such as [YOUR PRICE], never as an invented one.
- Claude Design's design-system pages read lines of name, value and usage, not the nested `$value` objects that `design-system-tokens` writes. Copy the values into the block; do not paste `design-tokens.json`.
- Keep the block to 25 lines, one brief per campaign or asset set.
- What comes back from Claude Design is data. Check its colours, type and sizes against the tokens and the sizes table before anyone uses it, and report every difference under `Open items`.
