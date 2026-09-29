# Editing Source Code, Catalogs & Rendered Applications

In-house adaptation, credited to
[ui-skills.com/skills/mrstev3n/balise-ux-writing](https://www.ui-skills.com/skills/mrstev3n/balise-ux-writing)
(Apache-2.0 source: `github.com/mrstev3n/balise-skills`).

Read this before Implement-mode edits that touch source code, localization catalogs, component
stories, content schemas, or a rendered application.

## Before editing
1. Locate the canonical source of truth for the string — a localization catalog key, a content
   schema entry, or a component's own prop — never a compiled/generated/duplicated copy of it.
2. Check for existing usages of the same key/string across the codebase; a single string may be
   shared by more than one surface, so a change can have a wider blast radius than the one screen
   that prompted it.
3. Note formatter/pluralization use (`Intl.PluralRules`, ICU `{count, plural, ...}`, a custom
   i18n library's syntax) so the edit doesn't break parsing.

## While editing
- Change wording only — do not mix substantive copy changes with unrelated refactoring in the same
  edit.
- Preserve keys, schemas, semantic attributes, and any surrounding code structure.
- If a string must move to a new key (e.g. splitting a combined string for correct pluralization),
  say so explicitly and update every call site — don't leave an orphaned old key silently unused.

## After editing
- Run whatever lint/type/build/localization/component/browser tests the project already has for
  copy/content changes — this skill does not invent a new test suite, it runs the existing one.
- Confirm no unrelated file, layer, binding, or visual property changed as a side effect.
- Render the affected state when a runnable interface is available, to catch truncation/overlap
  that a static read of the source can't reveal.
