export const meta = {
  name: 'workflow-test',
  description: 'Run the test suites, repair every failure by test file within a cap, verify with an independent re-run, and report the verdict with coverage against a target',
  whenToUse: 'A red or unfamiliar test run, or a coverage check across several suites. A green run costs one agent. Pass args.commands (suite commands) and args.coverageTarget when a coverage threshold matters.',
  phases: [
    { title: 'Run', detail: 'one agent runs the suites and reports the failures and the coverage' },
    { title: 'Repair', detail: 'one agent per failing test file finds the root cause and fixes it' },
    { title: 'Verify', detail: 'an independent re-run of every suite after each repair round' },
  ],
}

// Input (args): { commands?: (string | { name?: string, command: string })[] (default: npm test), size?: 'small' | 'medium' | 'large',
//                 coverageTarget?: number (percent), coverageCommand?: string (default: npm run test:coverage), specialist?: 'backend' | 'frontend',
//                 context?: string }
// Default size is 'small': at most 3 agents (run, one repair agent for every failure, verify), the Pro-plan baseline (fewer than 5).
// 'medium' is at most 9 agents (up to 3 repair agents a round, 2 rounds) and 'large' at most 22 (up to 6 a round, 3 rounds).
// Repair agents run one after another, because failures often share product code. Nothing is committed: changes stay in the working tree.
// A coverage shortfall is reported with the files, never repaired here: closing it is new work, for workflow-implement.

const SIZES = {
  small: { clusters: 1, rounds: 1, maxAgents: 4 },
  medium: { clusters: 3, rounds: 2, maxAgents: 9 },
  large: { clusters: 6, rounds: 3, maxAgents: 23 },
}
const SPECIALISTS = { backend: 'backend-architect', frontend: 'frontend-architect' }
const MAX_COMMANDS = 5

const RESULT = {
  type: 'object',
  properties: {
    suites: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          command: { type: 'string' },
          passed: { type: 'boolean' },
          total: { type: 'integer' },
          failed: { type: 'integer' },
          failures: {
            type: 'array',
            items: {
              type: 'object',
              properties: { test: { type: 'string' }, file: { type: 'string' }, message: { type: 'string' } },
              required: ['test', 'file', 'message'],
              additionalProperties: false,
            },
          },
        },
        required: ['name', 'command', 'passed', 'total', 'failed', 'failures'],
        additionalProperties: false,
      },
    },
    coverage: {
      type: 'object',
      properties: {
        measured: { type: 'boolean' },
        percent: { type: 'number' },
        lowFiles: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, percent: { type: 'number' } }, required: ['file', 'percent'], additionalProperties: false } },
      },
      required: ['measured', 'percent', 'lowFiles'],
      additionalProperties: false,
    },
    problem: { type: 'string' },
  },
  required: ['suites', 'coverage', 'problem'],
  additionalProperties: false,
}
const FIX = {
  type: 'object',
  properties: {
    classification: { type: 'string', enum: ['test-bug', 'product-bug', 'environment', 'unknown'] },
    rootCause: { type: 'string' },
    fixed: { type: 'boolean' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    evidence: { type: 'string' },
    blocker: { type: 'string' },
  },
  required: ['classification', 'rootCause', 'fixed', 'filesChanged', 'evidence', 'blocker'],
  additionalProperties: false,
}

const request = args && typeof args === 'object' && !Array.isArray(args) ? args : {}
const size = typeof request.size === 'string' && Object.prototype.hasOwnProperty.call(SIZES, request.size) ? request.size : 'small'
const plan = SIZES[size]
const commands = (Array.isArray(request.commands) ? request.commands : [])
  .map(entry => (typeof entry === 'string' ? { command: entry } : entry))
  .filter(entry => entry && typeof entry === 'object' && typeof entry.command === 'string' && entry.command.trim() !== '')
  .slice(0, MAX_COMMANDS)
  .map((entry, index) => ({ name: typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : `suite ${index + 1}`, command: entry.command.trim() }))
if (commands.length === 0) commands.push({ name: 'tests', command: 'npm test' })
const target = typeof request.coverageTarget === 'number' && Number.isFinite(request.coverageTarget) && request.coverageTarget >= 0 && request.coverageTarget <= 100 ? request.coverageTarget : null
const coverageCommand = typeof request.coverageCommand === 'string' && request.coverageCommand.trim() ? request.coverageCommand.trim() : 'npm run test:coverage'
const fixerType = typeof request.specialist === 'string' && Object.prototype.hasOwnProperty.call(SPECIALISTS, request.specialist) ? SPECIALISTS[request.specialist] : SPECIALISTS.backend
const requesterContext = typeof request.context === 'string' && request.context ? `\nContext from the requester: ${request.context}\n` : ''

// A blocker is free text: drop its trailing punctuation so a note can add its own.
const reason = text => String(text).trim().replace(/[.;:,\s]+$/, '')
const notes = []
let used = 0
const spawn = (prompt, options) => {
  used += 1
  return agent(prompt, options)
}

const commandList = commands.map((entry, index) => `${index + 1}. ${entry.name}: ${entry.command}`).join('\n')
const measuring = target === null ? '' : `\nThen run the coverage command \`${coverageCommand}\` and report the overall line coverage percentage and every file below ${target} percent in lowFiles; set measured to false if the number could not be read.`
const runPrompt = verb =>
  `${verb} these test commands from the repository root, one after another, and report each as a suite. Do not fix anything and do not change any file.\n${commandList}\n` +
  'For every failing test give its name, its test file path (relative to the repository root) and the first line of its error message. When a command could not start at all, describe why in `problem`; otherwise leave `problem` empty. ' +
  `A suite passes only if its command exits 0.${measuring}${requesterContext}`

// Every failing test, tagged with its suite; a suite that failed without naming a test still counts as one failure.
const failuresOf = result =>
  result.suites.flatMap(entry =>
    entry.passed && entry.failures.length === 0
      ? []
      : entry.failures.length > 0
        ? entry.failures.map(found => ({ suite: entry.name, test: found.test, file: found.file, message: found.message }))
        : [{ suite: entry.name, test: `(suite ${entry.name})`, file: '', message: 'The suite did not pass and named no failing test; read its full output.' }],
  )
const keyOf = list => list.map(found => `${found.suite}|${found.file}|${found.test}`).sort().join('\n')

// Group by test file, biggest groups first, into at most `limit` clusters; files beyond the limit fold into the clusters, never dropped.
const clustersOf = (list, limit) => {
  const groups = new Map()
  for (const found of list) groups.set(found.file, [...(groups.get(found.file) || []), found])
  const ordered = [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
  const clusters = []
  ordered.forEach(([file, items], index) => {
    if (index < limit) clusters.push({ file, items: [...items] })
    else clusters[index % limit].items.push(...items)
  })
  return clusters
}

const fixerPrompt = (cluster, round) =>
  `You are repairing failing tests, round ${round}. Never commit, push, switch branches or stage secrets: leave every change in the working tree. Follow the project's own rules (CLAUDE.md and .claude/rules); read them, do not ask for them.\n\n` +
  `Failing tests:\n${cluster.items.map(found => `- [${found.suite}] ${found.file || '(no file)'}: ${found.test}: ${found.message}`).join('\n')}\n\n` +
  `The suites and their commands:\n${commandList}\n${requesterContext}\n` +
  '1. Reproduce first: run the failing test on its own and read the real error.\n' +
  '2. Find the root cause. "Flake" is not a root cause: look for shared state, ordering, time, randomness or a real race, and fix that. Classify it: test-bug (the test is wrong or stale), product-bug (the code is wrong: fix the code, the failing test is your red), environment (something outside the repository, such as a missing tool or network: change nothing, say what is needed in `blocker`) or unknown (change nothing and say what you tried in `blocker`).\n' +
  '3. Never skip, disable, delete or loosen a test, and never add a sleep or a retry to get green. A test may change only when its expectation is truly wrong, and say why in `evidence`.\n' +
  '4. Re-run the test you fixed and the other tests in its file, and put what you saw in `evidence`. Stay inside these failures.'

// ── Run ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
phase('Run')
log(`workflow-test (${size}): ${commands.length} command(s), up to ${plan.rounds} repair round(s).`)
const first = await spawn(runPrompt('Run'), { effort: 'low', schema: RESULT, phase: 'Run', label: 'run' })
if (!first) notes.push('The run agent did not complete, so the test status is unknown.')
else if (first.suites.length === 0 || first.problem.trim()) notes.push(`The commands could not be run: ${reason(first.problem) || 'no suite was reported'}.`)

let current = first && first.suites.length > 0 ? first : null
const rounds = []

if (current && failuresOf(current).length > 0) {
  phase('Repair')
  for (let round = 1; round <= plan.rounds; round++) {
    const failing = failuresOf(current)
    if (failing.length === 0) break
    const room = plan.maxAgents - used - 1 // the verify agent of this round is reserved
    if (room < 1) {
      notes.push(`Round ${round} skipped: the agent budget has no room for a repair and its verification.`)
      break
    }
    const clusters = clustersOf(failing, Math.min(plan.clusters, room))
    const record = { round, clusters: [] }
    rounds.push(record)
    let changedAnything = false
    for (const cluster of clusters) {
      const where = cluster.file || '(no file)'
      const done = await spawn(fixerPrompt(cluster, round), { agentType: fixerType, schema: FIX, phase: 'Repair', label: `fix ${where} (round ${round})` })
      if (!done) {
        notes.push(`The fix for ${where} did not complete.`)
        record.clusters.push({ file: where, failures: cluster.items.length, classification: 'unknown', rootCause: '', fixed: false, filesChanged: [], blocker: 'The repair agent did not complete.' })
        continue
      }
      if (!done.fixed || done.filesChanged.length === 0) notes.push(`${where}: ${done.classification}, not fixed${reason(done.blocker) ? `: ${reason(done.blocker)}` : ''}.`)
      if (done.filesChanged.length > 0) changedAnything = true
      record.clusters.push({ file: where, failures: cluster.items.length, classification: done.classification, rootCause: done.rootCause, fixed: done.fixed, filesChanged: done.filesChanged, blocker: done.blocker })
    }
    if (!changedAnything) {
      record.remainingAfter = failing.length
      break // nothing was changed, so a re-run would only repeat the same failures
    }
    const before = keyOf(failing)
    const checked = await spawn(runPrompt('Re-run'), { effort: 'low', schema: RESULT, phase: 'Verify', label: `verify (round ${round})` })
    if (!checked) {
      notes.push('The verify agent did not complete, so the state after the repairs is unknown.')
      current = null
      break
    }
    current = checked
    record.remainingAfter = failuresOf(checked).length
    if (failuresOf(checked).length > 0 && keyOf(failuresOf(checked)) === before) {
      notes.push(`No progress after round ${round}: the same failures remain, so the loop stopped.`)
      break
    }
  }
}

const remaining = current ? failuresOf(current) : []
const coverage = current ? current.coverage : first && first.coverage ? first.coverage : { measured: false, percent: 0, lowFiles: [] }
let verdict
if (!current) verdict = 'Unknown'
else if (remaining.length > 0) verdict = 'Red'
else if (target === null) verdict = 'Green'
else if (!coverage.measured) {
  notes.push('The coverage could not be measured, so the target is unchecked.')
  verdict = 'Unknown'
} else verdict = coverage.percent < target ? 'Below Target' : 'Green'

return {
  workflow: 'workflow-test',
  size,
  agents: used,
  verdict,
  suites: current ? current.suites.map(entry => ({ name: entry.name, command: entry.command, passed: entry.passed, total: entry.total, failed: entry.failed })) : [],
  coverage: target === null ? null : { ...coverage, target },
  remaining,
  rounds,
  notes,
}
