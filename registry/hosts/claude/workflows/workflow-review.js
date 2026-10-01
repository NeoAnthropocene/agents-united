export const meta = {
  name: 'workflow-review',
  description: 'Review changed files across independent dimensions, try to refute every finding, and return a ranked verdict',
  whenToUse: 'A review of about eight or more changed files, or a pull request too large for one reviewer. Pass args.files (an array of paths); the orchestrator scouts the change set first.',
  phases: [
    { title: 'Find', detail: 'one read-only reviewer per dimension, in parallel' },
    { title: 'Verify', detail: 'skeptics try to refute each finding before it is reported' },
  ],
}

// Input (args): { files: string[] (required), size?: 'small' | 'medium' | 'large', context?: string,
//                 pullRequest?: { owner: string, repo: string, number: number } }
// Default size is 'small': 3 agents, the Pro-plan baseline (fewer than 5). 'medium' is at most 9 agents, 'large' at most 23.
// Pass any timestamp through args; the script never reads the clock.

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']

const DIMENSIONS = {
  'security-correctness':
    'security (injection, broken authentication or access control, secret leakage, unsafe deserialisation) and correctness (swallowed errors, unhandled promise rejections, unchecked edge cases, wrong logic)',
  'design-performance-tests':
    'design and maintainability (architecture and module-boundary violations, duplication, unsafe type assertions), performance (N+1 queries, blocking calls in async code, unbounded loops, leaks) and whether the change carries tests',
  security: 'security only: injection, broken authentication or access control, secret leakage, unsafe deserialisation, missing input validation',
  correctness: 'correctness and error handling: wrong logic, swallowed errors, unhandled promise rejections, unchecked edge cases, race conditions',
  design: 'design: architecture and module-boundary violations, API compatibility breaks, duplication, unsafe type assertions',
  performance: 'performance: N+1 queries, blocking calls in async code, unbounded loops, memory leaks, missing indexes, cache stampedes',
  tests: 'tests: whether new behaviour and fixed bugs are covered, whether tests assert behaviour and not mocks, missing negative cases',
}

const SIZES = {
  small: { dimensions: ['security-correctness', 'design-performance-tests'], verify: 'batch', votes: 1, maxVerified: 12 },
  medium: { dimensions: ['security', 'correctness', 'design-performance-tests'], verify: 'each', votes: 1, maxVerified: 6 },
  large: { dimensions: ['security', 'correctness', 'design', 'performance', 'tests'], verify: 'each', votes: 2, maxVerified: 9 },
}

const FINDING = {
  type: 'object',
  properties: {
    severity: { type: 'string', enum: SEVERITIES },
    file: { type: 'string' },
    line: { type: 'integer' },
    title: { type: 'string' },
    snippet: { type: 'string' },
    risk: { type: 'string' },
    remediation: { type: 'string' },
  },
  required: ['severity', 'file', 'line', 'title', 'snippet', 'risk', 'remediation'],
  additionalProperties: false,
}
const FINDINGS = { type: 'object', properties: { findings: { type: 'array', items: FINDING } }, required: ['findings'], additionalProperties: false }
const VERDICT = {
  type: 'object',
  properties: { refuted: { type: 'boolean' }, reason: { type: 'string' } },
  required: ['refuted', 'reason'],
  additionalProperties: false,
}
const VERDICTS = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, refuted: { type: 'boolean' }, reason: { type: 'string' } },
        required: ['id', 'refuted', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['verdicts'],
  additionalProperties: false,
}

const request = args && typeof args === 'object' && !Array.isArray(args) ? args : {}
const files = Array.isArray(request.files) ? request.files.filter(file => typeof file === 'string' && file.length > 0) : []
if (files.length === 0) {
  log('workflow-review needs args.files, an array of file paths to review.')
  return { workflow: 'workflow-review', error: 'args.files must be a non-empty array of file paths' }
}
const size = typeof request.size === 'string' && Object.prototype.hasOwnProperty.call(SIZES, request.size) ? request.size : 'small'
const plan = SIZES[size]
const rank = severity => SEVERITIES.indexOf(severity)

const pr = request.pullRequest && request.pullRequest.owner && request.pullRequest.repo && request.pullRequest.number ? request.pullRequest : null
const scope = [
  'Files under review:',
  ...files.map(file => `- ${file}`),
  pr ? `\nThe change is pull request ${pr.owner}/${pr.repo}#${pr.number}; read its diff with the pull request tools to see exactly what changed.` : '',
  typeof request.context === 'string' && request.context ? `\nContext from the requester: ${request.context}` : '',
].join('\n')

log(`workflow-review (${size}): ${plan.dimensions.length} reviewers, then ${plan.verify === 'batch' ? '1 verifier' : `up to ${plan.maxVerified * plan.votes} verification calls`}.`)

// ── Find ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
phase('Find')
const finderPrompt = key =>
  `You are one of several independent, read-only reviewers. Review ONLY this dimension: ${DIMENSIONS[key]}.\n\n${scope}\n\n` +
  'Read each file, and search the code where it helps. Report only real problems you can point to. Every finding needs the file, the line, ' +
  'a direct snippet of the code, the risk, and one specific remediation. When you are unsure, report it as INFO and say what is ambiguous; ' +
  'never inflate a severity. Change nothing. Return an empty list when this dimension is clean.'

// A barrier is right here: findings from every dimension are merged and deduplicated before any verification is paid for.
const rounds = await parallel(
  plan.dimensions.map(key => () => agent(finderPrompt(key), { agentType: 'code-reviewer', schema: FINDINGS, phase: 'Find', label: key })),
)

const notes = []
const merged = new Map()
rounds.forEach((round, index) => {
  if (!round) {
    notes.push(`The ${plan.dimensions[index]} reviewer did not complete, so that dimension is not covered.`)
    return
  }
  for (const finding of round.findings) {
    const key = `${finding.file}:${finding.line}:${finding.title.toLowerCase()}`
    const seen = merged.get(key)
    if (!seen) {
      merged.set(key, { ...finding, dimensions: [plan.dimensions[index]] })
    } else {
      seen.dimensions.push(plan.dimensions[index])
      if (rank(finding.severity) < rank(seen.severity)) seen.severity = finding.severity
    }
  }
})
const findings = [...merged.values()]
  .sort((a, b) => rank(a.severity) - rank(b.severity) || a.file.localeCompare(b.file) || a.line - b.line)
  .map((finding, index) => ({ ...finding, id: `F${index + 1}` }))

const countBySeverity = list => Object.fromEntries(SEVERITIES.map(severity => [severity, list.filter(finding => finding.severity === severity).length]))

if (findings.length === 0) {
  log('No findings: nothing to verify.')
  return {
    workflow: 'workflow-review',
    size,
    files: files.length,
    dimensions: plan.dimensions,
    verdict: notes.length > 0 ? 'Comment' : 'Approve',
    counts: countBySeverity([]),
    confirmed: [],
    unverified: [],
    refuted: [],
    notes,
  }
}

// ── Verify ───────────────────────────────────────────────────────────────────────────────────────────────────────────
phase('Verify')
const toVerify = findings.slice(0, plan.maxVerified)
const beyondCap = findings.slice(plan.maxVerified)
if (beyondCap.length > 0) {
  notes.push(`Verification covers the ${plan.maxVerified} most severe findings; ${beyondCap.length} lower-severity findings are reported unverified.`)
  log(notes[notes.length - 1])
}

const describe = finding => `${finding.id} [${finding.severity}] ${finding.file}:${finding.line} ${finding.title}\n  snippet: ${finding.snippet}\n  risk: ${finding.risk}`
const skeptic =
  'You are an independent skeptic. Try to REFUTE the finding(s) below: read the cited code and decide whether each is real. ' +
  'Default to refuted=true when you cannot reproduce the reasoning from the code itself. Change nothing.\n\n'

const answers = new Map() // id -> list of { refuted, reason }
const note = (id, verdict) => answers.set(id, [...(answers.get(id) || []), verdict])

if (plan.verify === 'batch') {
  const batch = await agent(skeptic + toVerify.map(describe).join('\n\n'), {
    agentType: 'code-reviewer',
    effort: 'high',
    schema: VERDICTS,
    phase: 'Verify',
    label: 'verify all',
  })
  if (batch) for (const verdict of batch.verdicts) note(verdict.id, verdict)
  else notes.push('The verification agent did not complete, so every finding is reported unverified.')
} else {
  const calls = toVerify.flatMap(finding =>
    Array.from({ length: plan.votes }, (_, vote) => () =>
      agent(skeptic + describe(finding), {
        agentType: 'code-reviewer',
        effort: 'high',
        schema: VERDICT,
        phase: 'Verify',
        label: `${finding.id} vote ${vote + 1}`,
      }).then(verdict => ({ id: finding.id, verdict })),
    ),
  )
  for (const result of (await parallel(calls)).filter(Boolean)) if (result.verdict) note(result.id, result.verdict)
}

const confirmed = []
const refuted = []
const unverified = [...beyondCap]
for (const finding of toVerify) {
  const votes = answers.get(finding.id) || []
  if (votes.length === 0) {
    unverified.push(finding)
    continue
  }
  const against = votes.filter(vote => vote.refuted).length
  // A majority must refute it to remove it; a tie keeps the finding, marked contested.
  if (against * 2 > votes.length) refuted.push({ id: finding.id, title: finding.title, reason: votes.find(vote => vote.refuted).reason })
  else confirmed.push(against > 0 ? { ...finding, contested: true } : finding)
}

const unverifiedSerious = unverified.some(finding => rank(finding.severity) <= 1)
const verdict = confirmed.some(finding => rank(finding.severity) <= 1)
  ? 'Request Changes'
  : confirmed.some(finding => finding.severity === 'MEDIUM') || unverifiedSerious || notes.length > 0
    ? 'Comment'
    : 'Approve'

return {
  workflow: 'workflow-review',
  size,
  files: files.length,
  dimensions: plan.dimensions,
  verdict,
  counts: countBySeverity(confirmed),
  confirmed,
  unverified: unverified.sort((a, b) => rank(a.severity) - rank(b.severity)),
  refuted,
  notes,
}
