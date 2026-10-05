# Audit report template

Fill every line. A check you could not do goes in "not checked", with the access needed.

```text
SCOPE        <the 10 to 30 URLs audited, why each, and the date>
SUMMARY      health score <n> by the rule (100 - 15 per critical - 7 per major - 2 per minor, floor 0), scope <...>
             indexation status: <important pages blocked or indexed>
CHECKLIST    the 15 points of technical-seo-audit: status and evidence each, or "not checked"
PRIORITIES   <action> | impact (estimate: pages, expected traffic or revenue) | effort (who changes what) | owner
SNIPPETS     <authored titles, descriptions, JSON-LD, with the page each belongs to>
NOT CHECKED  <queries, clicks, index coverage, authenticated areas, ...> and the access needed
```

## The per-URL table (key pages)

```text
| # | Sev | URL | Primary intent (one sentence) | Title and description now | Issue | Fix | Owner |
```

## A finding (the evidence is mandatory)

```text
<id> | <critical | major | minor> | <URL> | observation: <a header, a tag or a number, quoted> | tool or command: <...> | date: <...>
fix: <specific enough to implement> | owner: <Deniz | Yavuz | Kaan | Jamileh | the lead for access>
```
