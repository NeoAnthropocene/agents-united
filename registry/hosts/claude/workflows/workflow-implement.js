export const meta = {
  name: 'workflow-implement',
  description: 'Implement a change as ordered tasks, test-first: implement, review each task against its spec, fix within a cap, then an independent typecheck and test gate and a whole-branch review',
  whenToUse: 'A change with three or more independent slices, or one too large for a single specialist. Pass args.tasks (an array of { title, spec }); the orchestrator splits the work first.',
  phases: [
    { title: 'Build', detail: 'one task at a time: implement, review against the spec, fix within the cap' },
    { title: 'Gate', detail: 'typecheck and tests run independently, and a whole-branch review, in parallel' },
  ],
}

// Input (args): { tasks: { title?: string, spec: string, specialist?: 'backend' | 'frontend', files?: string[] }[] (required),
//                 size?: 'small' | 'medium' | 'large', context?: string, typecheckCommand?: string, testCommand?: string }
// Tasks run one after another in the given order, because they share one working tree and later tasks build on earlier ones.
// Default size is 'small': 4 agents, the Pro-plan baseline (fewer than 5): up to 2 tasks, each with one implementer, then the gate.
// 'medium' is at most 9 agents (up to 4 tasks, one fix round per task) and 'large' at most 23 (up to 8 tasks, two fix rounds).
// A review or fix only runs when the agent budget still has room after the implementers still to come and the gate; every skip is reported.
// Nothing is committed: the changes stay in the working tree for the orchestrator to review and commit.

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']
const GATE_AGENTS = 2 // the checks and the final review are always paid for when anything was implemented

const SIZES = {
  small: { maxTasks: 2, maxAgents: 4, fixRounds: 0 },
  medium: { maxTasks: 4, maxAgents: 9, fixRounds: 1 },
  large: { maxTasks: 8, maxAgents: 23, fixRounds: 2 },
}

const SPECIALISTS = { backend: 'backend-architect', frontend: 'frontend-architect' }

const IMPLEMENTATION = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['done', 'blocked'] },
    summary: { type: 'string' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    red: { type: 'string' },
    typecheckPassed: { type: 'boolean' },
    testsPassed: { type: 'boolean' },
    concerns: { type: 'array', items: { type: 'string' } },
    blocker: { type: 'string' },
  },
  required: ['status', 'summary', 'filesChanged', 'red', 'typecheckPassed', 'testsPassed', 'concerns', 'blocker'],
  additionalProperties: false,
}
const ISSUE = {
  type: 'object',
  properties: {
    severity: { type: 'string', enum: SEVERITIES },
    file: { type: 'string' },
    line: { type: 'integer' },
    title: { type: 'string' },
    detail: { type: 'string' },
  },
  required: ['severity', 'file', 'line', 'title', 'detail'],
  additionalProperties: false,
}
const REVIEW = {
  type: 'object',
  properties: { specCompliant: { type: 'boolean' }, issues: { type: 'array', items: ISSUE } },
  required: ['specCompliant', 'issues'],
  additionalProperties: false,
}
const CHECKS = {
  type: 'object',
  properties: { typecheckPassed: { type: 'boolean' }, testsPassed: { type: 'boolean' }, output: { type: 'string' } },
  required: ['typecheckPassed', 'testsPassed', 'output'],
  additionalProperties: false,
}

const request = args && typeof args === 'object' && !Array.isArray(args) ? args : {}
const given = Array.isArray(request.tasks) ? request.tasks : []
const valid = given.length > 0 && given.every(task => task && typeof task === 'object' && typeof task.spec === 'string' && task.spec.trim() !== '')
if (!valid) {
  log('workflow-implement needs args.tasks, a non-empty array of { title, spec } with a spec for every task.')
  return { workflow: 'workflow-implement', error: 'args.tasks must be a non-empty array of tasks, each with a non-empty spec' }
}

const size = typeof request.size === 'string' && Object.prototype.hasOwnProperty.call(SIZES, request.size) ? request.size : 'small'
const plan = SIZES[size]
const typecheckCommand = typeof request.typecheckCommand === 'string' && request.typecheckCommand.trim() ? request.typecheckCommand.trim() : 'npm run typecheck'
const testCommand = typeof request.testCommand === 'string' && request.testCommand.trim() ? request.testCommand.trim() : 'npm test'
const requesterContext = typeof request.context === 'string' && request.context ? `\nContext from the requester: ${request.context}\n` : ''

const rank = severity => SEVERITIES.indexOf(severity)
const isBlocking = found => rank(found.severity) <= 1
const unique = list => [...new Set(list)]
// A blocker is free text: drop its trailing punctuation so a note can add its own.
const reason = text => String(text).trim().replace(/[.;:,\s]+$/, '')
const tasks = given.map((task, index) => ({
  id: `T${index + 1}`,
  title: typeof task.title === 'string' && task.title.trim() ? task.title.trim() : `Task ${index + 1}`,
  spec: task.spec.trim(),
  hints: Array.isArray(task.files) ? task.files.filter(file => typeof file === 'string' && file) : [],
  agentType: typeof task.specialist === 'string' && Object.prototype.hasOwnProperty.call(SPECIALISTS, task.specialist) ? SPECIALISTS[task.specialist] : SPECIALISTS.backend,
}))

let used = 0
const notes = []
const records = []
const changed = [] // every file a task reports changing, first seen first

const spawn = (prompt, options) => {
  used += 1
  return agent(prompt, options)
}
// What is left for optional work: the budget, less the implementers still to come and the gate.
const room = tasksAfter => plan.maxAgents - used - tasksAfter - GATE_AGENTS

const rules =
  'Follow the project\'s own rules (CLAUDE.md and .claude/rules); read them, do not ask for them. Never commit, push, switch branches or stage secrets ' +
  '(.env, keys, tokens): leave every change in the working tree.'

const selfReported = report => {
  const failed = [report.typecheckPassed ? '' : 'typecheck', report.testsPassed ? '' : 'tests'].filter(Boolean)
  return failed.length === 0
    ? []
    : [{ severity: 'HIGH', file: '', line: 0, title: 'Implementer reported failing checks', detail: `The implementer reports that ${failed.join(' and ')} did not pass.` }]
}
const blockingOf = review => {
  const found = review.issues.filter(isBlocking)
  return found.length === 0 && !review.specCompliant
    ? [{ severity: 'HIGH', file: '', line: 0, title: 'Not spec-compliant', detail: 'The reviewer judged the task not spec-compliant without naming an issue.' }]
    : found
}
const listIssues = list => list.map(found => `- [${found.severity}] ${found.file}${found.line ? `:${found.line}` : ''} ${found.title}: ${found.detail}`).join('\n')

const implementerPrompt = (task, earlier) =>
  `You are implementing ONE task of a larger change, test-first. ${rules}\n\n` +
  `Task ${task.id}: ${task.title}\nSpec:\n${task.spec}\n` +
  (task.hints.length > 0 ? `Files likely involved: ${task.hints.join(', ')}\n` : '') +
  `Already changed by earlier tasks in this run: ${earlier.length > 0 ? earlier.join(', ') : 'nothing yet'}\n${requesterContext}\n` +
  '1. Red: write or update the failing test first, run it, and put its failing output in `red`.\n' +
  '2. Green: the minimal implementation that passes. Then refactor with the tests green.\n' +
  `3. Stay inside this task: the other tasks belong to other agents.\n4. Run \`${typecheckCommand}\` and \`${testCommand}\` and report what you saw in typecheckPassed and testsPassed; never claim a pass you did not see.\n` +
  '5. If the spec is ambiguous or you cannot proceed, return status "blocked" with the blocker; do not guess.'

const reviewerPrompt = (task, files) =>
  `You are an independent, read-only reviewer of ONE task. The implementer's report may be incomplete or optimistic: do not trust it, read the code and the tests.\n\n` +
  `Task ${task.id}: ${task.title}\nSpec:\n${task.spec}\nFiles the implementer reports changing: ${files.length > 0 ? files.join(', ') : 'none reported'}\n\n` +
  'Check (1) every requirement of the spec is implemented, (2) nothing was built that the spec did not ask for, (3) quality: the tests assert behaviour and cover the negative cases, no unsafe type assertions, module boundaries respected. ' +
  'Set specCompliant to false when something required is missing or something out of scope was added. CRITICAL and HIGH issues block the task; MEDIUM, LOW and INFO do not. Change nothing.'

const fixerPrompt = (task, open) =>
  `You are fixing review findings on task ${task.id}: ${task.title}. ${rules}\n\nSpec:\n${task.spec}\n\nFix ONLY these blocking issues, test-first wherever behaviour changes:\n${listIssues(open)}\n\n` +
  `Run \`${typecheckCommand}\` and \`${testCommand}\` afterwards and report what you saw. If you cannot fix an issue, return status "blocked" with the blocker.`

// ── Build ────────────────────────────────────────────────────────────────────────────────────────────────────────────
phase('Build')
const runnable = tasks.slice(0, plan.maxTasks)
const overflow = tasks.slice(plan.maxTasks)
if (overflow.length > 0) {
  notes.push(`${overflow.map(task => task.id).join(', ')} not run: size ${size} allows ${plan.maxTasks} tasks. Run them in a second pass or choose a larger size.`)
  log(notes[notes.length - 1])
}
log(`workflow-implement (${size}): ${runnable.length} task(s), budget ${plan.maxAgents} agents.`)

const unreviewed = []
const unfixed = []
let halted = false

for (let index = 0; index < runnable.length; index++) {
  const task = runnable[index]
  const record = { id: task.id, title: task.title, status: 'not-started', summary: '', filesChanged: [], fixRounds: 0, open: [], minor: [], concerns: [], blocker: '' }
  records.push(record)
  if (halted) continue

  const built = await spawn(implementerPrompt(task, changed), { agentType: task.agentType, schema: IMPLEMENTATION, phase: 'Build', label: `implement ${task.id}` })
  if (!built || built.status === 'blocked') {
    record.status = 'blocked'
    record.blocker = built ? built.blocker : 'The implementer did not complete.'
    notes.push(`${task.id} is blocked: ${reason(record.blocker)}. The remaining tasks were not started.`)
    halted = true
    continue
  }
  record.summary = built.summary
  record.concerns = built.concerns
  record.filesChanged = unique(built.filesChanged)
  changed.push(...built.filesChanged.filter(file => !changed.includes(file)))

  const tasksAfter = runnable.length - 1 - index
  let carried = selfReported(built)
  let open = carried
  let reviewed = false
  let fixes = 0
  let lastKey = ''
  for (;;) {
    if (room(tasksAfter) < 1) {
      if (!reviewed) unreviewed.push(task.id)
      else unfixed.push(task.id)
      break
    }
    const review = await spawn(reviewerPrompt(task, record.filesChanged), {
      agentType: 'code-reviewer',
      effort: 'high',
      schema: REVIEW,
      phase: 'Build',
      label: `review ${task.id} (round ${fixes + 1})`,
    })
    if (!review) {
      notes.push(`The ${task.id} reviewer did not complete, so that task is not reviewed.`)
      break
    }
    reviewed = true
    open = [...carried, ...blockingOf(review)]
    record.minor = review.issues.filter(found => !isBlocking(found))
    if (open.length === 0) break
    const key = open.map(found => found.title).sort().join('|')
    if (fixes > 0 && key === lastKey) {
      notes.push(`${task.id}: no progress after fix round ${fixes}; the same blocking issues remain, so the loop stopped.`)
      break
    }
    lastKey = key
    if (fixes >= plan.fixRounds) break
    if (room(tasksAfter) < 1) {
      unfixed.push(task.id)
      break
    }
    const fixed = await spawn(fixerPrompt(task, open), { agentType: task.agentType, schema: IMPLEMENTATION, phase: 'Build', label: `fix ${task.id} (round ${fixes + 1})` })
    fixes += 1
    if (!fixed || fixed.status === 'blocked') {
      notes.push(`The ${task.id} fix did not complete${fixed && reason(fixed.blocker) ? `: ${reason(fixed.blocker)}` : ''}; the blocking issues stay open.`)
      break
    }
    record.filesChanged = unique([...record.filesChanged, ...fixed.filesChanged])
    changed.push(...fixed.filesChanged.filter(file => !changed.includes(file)))
    carried = selfReported(fixed)
    open = carried
  }
  record.fixRounds = fixes
  record.open = open
  record.status = open.length > 0 ? 'open' : reviewed ? 'accepted' : 'unreviewed'
}

for (const task of overflow) records.push({ id: task.id, title: task.title, status: 'not-run', summary: '', filesChanged: [], fixRounds: 0, open: [], minor: [], concerns: [], blocker: '' })
if (unreviewed.length > 0) notes.push(`Not reviewed individually (agent budget): ${unreviewed.join(', ')}. The final review covers the whole change.`)
if (unfixed.length > 0) notes.push(`Blocking issues left unfixed or not re-reviewed (agent budget): ${unfixed.join(', ')}.`)

// ── Gate ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
phase('Gate')
const implemented = records.filter(record => !['blocked', 'not-started', 'not-run'].includes(record.status))
let checks = null
let finalReview = null
if (implemented.length === 0) {
  notes.push('Nothing was implemented, so the checks and the final review were not run.')
} else {
  const specs = tasks.filter(task => implemented.some(record => record.id === task.id)).map(task => `${task.id} ${task.title}: ${task.spec}`).join('\n')
  const [ran, reviewedAll] = await parallel([
    () =>
      spawn(
        `Run exactly these commands from the repository root and report the result. Do not fix anything and do not change any file.\n1. ${typecheckCommand}\n2. ${testCommand}\n` +
          'Report whether each passed. In `output`, put the most relevant failing lines (at most 60), or an empty string when both passed.',
        { effort: 'low', schema: CHECKS, phase: 'Gate', label: 'checks' },
      ),
    () =>
      spawn(
        `You are an independent, read-only reviewer of a whole change made by several agents. Do not trust their reports; read the code.\n\nThe tasks:\n${specs}\n\n` +
          `Files changed:\n${changed.map(file => `- ${file}`).join('\n')}\n${requesterContext}\n` +
          'Look for what no single-task review can see: tasks that contradict or duplicate each other, a broken seam between them, spec requirements nobody implemented, scope creep, and missing or mock-only tests. ' +
          'CRITICAL and HIGH issues block; set specCompliant to false when a requirement is missing. Change nothing.',
        { agentType: 'code-reviewer', effort: 'high', schema: REVIEW, phase: 'Gate', label: 'final review' },
      ),
  ])
  checks = ran
  if (!ran) notes.push('The checks agent did not complete, so the typecheck and test status is unknown.')
  if (reviewedAll) {
    finalReview = { specCompliant: reviewedAll.specCompliant, blocking: blockingOf(reviewedAll), minor: reviewedAll.issues.filter(found => !isBlocking(found)) }
  } else {
    notes.push('The final review did not complete, so the whole change is not reviewed.')
  }
}

const verdict = records.some(record => record.status === 'blocked')
  ? 'Blocked'
  : records.some(record => record.status === 'not-run')
    ? 'Incomplete'
    : records.some(record => record.status === 'open') ||
        !checks ||
        !checks.typecheckPassed ||
        !checks.testsPassed ||
        !finalReview ||
        finalReview.blocking.length > 0
      ? 'Needs Work'
      : 'Ready'

return { workflow: 'workflow-implement', size, agents: used, verdict, tasks: records, filesChanged: changed, checks, finalReview, notes }
