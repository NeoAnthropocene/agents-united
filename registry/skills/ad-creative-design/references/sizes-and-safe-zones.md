# Sizes, safe zones, contrast and naming

## Typical sizes (verify before export)

These are **typical** sizes. Verify each against the platform's current specification before export, and write down where and when you read it: platforms change them.

| Placement | Size | Safe zone and notes |
|---|---|---|
| Feed, square | 1080 x 1080 | keep text inside the central 80 percent |
| Feed, portrait | 1080 x 1350 | keep text clear of the bottom 10 percent for the caption overlay |
| Story or vertical video | 1080 x 1920 | no text in the top 250 px or bottom 250 px |
| Professional network single image | 1200 x 628 | main text left of centre, logo small |
| Display banners | 300 x 250, 728 x 90, 160 x 600 | one line of text, large call to action |

Design for the crop: key text and the product inside the safe zone, the top and bottom of vertical formats free of text, and the smallest size tested first.

## Contrast and legibility

- Body text at least 4.5 to 1 against its background; large text at least 3 to 1.
- Text over an image sits on a solid or gradient scrim.
- Nothing below about 24 px in a 1080-wide design.
- Illegible at the smallest size: shorten the line, not the font.

## Naming convention

`<campaign>_<angle>_<format>_<size>_v<n>`, for example `webhook-retries_proof_static_1080x1350_v2`. The same string goes into the ad name and `utm_content`, so results join back to the asset. A copy change after design renames the variant (`v2`) and retires the old one.
