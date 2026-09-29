/**
 * Plan 019 Step 4 — host-keyed forbidden-pattern lists (acceptance gate 4 extension).
 * Lives in a leaf module so both the body lint (dialects) and the renderer's scrub safety
 * net (claude-projector) consume ONE list without an import cycle. The list must grow with
 * every new host section (Plan 019 maintenance note).
 */
export const RESIDUE_PATTERNS_BY_HOST: Record<string, readonly RegExp[]> = {
  claude: [/Nested Subagent Delegation/, /Host Routing/, /language_server/, /Cline & CLI/],
};

/**
 * Plan 025 Step 1/6 — specialist-anatomy body lint.
 * Code exemplars belong in skill `references/**`, not in `registry/agents/*.md` bodies
 * (Plan 025 Objective 4). This constant and the two helpers below are the single seam the
 * anatomy test (`tests/specialist-anatomy.test.ts`) and any future CI check share, so the
 * threshold and the parsing rules never drift between the two. Calibrated on
 * `subagent-ml-platform-engineer.md` (0 fenced blocks) and the shared comms sections'
 * short illustrative snippets (<= 6 lines) per Plan 025 risk R5.
 */
export const AGENT_BODY_FENCE_LINE_THRESHOLD = 15;

/**
 * Fence info-strings exempted from the threshold: these carry the mandatory Output Format
 * Requirements / report-shape template (an illustrative report skeleton, not runnable code),
 * which is unchanged anatomy (Plan 025 Objective 1) and legitimately runs longer than a
 * code exemplar.
 */
const EXEMPT_FENCE_LANGS = new Set(['', 'markdown', 'md', 'text', 'plain']);

export interface OversizedFencedBlock {
  /** 1-based line number of the opening fence. */
  readonly line: number;
  /** Number of content lines strictly between the opening and closing fence. */
  readonly contentLines: number;
  /** The fence's info string, e.g. "typescript" or "bash" (may be empty). */
  readonly lang: string;
}

/**
 * Scans a `registry/agents/*.md` body for fenced code blocks whose content exceeds
 * `AGENT_BODY_FENCE_LINE_THRESHOLD` lines. Returns one entry per offending block.
 */
export function findOversizedFencedBlocks(body: string): OversizedFencedBlock[] {
  const lines = body.split('\n');
  const violations: OversizedFencedBlock[] = [];
  let openLine: number | null = null;
  let openLang = '';
  let contentLines = 0;
  for (let i = 0; i < lines.length; i++) {
    const fenceMatch = /^```(.*)$/.exec(lines[i]);
    if (fenceMatch) {
      if (openLine === null) {
        openLine = i + 1;
        openLang = fenceMatch[1].trim();
        contentLines = 0;
      } else {
        if (
          contentLines > AGENT_BODY_FENCE_LINE_THRESHOLD &&
          !EXEMPT_FENCE_LANGS.has(openLang.toLowerCase())
        ) {
          violations.push({ line: openLine, contentLines, lang: openLang });
        }
        openLine = null;
        openLang = '';
        contentLines = 0;
      }
      continue;
    }
    if (openLine !== null) contentLines++;
  }
  return violations;
}

export interface SkillConsultationMapRow {
  readonly situation: string;
  readonly skill: string;
  readonly loadWhen: string;
  readonly providedBy: string;
}

/**
 * Parses the `## Skill Consultation Map` table (Situation | Skill | Load when | Provided by)
 * out of an agent body, if present. The skill cell is expected to name exactly one skill,
 * inline-coded (e.g. `` `supabase-backend-architecture` ``).
 */
export function parseSkillConsultationMap(body: string): SkillConsultationMapRow[] {
  const sectionMatch = /^## .*Skill Consultation Map.*$/m.exec(body);
  if (!sectionMatch) return [];
  const rest = body.slice(sectionMatch.index + sectionMatch[0].length);
  const nextHeading = /^## /m.exec(rest);
  const section = nextHeading ? rest.slice(0, nextHeading.index) : rest;
  const rows: SkillConsultationMapRow[] = [];
  for (const line of section.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) continue;
    const cells = trimmed
      .split('|')
      .slice(1, -1)
      .map(c => c.trim());
    if (cells.length < 4) continue;
    if (/^:?-+:?$/.test(cells[1])) continue; // separator row
    if (/^situation$/i.test(cells[0])) continue; // header row
    const skillMatch = /`([a-z0-9-]+)`/.exec(cells[1]);
    if (!skillMatch) continue;
    rows.push({ situation: cells[0], skill: skillMatch[1], loadWhen: cells[2], providedBy: cells[3] });
  }
  return rows;
}