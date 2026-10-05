# The fifteen checks and how to verify each

Verify from a shell with `curl`. In PowerShell use `curl.exe`: the plain `curl` is an alias for `Invoke-WebRequest` and behaves differently. `curl -sI -L https://example.com/page` follows redirects and shows each hop's status; `curl -s https://example.com/robots.txt` reads a file. Keep the request rate low and fetch only the client's own site. Write down the command, the URL, the raw output line and the date for every check.

| # | Check | What must be true | How to verify |
|---|---|---|---|
| 1 | robots.txt | exists at the root, returns 200, allows important paths, blocks only low-value or private ones, declares sitemaps, and has no `Disallow: /` left over from staging | `curl -s https://<site>/robots.txt` |
| 2 | Sitemap | every file under 50,000 URLs and 50 MB uncompressed, listed in robots.txt, only canonical, indexable, 200 URLs with accurate `lastmod` | fetch the file; sample its URLs with `curl -sI` |
| 3 | Status codes | key URLs return 200; removed pages return 404 or 410, not a soft 200 "not found" page; no 5xx on crawl | `curl -sI <url>` |
| 4 | Redirects | one hop at most; any chain longer than one hop and any loop is a finding; 301 or 308 for permanent moves | `curl -sI -L <url> \| node scripts/redirect-chain.mjs` |
| 5 | Canonical | every indexable page has one, self-referencing on originals; it points to a 200, indexable URL, not to a redirect or a `noindex` page | read the `<link rel="canonical">` and fetch its target |
| 6 | Indexing directives | no `noindex` (meta tag or `X-Robots-Tag` header) on a page that should rank; every staging and admin route is blocked or `noindex` and requires login where possible; a staging site must not be indexable | read the meta tag and `curl -sI` for the header |
| 7 | Title | unique per page, about 50 to 60 characters, primary topic first, brand last | read the `<title>` |
| 8 | Meta description | unique, about 120 to 155 characters, honest, with the value proposition | read the meta tag |
| 9 | Social preview tags | Open Graph and Twitter card tags with a working image URL at the recommended size | read the tags, fetch the image |
| 10 | Headings | one H1, a hierarchy that mirrors the content, no headings used only for styling | read the outline |
| 11 | Structured data | valid JSON-LD for the page type, matching what is visible (`schema-markup-strategy`) | the validators, on the live or staged URL |
| 12 | Core Web Vitals | at the 75th percentile: LCP at most 2.5 s, INP at most 200 ms, CLS at most 0.1 ("needs improvement" up to 4.0 s, 500 ms and 0.25) | field data (real users, for example the Chrome UX Report or the client's analytics) to decide whether there is a problem; lab data (a Lighthouse or DevTools run via `chrome-devtools-mcp`) to find the cause |
| 13 | Images | dimensions set, modern format, descriptive alt text, lazy-loading below the fold but not for the main image, no oversize files | read the markup, check file sizes |
| 14 | Internal links | important pages within about three clicks of the home page, descriptive anchors, no orphan pages (in the sitemap with no internal links), no links to redirected or broken URLs | compare the sitemap with the link graph |
| 15 | Rendering | the main content and links exist in the raw HTML or are reliably rendered; content that appears only after user interaction is not indexed reliably | compare `curl -s <url>` with the rendered DOM |

A lab number alone is not a verdict on Core Web Vitals. A finding that needs Search Console data (index coverage) is listed as not checked when the data is not available.
