# Return review data; the caller persists it

Return result.schema.json data with the original job ID/digests, unchanged subject, complete actual inventory pins and one coverage row per file. Set inventorySource to caller-provided; read-only tools do not recompute them. Report criterion outcomes, grounded findings, deterministic-evidence observations, limitations, live unverified, explicit open items and acceptedDraft false.

Use reviewed only when all required coverage/criteria and evidence are addressed; partial or blocked names the remaining work. A blocked report is inconclusive with a named open item and dependent acceptance IDs. Preserve optional deltas. Severity is CRITICAL/HIGH/MEDIUM/LOW/INFO, with confidence and an actionable correction. Findings recommend work; they never execute it.

SubagentHandback is conditional on actual Host availability. Otherwise return the same structured data in the ordinary final response. ReportFindings can present issues but cannot replace the full record. Do not claim a file was written, a receipt accepted or a worker process exited. This ordinary foreground worker has no team shutdown, resumed peer or lifecycle-notice wait.

The caller saves result.json at the fixed review root, compares the original job/candidate digests, runs the installed checker and independently inspects returned path/length/hash, coverage, citations, logs/exits and preservation. Checker exit 0 means supported record consistency; quality stays pending and live/execution proof unverified. A revised repair job changes the candidate digest and requires new validation/review. No automatic repair/retry/publication loop belongs here.
