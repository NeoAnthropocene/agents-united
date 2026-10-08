# Where colour breaks: dark mode, photographs, gradients, colour vision, print

## Dark mode is a second palette, not an inversion

- **Ground:** a near-black tinted to the brand hue (OKLCH lightness 0.15 to 0.25), not pure black. Raised surfaces are lighter, not darker: height reads as light.
- **Text:** off-white (lightness 0.93 to 0.97), not pure white. Muted text is a step down and still meets 4.5 to 1.
- **Accents:** lighten and soften. A brand step 600 that is right on a light ground usually loses contrast on a dark one. Take step 400 (on a 950 ground it clears 4.5 to 1 for every family of [hue-families.md](hue-families.md)) and re-check the label on it: white on a light accent usually fails, so the label turns dark.
- **Borders and dividers:** a few steps lighter than the ground; 3 to 1 where they must be seen.
- **Semantic colours** need their own dark steps; do not reuse the light ones.
- **Re-measure every pair.** [The worked example](../examples/worked-example.md) has a button whose label flips from white to dark.

## Text on a photograph

- Measure the worst patch behind each line, not the average (see [contrast.md](contrast.md)).
- A scrim is a gradient or a flat layer between photograph and text. Choose its colour from the ground or the darkest brand neutral, not pure black; state its opacity; compute the ratio against the composited result.
- A solid panel behind the text beats a scrim when the photograph is busy.
- Keep the face, the product and the mark out from under the scrim; keep the text inside the safe zone of the placement (`ad-creative-design`).

## Gradients

- Interpolate in OKLCH where the medium allows it (in CSS, `linear-gradient(in oklch, A, B)`). Mixing complementary colours in sRGB passes through a grey middle. SVG gradients interpolate in sRGB: add a middle stop at the OKLCH midpoint to keep the colour alive.
- Check contrast at both ends and the middle for any text over it.
- Large smooth gradients band on some screens: use fewer, wider colour changes or a trace of noise.

## Colour vision

- About one man in twelve and one woman in two hundred have a red-green deficiency (figures for people of Northern European descent; rarer elsewhere). Blue-yellow deficiency and total colour blindness are rarer.
- Do not use red against green, brown against green or orange against green as the only signal. Blue against orange separates for most readers.
- Separate by lightness first, then add an icon, a word, a pattern or a position.
- A grey-scale view is a cheap test: states that turn into one grey are one state to some readers. It is not a simulation: say "not simulated" in the report.

## Print

- Screens show colours that CMYK cannot: saturated blues, greens and oranges come out duller in print. Convert, then look at a proof; never trust the screen.
- Give CMYK or spot (Pantone) values only when the brand supplies them. Do not convert a brand colour by guess.
- Small text in print is best in one ink (black) to avoid a registration fringe; the printer's specification wins.
- Paper changes colour: uncoated stock dulls everything. Ask for a proof on the real stock.
