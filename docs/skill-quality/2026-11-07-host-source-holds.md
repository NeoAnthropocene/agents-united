# Host source holds — 2026-11-07

Three documentation snapshots remain held by the existing audit. The findings
below describe the matches for review; they do **not** clear the holds. Retain
the locked files and baselines and keep `auditAllow` empty. A file/rule
suppression in `auditAllow` is not permission to ingest a blocked source.

| Held source and scratch evidence | Match and surrounding context | Audit rule |
| --- | --- | --- |
| Official Claude [MCP documentation](https://code.claude.com/docs/en/mcp.md), `scratch/host-refresh-2026-11-06/claude-held/mcp.md:350` | A protective HTTPS/loopback OAuth restriction contains a refusal link label with singular “send”. | `injection/exfiltration` |
| Official Claude [VS Code documentation](https://code.claude.com/docs/en/vs-code.md), `scratch/host-refresh-2026-11-06/claude-held/vs-code.md:183` | A UNC precaution describes a possible Windows credential transmission and includes an informational link. | `injection/exfiltration` |
| Official Antigravity [changelog](https://antigravity.google/docs/changelog.md), `scratch/host-refresh-2026-11-06/antigravity/changelog.md:5026` | Historical text contains a literal backticked `<System>` marker. | `injection/role-impersonation` |

The rule definitions are in `scripts/hostlib/audit.ts`. The
`host-update-sync` Skill's step 2 says not to override a blocked documentation
refresh and to report it under PR Security holds; it supplies no documentation
clearance workflow. Its separate human-clear wording applies to held upstream
Skills. These findings do not authorize overriding either process.

SHA-256 of the complete retained candidate files, in the table's order:

- MCP: `4b3c2237229b454601119d2fd5d44228089ec3436b78edb395d357fc2bfe44d1`
- VS Code: `d5e69f6256d3e741aebb26f7e1ec8acda9a4bd70fa17edb169d8a1ba926d214c`
- Antigravity changelog: `42c569b22405a052b9bdcf9442c48b6ee51f3beff0482409c570a57c905ad834`

These identify the quarantined files; their content is not copied into this
report, and replay of the full candidates requires those retained files.

One possible separate auditor-policy proposal is a narrow span-level
classification of explicit refusal language, supported by both benign and
adversarial fixtures. It is **not implemented**. It must not introduce blanket
domain, link or backtick exceptions. The UNC and `<System>` cases require
broader policy review; none of these observations clears a held source.

The November 7 check reached all three web Hosts and found zero index delta.
The Antigravity `agy` command was skipped. Claude 2.1.319 was newly seen
beyond the refreshed changelog's latest 2.1.318 entry and is being reviewed
separately. The retained lastSeen baseline is still 2.1.285.
These results do not establish that current upstream material was fully
reviewed.

That skipped-command result describes the initial check. The later reviewed
command stream advanced to 1.5.1; see [Plan 048](../../plans/048-host-refresh-and-claude-session-tracking.md#2026-11-07--command-baseline-advanced-after-complete-review).
It did not clear the web changelog hold.

For review, the maintainer can accept the explicitly bounded refresh with
these holds retained, or request a separate auditor-policy proposal. Neither
choice by itself permits ingestion of the currently blocked files.

The maintainer subsequently selected the separate tested proposal with all
three sources held, then delegated remaining local decisions while away.
[Plan 051](../../plans/051-docs-audit-policy-precision-proposal.md) records that
proposal and baseline characterization. This decision authorizes preparation
and testing, not production policy adoption or ingestion of these sources.
