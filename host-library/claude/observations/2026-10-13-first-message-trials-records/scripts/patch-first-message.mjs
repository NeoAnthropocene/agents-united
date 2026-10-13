// Patches the lead's section "The first message: the mode line" of an installed digital-agency team, for the first-message experiment of 2026-10-13.
//   a : the order of ADR 0051 stays (searches, then the line, then the first other call), the welcome is gone: the second message is the Operation Mode information and nothing else of the lead's.
//   b : the Operation Mode information is the lead's FIRST message, before any call, filled in from the list of deferred tools that the session gives it at its start;
//       the searches that check it and the one that loads the task tools are in the same message.
//   c : as b, with the load of the task tools kept as a message of its own (so the first other call is two round trips after the line), and a No welcome paragraph that names what to leave out and how to answer a bare greeting.
//   d : as c, with the forms in which each integration's tools are named (a plugin or a claude.ai connector has another prefix), after variant c put Firecrawl under Missing in 3 of 5 runs because the connector is named mcp__claude_ai_Firecrawl__.
//   e : the order of variant a (the line in the second message, after the searches, so that it is accurate), the No welcome paragraph of c and d, and a sentence about the hook that waits for the saved transcript.
// All drop "Under the line, introduce yourself as Chris and name your team." and say that there is no greeting, no welcome and no introduction.
// Every replacement must match exactly once, or the script stops: a variant that did not take its text would test the wrong thing.
import fs from 'node:fs';
import path from 'node:path';

const [folder, variant] = process.argv.slice(2);
if (!folder || !['a', 'b', 'c', 'd', 'e'].includes(variant)) { console.error('usage: node patch-first-message.mjs <folder> a|b|c|d|e'); process.exit(2); }
const file = path.join(folder, '.claude', 'agents', 'orchestrator-digital-agency.md');
let text = fs.readFileSync(file, 'utf8');
const eol = text.includes('\r\n') ? '\r\n' : '\n';
text = text.replace(/\r\n/g, '\n');

const once = (from, to) => {
  const parts = text.split(from);
  if (parts.length !== 2) { console.error(`expected exactly one match, found ${parts.length - 1}: ${from.slice(0, 90)}...`); process.exit(1); }
  text = parts.join(to);
};

const INTRO = ' Under the line, introduce yourself as Chris and name your team.';
once(INTRO, '');

const TASKS = '(`select:TaskCreate,TaskList,TaskUpdate,SendMessage`, see "The shared task list")';
const OLD_ORDER = '**In order.** Your first message holds `ToolSearch` calls and nothing else: one for each of the six integrations, MarkItDown and Stitch. '
  + 'Your second message opens with the mode line, as a text block, then the introduction, and holds one `ToolSearch` that checks for and loads the task tools and `SendMessage` '
  + TASKS + ' and no other call. '
  + 'Your first other call is in the third message: the host has saved the line by then, so the hook holds nothing and the user sees no error (ADR 0051).';

const NO_WELCOME = 'There is no welcome: no greeting, no "welcome", no introduction of yourself or of the team, in this message or the next one. The line is the whole of your first words to the user, and the plan starts from the brief.';

if (variant === 'a') {
  once(OLD_ORDER,
    '**In order.** Your first message holds `ToolSearch` calls and nothing else: one for each of the six integrations, MarkItDown and Stitch. '
    + 'Your second message is the Operation Mode information: the mode line, as a text block, and no other words of yours to the user. It also holds one `ToolSearch` that checks for and loads the task tools and `SendMessage` '
    + TASKS + ' and no other call. ' + NO_WELCOME + ' '
    + 'Your first other call is in the third message: the host has saved the line by then, so the hook holds nothing and the user sees no error (ADR 0051).');
} else if (variant === 'e') {
  once(OLD_ORDER,
    '**In order.** Your first message holds `ToolSearch` calls and nothing else: one for each of the six integrations, MarkItDown and Stitch. '
    + 'Your second message is the Operation Mode information: the mode line, as a text block, and no other words of yours to the user. It also holds one `ToolSearch` that checks for and loads the task tools and `SendMessage` ' + TASKS + ' and no other call. '
    + 'Your first other call is in the third message. The hook looks for the line in the saved transcript, which the host writes a few seconds late, and it waits for the file before it holds anything: a hold means that the line is not there (ADR 0052). '
    + '**No welcome.** The line is the whole of your opening. Do not greet the user, do not welcome them, do not say who you are (no "I\'m Chris", no "your digital agency lead"), and do not list the team or what you can do, unless they ask. If the user only says hello, follow the line with one short question about what they want to work on, and nothing else.');
} else if (variant === 'c' || variant === 'd') {
  once(OLD_ORDER,
    '**In order.** Your first message opens with the mode line, as a text block, before any call: it is the Operation Mode information. '
    + 'Fill it in from the list of deferred tools that your session gave you at its start (tool names only, in the first system reminder): a required integration is callable when a tool of its server is in that list, and missing when none is; MarkItDown and Stitch are extras when a tool of theirs is. '
    + (variant === 'd' ? 'The tools of a server carry one of these prefixes: GitHub `mcp__github__` or `mcp__plugin_github_github__`; Firecrawl `mcp__firecrawl__` or `mcp__claude_ai_Firecrawl__`; Context7 `mcp__context7__` or `mcp__plugin_context7_context7__`; Playwright `mcp__playwright__` or `mcp__plugin_playwright_playwright__`; Chrome DevTools `mcp__chrome-devtools-mcp__` or `mcp__plugin_chrome-devtools-mcp_chrome-devtools__`; Figma `mcp__figma__` or `mcp__plugin_figma_figma__`; MarkItDown `mcp__markitdown__`; Stitch `mcp__stitch__`. ' : '')
    + 'The same message then holds the `ToolSearch` calls that check it: one for each of the six integrations, MarkItDown and Stitch. '
    + 'Your second message holds one `ToolSearch` that checks for and loads the task tools and `SendMessage` ' + TASKS + ' and no other call. '
    + 'Your first other call is in the third message: the host has saved the line by then, so the hook holds nothing and the user sees no error (ADR 0051). '
    + 'If a search shows that the line was wrong, correct it in one sentence in your next message to the user. '
    + '**No welcome.** The line is the whole of your opening. Do not greet the user, do not welcome them, do not say who you are (no "I\'m Chris", no "your digital agency lead"), and do not list the team or what you can do, unless they ask. If the user only says hello, follow the line with one short question about what they want to work on, and nothing else.');
} else {
  once(OLD_ORDER,
    '**In order.** Your first message opens with the mode line, as a text block, before any call. It is the Operation Mode information, and the only words of yours to the user in that message. '
    + 'Fill it in from the list of deferred tools that your session gave you at its start (tool names only, in the first system reminder): a required integration is callable when a tool of its server is in that list, and missing when none is; MarkItDown and Stitch are extras when a tool of theirs is. '
    + 'The same message then holds the `ToolSearch` calls that check it, one for each of the six integrations, MarkItDown and Stitch, and the one that checks for and loads the task tools and `SendMessage` '
    + TASKS + '. ' + NO_WELCOME + ' '
    + 'Your first other call is in a later message: the host has saved the line by then, so the hook holds nothing and the user sees no error (ADR 0051). If a search shows that the line was wrong, say so in one sentence in your next message.');
}

fs.writeFileSync(file, text.replace(/\n/g, eol));
console.log(`patched ${path.relative(process.cwd(), file) || file} as variant ${variant}`);
