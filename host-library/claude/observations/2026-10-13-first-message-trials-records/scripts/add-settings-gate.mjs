// Registers the mode-line gate script as a SETTINGS-level PreToolUse hook in a scratch folder (.claude/settings.local.json), for the first-message experiment of 2026-10-13.
// Why: `claude -p` skips the frontmatter hooks of a project agent (ADR 0042, "It cannot be measured headless"), but it trusts the hooks of the settings files, so this lets a headless
// run meet the SAME script (the installed .claude/hooks/agents-united-mode-line-gate.js) that the lead's own frontmatter hook runs in an interactive sitting. The script exempts every call that carries an
// agent_id, so only the main thread (the lead) is gated, as with the frontmatter hook. It is for the scratch folders fm\*; the real install is not touched.
// usage: node add-settings-gate.mjs <folder>
import fs from 'node:fs';
import path from 'node:path';

const folder = process.argv[2];
if (!folder) { console.error('usage: node add-settings-gate.mjs <folder>'); process.exit(2); }
const script = path.join(folder, '.claude', 'hooks', 'agents-united-mode-line-gate.js');
if (!fs.existsSync(script)) { console.error(`No gate script at ${script}`); process.exit(1); }
const file = path.join(folder, '.claude', 'settings.local.json');
const settings = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
settings.hooks = settings.hooks || {};
settings.hooks.PreToolUse = settings.hooks.PreToolUse || [];
const reference = '${CLAUDE_PROJECT_DIR}/.claude/hooks/agents-united-mode-line-gate.js';
if (!settings.hooks.PreToolUse.some(group => (group.hooks || []).some(hook => (hook.args || []).includes(reference)))) {
  settings.hooks.PreToolUse.push({ matcher: '*', hooks: [{ type: 'command', command: 'node', args: [reference] }] });
}
fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
console.log(`gate registered in ${file}`);
