# Worked example (invented output, for checking your own work)

A site audit on 2026-10-01 of one key URL, `https://example.com/docs/webhooks`. This is the shape `curl` prints, and `scripts/redirect-chain.mjs` reads it.

```text
$ curl -sI -L https://example.com/docs/webhooks
HTTP/2 301
location: https://example.com/docs/webhooks/

HTTP/2 301
location: https://www.example.com/docs/webhooks/

HTTP/2 200
x-robots-tag: noindex
```

Piped through the helper (`... | node scripts/redirect-chain.mjs`) it prints two hops, the final 200, `2 redirect hops` and two findings: a redirect chain and a `noindex` on the final response.

## The findings

- Check 4, **major**: a two-hop redirect chain (the trailing slash, then www). Remediation for Deniz: redirect straight to the final URL in one hop.
- Check 6, **critical**: `X-Robots-Tag: noindex` on a documentation page, probably inherited from a staging rule (the evidence is the output above). Remediation for Deniz: remove the header on production.
- Check 12, **major**: LCP 3.4 s at the 75th percentile in field data (the client's export, last 28 days); a lab trace shows a 1.9 MB hero image (root cause through `debug-optimize-lcp`).

## The table

```text
check  severity  status  finding and remediation
 4     major     fail    chain /docs/webhooks -> /docs/webhooks/ -> www: 2 hops; redirect directly (Deniz)
 6     critical  fail    X-Robots-Tag: noindex on /docs/webhooks; remove on production (Deniz)
12     major     fail    LCP 3.4 s at p75 in field data (client's export, last 28 days); lab trace shows a 1.9 MB hero image (see debug-optimize-lcp)
```
