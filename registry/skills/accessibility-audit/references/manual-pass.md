# The manual pass: keyboard, names, structure, colour, motion and zoom

Do this after the automated pass, on every distinct page state. Write each result into the findings table; a check you did not do goes into "not checked".

## Keyboard (no mouse)

- [ ] Tab through the whole journey: every control is reachable.
- [ ] The tab order follows the visual and reading order.
- [ ] Focus is always visible.
- [ ] No keyboard trap anywhere.
- [ ] Escape closes dialogs and returns focus to the trigger.
- [ ] No content opens on hover only.

## Names and structure

- [ ] Each control has an accessible name that says what it does (not "click here").
- [ ] Form fields have labels (a placeholder is not a label).
- [ ] Errors are tied to their fields and announced.
- [ ] Headings form an outline without skipped meaningful levels.
- [ ] Landmarks exist.
- [ ] Images carry useful alt text or are marked decorative.

## Colour and motion

- [ ] Text contrast is at least 4.5 to 1; large text and interface boundaries at least 3 to 1. Measure each pair with `scripts/contrast.mjs` (or the formula) and write down the ratio.
- [ ] Information is not conveyed by colour alone.
- [ ] Animation respects the reduced-motion setting.
- [ ] Nothing flashes more than three times a second.
- [ ] Text over an image or gradient needs a scrim, and the worst region is the one measured.

## Zoom and reflow

- [ ] At 200 percent text size, and at 320 CSS pixels wide, content stays readable and operable (see `responsive-design-audit`).

## What automation cannot see

Axe does not judge whether alt text is meaningful, whether the reading order makes sense, or how a screen reader announces a custom widget. If no screen reader was run, the report says so.
