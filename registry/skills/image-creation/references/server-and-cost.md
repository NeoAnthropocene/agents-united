# The estimate for a go-ahead, the caps, and where the words go

The server is named `image-gen`: the `mcp-image` package, pinned in `mcp-setup` (`references/claude-code.md`) and started with the user's own keys. It has one tool, `mcp__image-gen__generate_image`, and three providers: Gemini (the default), OpenAI and Seedream. The lead installs it after the user's yes; you never run, change or configure it. If `ToolSearch` does not list the tool, it is not connected. The parameters, the reply, the errors and the facts of each provider are in the skill `image-generation` (`references/parameters.md`, `references/providers.md`): load it before the go-ahead, because the go-ahead names a provider.

## The estimate

The estimate for a go-ahead is the number of images times the price at the size. Its worst case is three calls per asset: the first and two regenerations. Prices read on 2026-10-09 from the providers' own pages, in US dollars per image (the full table and its sources are in `references/providers.md` of `image-generation`):

| Provider and model | Per image |
|---|---|
| Gemini `gemini-nano-banana-2.1`, the default (`fast`, `balanced`) | $0.0336 at 1K, $0.0504 at 2K, $0.113 at 4K |
| Gemini `gemini-3-pro-image` (`quality`) | $0.134 at 1K and 2K, $0.24 at 4K |
| Seedream | $0.045 at 1K, $0.09 at 2K |
| OpenAI | no published price per image |

Two assets at 2K on the default model are $0.10 if every first picture is kept, and $0.30 at most. The script `call-check.mjs` of `image-generation` prints this estimate for a role with a shell; without one, the arithmetic is the table.

OpenAI bills by token and publishes no price per image. The first OpenAI image of a go is a probe: make one, ask the user to read its charge on the OpenAI usage page, and set the ceiling for the rest from that; say "no published price" in the go-ahead, never a guess.

Image models have no free tier at any of the three providers: the account behind the key needs billing, and a call whose account has none fails with a quota or billing error. Say so before the first call, and report the estimated cost afterwards.

A call takes seconds to a few minutes. Make them one at a time.

## Where the words go

The prompt, and any input photo, goes to the provider the call names (Google, OpenAI or BytePlus), under the user's own key. Each provider's terms and the user's account terms apply, and the user reads them; what each says is in `references/providers.md` of `image-generation`. Put no client secret, personal data or unreleased product detail in a prompt, and say in the go-ahead where the words go.

Every Gemini image carries an invisible SynthID watermark (Google's documentation). It is not a visible label and does not replace one ([provenance-and-disclosure.md](provenance-and-disclosure.md)).
