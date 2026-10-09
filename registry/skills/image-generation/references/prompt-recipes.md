# Prompt recipes: sixteen cases, each a call and a prompt

Pick the recipe nearest to the brief, change the nouns and keep the structure. A good prompt has the same parts every time: a subject, a setting, the light, the camera, the composition (where the subject sits and what is empty), the copy zone, and the palette in words. The parts, and why each is there, are in `image-creation` (`references/prompting.md`). Four habits hold for every recipe:

- **Say what you want, not what you do not.** "An even, plain cream wall" instead of "no clutter". The model draws what it reads.
- **No text, logo, brand name or real person in the prompt.** Text is an overlay on a clear region. (Recipe 15 is the marked exception.)
- **Write the whole prompt.** The install turns the server's own rewriting off, so `purpose`, `blendImages` and `maintainCharacterConsistency` do nothing: what they would add goes into the sentences.
- **Every call is a go.** The **Call** block shows the arguments; `provider` and `quality` appear only where a recipe needs them, because they are set only when the go names them. Paths are written from the project root (`<project>`).

Every call below passes `scripts/call-check.mjs`, and a test keeps it so.

### Recipe 1: a scene with a copy zone (a feed ad, 4:5)

**When**: a feed ad needs a warm scene, and the headline will sit in the upper third.

**Call**:

```json
{
  "prompt": "(the prompt below)",
  "aspectRatio": "4:5",
  "imageSize": "2K",
  "fileName": "bakery-breakfast-table-a1"
}
```

**Prompt**:

```text
A photograph of a breakfast table in soft morning light: a wooden board with two warm croissants, a small jug of milk, a ceramic cup of coffee and a linen napkin, seen from slightly above and in front. Window light from the left, gentle long shadows, a shallow depth of field with the croissants in focus. The table fills the lower two thirds of the frame; the upper third is an even, plain cream wall with nothing on it. Palette: cream, warm sand and one muted terracotta cup. Natural and unposed, shot on a 50mm lens.
```

**Check**: the upper third is plain (the copy zone); the croissants have believable shapes; the napkin and the cup carry no stray lettering; the palette matches the tokens; say what a downscaled copy hid (crumb, grain).

**Pitfall**: writing "leave room for the headline". The model may draw something there. Describe the plain wall instead.

### Recipe 2: a wide banner with room for a headline (16:9 or 21:9)

**When**: a site hero or a banner is much wider than tall and the text sits on one side.

**Call**:

```json
{
  "prompt": "(the prompt below)",
  "aspectRatio": "21:9",
  "imageSize": "2K",
  "fileName": "trail-banner-ridge-a1"
}
```

**Prompt**:

```text
A wide photograph of a hiking ridge at sunrise: a narrow dirt path running from the lower right toward a distant blue valley, low golden light from the right, long soft shadows, a thin layer of mist lying in the valley. The path and the ridge line occupy the right two thirds of the frame; the left third is open sky, a smooth gradient from pale peach to light blue. Shot on a 35mm lens at standing height with deep focus. Natural colours, calm and spacious.
```

**Check**: the left third is smooth enough for the headline (measure the contrast of the real text over it with `color-theory`); the horizon is level; the ratio came back as asked (the lead's `image-check`).

**Pitfall**: 1.91:1 is not offered. Ask 16:9 and crop. A 21:9 cropped to 16:9 loses its sides, so decide where the subject sits before you crop.

### Recipe 3: a story with the top third clear (9:16)

**When**: a story or a reel cover where the platform's interface covers the top and the bottom.

**Call**:

```json
{
  "prompt": "(the prompt below)",
  "aspectRatio": "9:16",
  "imageSize": "2K",
  "fileName": "market-story-fruit-a1"
}
```

**Prompt**:

```text
A photograph of a fruit stall at a morning market, seen at eye level: crates of oranges and green pears in the lower half of the frame, a hand-painted wooden shelf behind them, soft overcast light, a shallow depth of field with the nearest crate in focus. The top third of the frame is an out-of-focus, even blue-green awning with nothing on it. The bottom tenth is dark wood, calm enough to carry a button. Colours: orange, green and warm wood. A documentary feel, shot on a 35mm lens.
```

**Check**: the top third is clear and the bottom tenth is calm; the subject sits clear of the interface zones in `ad-creative-design`; no lettering on the crates.

**Pitfall**: cropping the feed picture into 9:16. A story needs the subject low and the top clear: generate it on its own (Recipe 13).

### Recipe 4: food for a recipe or a menu (4:5)

**When**: a recipe card, a menu or a food story needs an appetising picture.

**Call**:

```json
{
  "prompt": "(the prompt below)",
  "quality": "balanced",
  "aspectRatio": "4:5",
  "imageSize": "2K",
  "fileName": "soup-recipe-card-a1"
}
```

**Prompt**:

```text
A photograph of a bowl of tomato soup on a dark slate table, shot from a 45-degree angle: a swirl of cream on the surface, three torn basil leaves, a few drops of olive oil and soft steam rising. A wooden spoon rests on the right edge of the bowl and a slice of toasted bread lies in the blurred background. Warm side light from the left, a shallow depth of field with the surface of the soup in sharp focus. The bowl sits in the lower two thirds of the frame; the upper third is plain dark slate. Appetising, real and slightly rustic, with glossy highlights.
```

**Check**: the soup looks edible and the steam is steam; the spoon and the bread are plausible; the slate has no lettering.

**Pitfall**: presenting the picture as the restaurant's own dish. A generated dish is a mood, not the client's product (rule 2): the real dish is photographed. Label it as generated.

### Recipe 5: an interior mood scene (3:2)

**When**: a page about calm, home or reading needs a room that feels like one.

**Call**:

```json
{
  "prompt": "(the prompt below)",
  "aspectRatio": "3:2",
  "imageSize": "2K",
  "fileName": "reading-corner-interior-a1"
}
```

**Prompt**:

```text
A photograph of a quiet reading corner in a bright apartment: a pale oak armchair with a wool throw, a low walnut side table with a stack of three books and a glass of water, a tall plant in a clay pot, and a window with sheer white curtains on the left. Soft diffused daylight and calm shadows; the colours are cream, oak and sage green. Shot on a 28mm lens from the doorway at chest height, deep focus, straight vertical lines. The chair sits slightly right of centre; the wall above the table is plain light plaster.
```

**Check**: vertical lines are straight; the chair has the right number of legs; the spines of the books carry no readable lettering; the plant is plausible.

**Pitfall**: using a generated room for a property listing or a hotel page. The real place must be recognisable, so it is the real photograph (rung 1) or a placeholder.

### Recipe 6: a texture or background for cards (1:1)

**When**: a card, a quote block or a hero needs a calm surface to carry text.

**Call**:

```json
{
  "prompt": "(the prompt below)",
  "aspectRatio": "1:1",
  "imageSize": "2K",
  "fileName": "paper-texture-cream-a1"
}
```

**Prompt**:

```text
A close, straight-on photograph of hand-made cream paper with fine natural fibres, a faint warm grain and a very soft light gradient from the top left corner toward the centre. Even lighting on a smooth, unmarked surface that fills the whole frame edge to edge. Calm, quiet and slightly tactile.
```

**Check**: the edges are as even as the middle; the contrast of the real text over the lightest and the darkest part is measured (`color-theory`); nothing in it reads as a mark or a stain.

**Pitfall**: asking for a seamless tile. The models do not guarantee one. Use a larger crop, or draw a pattern in SVG.

### Recipe 7: an unnamed person, cropped (4:5)

**When**: a page needs a human touch, with no face and no one who could be taken for someone.

**Call**:

```json
{
  "prompt": "(the prompt below)",
  "aspectRatio": "4:5",
  "imageSize": "2K",
  "fileName": "tea-hands-warmth-a1"
}
```

**Prompt**:

```text
A photograph of a person's hands holding a ceramic mug of tea in both hands, seen from the shoulders down: a soft oatmeal knit sweater, short natural nails, steam rising, and a blurred window with a pale grey sky behind. Soft window light, a shallow depth of field with the focus on the hands and the mug. The face is out of the frame. The mug sits in the lower middle of the frame; the upper third is the plain, blurred window light.
```

**Check**: fingers (count and joints), the mug handle, the steam; no face and no jewellery with lettering.

**Pitfall**: a face. It will look like someone, and a generated face beside a name or a quote invents a witness (rule 2). Keep a back, hands or a crop; never a customer, a reviewer or an endorser.

### Recipe 8: an illustration instead of a photograph (16:9)

**When**: a blog header or an empty state needs a drawn scene, and the shapes are organic enough that SVG would not do.

**Call**:

```json
{
  "prompt": "(the prompt below)",
  "aspectRatio": "16:9",
  "imageSize": "2K",
  "fileName": "greenhouse-hill-illustration-a1"
}
```

**Prompt**:

```text
A flat editorial illustration of a small greenhouse on a hill at dusk, drawn with simple rounded shapes in a limited palette of deep teal, warm peach and cream. A winding path leads up to the greenhouse door, a few round trees stand on both sides, and a large soft sun sits low behind the hill. Clean edges, a gentle paper grain, flat colour except in the sky. The left third of the picture is open peach sky.
```

**Check**: it is a drawing and says so in `disclosure` ("illustration"); the palette is the tokens; the left third is clear.

**Pitfall**: a mascot or a mark. A brand character is drawn by the brand's designer in SVG (`brand-identity`), never generated. An illustration still keeps the label rule.

### Recipe 9: an edit of a supplied packshot (a new background)

**When**: the user supplied a packshot of the real product and wants it in a scene. Rule 5 decides the file; rule 2 says the product stays exactly as it is.

**Call**:

```json
{
  "prompt": "(the prompt below)",
  "inputImagePaths": ["<project>/assets/source/mug-packshot.png"],
  "aspectRatio": "1:1",
  "imageSize": "2K",
  "fileName": "mug-on-oak-counter-a1"
}
```

**Prompt**:

```text
Keep the ceramic mug in the supplied photograph exactly as it is: the same shape, the same glaze colour, the same handle, the same proportions and the same print. Change only the background, to a sunlit oak kitchen counter in soft morning light from the left, with a few out-of-focus green plants behind it and a soft shadow under the mug on the counter. Match the light on the mug to the new scene. The mug sits slightly left of centre; the right third of the frame is a plain, blurred wall.
```

**Check**: put the result beside the supplied photograph and compare the mug point by point (shape, glaze, print, handle); look at the shadow and the edge; `disclosure` says "edited, the product as supplied"; the input is on the card with its source.

**Pitfall**: the model "improves" the product. If the print or the shape changed, the picture is no longer the client's product: reject it, and repeat with the single instruction that was missed.

### Recipe 10: a style reference from the brand's own photograph

**When**: new pictures must match the light and colour of an existing photograph that the brand owns.

**Call**:

```json
{
  "prompt": "(the prompt below)",
  "inputImagePaths": ["<project>/assets/source/campaign-reference.jpg"],
  "aspectRatio": "4:5",
  "imageSize": "2K",
  "fileName": "bicycle-brick-wall-a1"
}
```

**Prompt**:

```text
Take only the light, the colour grading and the grain from the supplied photograph, and make a new photograph with a new subject: a bicycle leaning against a pale brick wall on an empty street in the early morning. Echo the reference's warm highlights, soft shadows and slightly faded greens. The bicycle sits in the lower right of the frame; the upper left is plain brick.
```

**Check**: the new picture does not repeat the reference's subject or composition; the palette matches the tokens; the reference's rights are the brand's.

**Pitfall**: a reference the user does not own. Imitating another photographer's look from their picture is not cleared by editing it. Ask whose it is.

### Recipe 11: a blend of two supplied photographs (OpenAI, a probe first)

**When**: a product cut-out and a scene, both supplied, must become one picture. OpenAI takes the most references (up to 16) but has no published price, so the first image is the probe.

**Call**:

```json
{
  "prompt": "(the prompt below)",
  "provider": "openai",
  "quality": "balanced",
  "inputImagePaths": ["<project>/assets/source/sneaker-cutout.png", "<project>/assets/source/wet-street.jpg"],
  "aspectRatio": "3:2",
  "imageSize": "2K",
  "fileName": "sneaker-wet-street-a1"
}
```

**Prompt**:

```text
Combine the two supplied photographs into one: place the sneaker from the first photograph, unchanged in shape, colour and sole pattern, on the wet cobblestones of the street from the second photograph. Light the sneaker with the same cool evening light and let the street lamps reflect softly in the puddle below it. The sneaker is the sharpest element, in the lower centre of the frame; the sky above is the darker blue of the second photograph.
```

**Check**: the sneaker is unchanged; the shadow and the reflection agree with the light; no seam or doubled edge. Ask the user to read the charge for this first image on the OpenAI usage page and to set the ceiling for the rest.

**Pitfall**: a blend changes the product quietly, and a price nobody knows. Compare the product with the supplied photograph, and do not make a second image before the charge is known.

### Recipe 12: a variation of an approved image

**When**: an approved picture needs one change (the hour, the season, the crop) and the rest must stay.

**Call**:

```json
{
  "prompt": "(the prompt below)",
  "inputImagePaths": ["<project>/assets/generated/petpal-hero-sofa-a2.png"],
  "aspectRatio": "4:5",
  "imageSize": "2K",
  "fileName": "petpal-hero-sofa-late-a1"
}
```

**Prompt**:

```text
Keep the same room, the same cream linen sofa, the same golden retriever and the same framing as in the supplied photograph. Change only the time of day to late afternoon: the light turns warmer and lower, and long soft shadows fall across the cushions. The upper third stays an even, plain cream wall.
```

**Check**: only the light changed; the dog still has its markers (the colour of its coat, its ears, its collar); the new file has its own provenance file that names the source image and the instruction.

**Pitfall**: changing several things at once. It teaches nothing about which instruction worked. A variation is a new asset with its own cap of three calls.

### Recipe 13: a set across ratios from one core

**When**: the feed, the story and the banner must look like one shoot. Generate each ratio on its own: same core sentences, a different composition sentence.

**Call** (the story; the feed and the banner differ in `aspectRatio` and `fileName`):

```json
{
  "prompt": "(the prompt below)",
  "aspectRatio": "9:16",
  "imageSize": "2K",
  "fileName": "rain-cyclist-story-a1"
}
```

**Prompt**:

```text
A photograph of a cyclist in a yellow rain jacket riding away along a quiet wet street at dawn, seen from behind, with rain-dark cobblestones, a row of grey terraced houses and a pale sky. Cool soft light, a shallow depth of field with the cyclist in focus, shot on an 85mm lens. Palette: yellow, slate grey and pale blue. The cyclist is small, in the lower third of the frame; the top third is an empty pale sky.
```

For the 4:5 feed, replace the last sentence with "The cyclist sits in the lower right two fifths; the upper third is an empty pale sky." For the 16:9 banner, with "The cyclist rides in the right third of the frame; the left half is the street and an empty pale sky." Keep every other sentence word for word.

**Check**: the three files share the jacket, the street, the light and the palette; each has its own clear zone; each has its own provenance file and its own cap.

**Pitfall**: one picture cropped into three. The subject lands in the wrong place in two of them.

### Recipe 14: a grounded scene (Gemini with search)

**When**: the picture depends on current facts, such as what is in season, and Gemini can look them up. Only Gemini grounds. It adds a search charge after the free allowance, so use it only when the facts matter.

**Call**:

```json
{
  "prompt": "(the prompt below)",
  "useGoogleSearch": true,
  "aspectRatio": "3:2",
  "imageSize": "2K",
  "fileName": "october-market-produce-a1"
}
```

**Prompt**:

```text
A photograph of a farmers' market stall in northern Europe in the middle of October, showing the produce that is in season there at that time: pumpkins and squashes in several shapes, late apples, plums, leeks, beetroot with their leaves and bunches of dried herbs, in plain wooden crates. Overcast light, cool and soft, a shallow depth of field with the nearest crate in focus. The crates fill the lower two thirds of the frame; the upper third is a soft grey sky above the canopy.
```

**Check**: the produce is what is in season; the crates carry no lettering; say in the report that grounding was used.

**Pitfall**: expecting the picture to be a real place. Grounding makes the facts plausible; it does not make the picture a photograph of a market that exists.

### Recipe 15: short text in the picture (the marked exception)

**When**: the user insists that one short word appears inside the scene (a sign, a poster) and an overlay cannot do it. This needs the user's yes, because text is normally an overlay (rule 2).

**Call**:

```json
{
  "prompt": "(the prompt below)",
  "quality": "balanced",
  "aspectRatio": "4:5",
  "imageSize": "2K",
  "fileName": "bakery-front-sign-a1"
}
```

**Prompt**:

```text
A photograph of the front of a small bakery on a quiet street in the morning: a green-painted wooden shopfront, a window with loaves on a wooden shelf, and above the door a simple hand-lettered wooden sign that reads "BREAD" in cream capital letters on a dark green board. Soft overcast light, shot on a 35mm lens at eye level, a shallow depth of field with the sign in focus.
```

**Check**: spell the word letter by letter against what you asked for; no extra letters, no second word; the sign sits where the scene needs it.

**Pitfall**: more than one short common word, a brand name, a price or any claim. Raster text drifts, and a brand or a claim is not ours to invent. If the word is wrong after two tries, use an overlay.

### Recipe 16: one scene on another provider (Seedream)

**When**: the user holds a BytePlus key only, or the go names Seedream. The call changes in four ways: `provider`, a size of 1K or 2K, PNG or JPEG references only, and a prompt that BytePlus rewrites on its side. For OpenAI the same change applies: set `provider` to `openai`, avoid the four extreme ratios, and treat the first image as the probe.

**Call**:

```json
{
  "prompt": "(the prompt below)",
  "provider": "seedream",
  "quality": "balanced",
  "aspectRatio": "4:5",
  "imageSize": "2K",
  "fileName": "bakery-breakfast-table-seedream-a1"
}
```

**Prompt**:

```text
A photograph of a breakfast table in soft morning light: a wooden board with two warm croissants, a small jug of milk, a ceramic cup of coffee and a linen napkin, seen from slightly above and in front. Window light from the left, gentle long shadows, the croissants in sharp focus. The table fills the lower two thirds of the frame; the upper third is an even, plain cream wall. Palette: cream, warm sand and one muted terracotta cup. Natural and unposed.
```

**Check**: the model saw more than you sent (BytePlus optimises the prompt), so the picture may differ from Recipe 1: judge it by the brief, and record the prompt you sent with a note that the provider rewrote it; the measured size is what the lead's check reports.

**Pitfall**: assuming the pixel sizes of Gemini. Seedream and OpenAI return their own sizes; check the ratio against the placement.
