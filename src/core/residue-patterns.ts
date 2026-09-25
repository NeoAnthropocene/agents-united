/**
 * Plan 019 Step 4 — host-keyed forbidden-pattern lists (acceptance gate 4 extension).
 * Lives in a leaf module so both the body lint (dialects) and the renderer's scrub safety
 * net (claude-projector) consume ONE list without an import cycle. The list must grow with
 * every new host section (Plan 019 maintenance note).
 */
export const RESIDUE_PATTERNS_BY_HOST: Record<string, readonly RegExp[]> = {
  claude: [/Nested Subagent Delegation/, /Host Routing/, /language_server/, /Cline & CLI/],
};