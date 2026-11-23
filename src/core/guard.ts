/**
 * Plan 022 H5 / Plan 023 A0 — the managed PreToolUse guard, single-sourced for every lane that
 * wires it (role frontmatter today; the plain-session settings entry in Plan 023 A1–A2).
 *
 * Verified against the Claude Code references: frontmatter hooks fire for spawned subagents and
 * for `--agent` main sessions; a command hook exiting 2 blocks the call and its stderr is shown as
 * the reason. EXEC FORM (Plan 023 A0): `command` + `args` is spawned directly with no shell. The
 * earlier shell form (`node -e '<js>'`) runs under PowerShell on Windows without Git Bash, whose
 * native-argument quoting can mangle the script and let the guarded command through (fail open).
 * The script blocks `git push --force`/`-f` (not `--force-with-lease`), `vercel --prod`, and
 * `.env*` writes (not `.env.example`) via Write, Edit or MultiEdit (target in `tool_input.file_path`), NotebookEdit (target in
 * `tool_input.notebook_path`; the script reads `file_path`, else `notebook_path`) or a shell redirect.
 *
 * ADR 0074 adds the common forms of destructive shell commands, for Bash and PowerShell alike: a recursive delete (rm, Remove-Item, rd, del,
 * rimraf) of a root, home or project folder (`/`, `~`, `$HOME`, `.`, `..`, `*`, `.git`, a drive root, a system folder), privilege escalation
 * (sudo, doas, pkexec, runas, su, `Start-Process -Verb RunAs`), shutdown and reboot, `az group delete`, `gcloud projects delete`, an AWS
 * account closure, and disk formatting (mkfs, dd of=/dev/, format X:, diskpart). These match only where a command starts (after `;`, `&&`, `||`,
 * `|`, `(`, `$(`, a backtick or a newline, behind wrappers such as env, nohup, timeout and xargs, and inside the `-c`/`-Command`/`/c` string of a shell or `eval`), so
 * `echo rm -rf /` and `git commit -m "sudo fix"` pass; the three rules above keep matching anywhere. It is a seat belt against a model's slip,
 * not a security boundary: variables, aliases, interpreters, encoded commands and scripts written to a file then run are not seen.
 *
 * Input it cannot read (empty or white space, not JSON, or JSON that is not an object) is blocked with exit 2 and a message that
 * starts `Blocked by agents-united guard: unreadable hook input` (the maintainer's decision of 2026-11-17). A BOM is trimmed first.
 * A valid object, including `{}` and one without `tool_input`, is read as before.
 *
 * Testing this by hand? Asking a session hypothetically tests the model, not the hook — see
 * `docs/guard-testing.md` (Plan 024 S5) for a model-proof test protocol.
 */
export function guardScript(): string {
  // The session guard (`session-guard.ts`) does not call this with text: it builds its script by inserting its hint after the unreadable-input sentence of GUARD_SCRIPT.
  return String.raw`let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{let i;try{i=JSON.parse(s.trim())}catch(e){}if(i===null||typeof i!=="object"||Array.isArray(i)){process.stderr.write("Blocked by agents-united guard: unreadable hook input. The input of this tool call could not be read, so the guard cannot tell whether it is safe.\n");process.exit(2)}const t=i.tool_input||{},c=String(t.command||""),f=String(t.file_path||t.notebook_path||"").replace(/\\/g,"/");
const ps=i.tool_name==="PowerShell",AS=/^[A-Za-z_]\w*=/;
const KW=new Set(["{","!","then","do","else","if","while","until"]),W=new Set(["env","command","exec","nohup","time","builtin","xargs","nice","timeout",...KW]),A=new Set(["sudo","doas","pkexec","runas"]),S=new Set(["shutdown","reboot","halt","poweroff","stop-computer","restart-computer"]),SH=new Set(["bash","sh","zsh","dash","ksh","fish","pwsh","powershell","cmd","eval"]);
const B=w=>(/^([\/\\]|[A-Za-z]:[\/\\])/.test(w)?w.replace(/^.*[\/\\]/,""):w).replace(/\.exe$/i,"").toLowerCase();
const K=s=>{const o=[];let t="",q="";for(let i=0;i<s.length;i++){const h=s[i];if(q){if(h===q)q="";else t+=h}else if(h==='"'||h==="'")q=h;else if(/\s/.test(h)){if(t){o.push(t);t=""}}else t+=h}if(t)o.push(t);return o.map(h=>h.replace(/\u0002/g,"(").replace(/\u0003/g,")"))};
const Z=(k,a)=>{while(a<k.length){const w=B(k[a]);if(AS.test(k[a])){a++;continue}if(!W.has(w))return a;if(w==="command"&&/^-[vV]$/.test(k[a+1]||""))return a;a++;if(KW.has(w))continue;const v=w==="env"?/^-[uSCP]$/:w==="timeout"?/^-[sk]$/:w==="nice"?/^-n$/:w==="xargs"?/^-[IJnPLdEsa]$/:null;while(a<k.length&&k[a][0]==="-")a+=v&&v.test(k[a])?2:1;if(w==="timeout")a++}return a};
const Y=h=>{h=h.slice(Math.max(h.lastIndexOf(";"),h.lastIndexOf("&"),h.lastIndexOf("|"),h.lastIndexOf("\n"),h.lastIndexOf("("))+1);const k=K(h);return SH.has(B(k[Z(k,0)]||""))};
const F=h=>h.length<64&&/^-[a-z]*r[a-z]*$/i.test(h);
const X=x=>{if(x.length>4096)return false;let p=x.replace(/\\/g,"/").replace(/\/\*+$/,""),e=p.length;while(e>0&&p[e-1]==="/")e--;p=e?p.slice(0,e):"/";return /^(\/|~|\$home|\$\{home\}|\$env:userprofile|%userprofile%|\.\.?|\*|\.git|[a-z]:|\/(bin|boot|dev|etc|home|lib\w*|opt|root|sbin|usr|var)|[a-z]:\/(windows|users|program files( \(x86\))?|programdata))$/.test(p.toLowerCase())};
const U=b=>{let o="",d=0;for(let k=0;k<b.length;k++){const h=b[k];if(!ps&&h==="\\"&&k+1<b.length){const g=b[++k];o+=h+(";&|\n\`()$\"".includes(g)?(g==="("?"\u0002":g===")"?"\u0003":"\u0001"):g)}else if(h==="$"&&b[k+1]==="("){o+="$(";k++;d++}else if(h==="("&&d>0){o+=h;d++}else if(h===")"&&d>0){o+=h;d--}else if(d===0&&";&|\n()".includes(h))o+=h==="("?"\u0002":h===")"?"\u0003":"\u0001";else o+=h}return o};
const Hd=(x,Q)=>{const re=/(?<!<)<<(?!<)(-?)[ \t]*(?:"([^"\n]*)"|'([^'\n]*)'|([A-Za-z_][\w.-]*))/g;let o="",p=0,m,le=-2,bud=200000;
while((m=re.exec(x))!==null){const dl=m[2]??m[3]??m[4];if(le<re.lastIndex)le=x.indexOf("\n",re.lastIndex);const eo=le;if(eo<0)break;
let s=eo+1,e=s,f=-1,c=0;while(e<=x.length&&c<5000&&bud>0){c++;bud--;const ne=x.indexOf("\n",e),ln=x.slice(e,ne<0?x.length:ne).replace(/\r$/,"");if((m[1]?ln.replace(/^\t+/,""):ln)===dl){f=e;break}if(ne<0)break;e=ne+1}
if(f<0)continue;const be=f,pre=x.slice(Math.max(0,m.index-200),m.index),cut=Math.max(pre.lastIndexOf(";"),pre.lastIndexOf("&"),pre.lastIndexOf("|"),pre.lastIndexOf("("),pre.lastIndexOf("\`"),pre.lastIndexOf("\n")),k=K(pre.slice(cut+1)),a=Z(k,0);
const sh=(a<k.length&&SH.has(B(k[a])))||/\|\s*(?:[^\s|;&]*[\/\\])?(?:bash|sh|zsh|dash|ksh|fish|pwsh|powershell|cmd)(?:\.exe)?(?=\s|$)/i.test(x.slice(re.lastIndex,eo));
o+=x.slice(p,s);if(sh)Q.push(x.slice(s,be));p=be;re.lastIndex=be}
return o+x.slice(p)};
const D=(x,d)=>{const Q=[];x=Hd(x,Q).replace(/\\\r?\n/g," ").replace(/\`\r?\n/g," ").replace(/\r/g,"");const n=x.length;let z="",j=0;
while(j<n){const q=x[j];
if(q==="#"&&(j===0||/\s/.test(x[j-1]))){const e=x.indexOf("\n",j);j=e<0?n:e;continue}
if(q!=='"'&&q!=="'"){z+=q;j++;continue}
let e=j+1;while(e<n&&x[e]!==q)e+=q==='"'&&x[e]==="\\"&&!ps?2:1;
const b=x.slice(j+1,Math.min(e,n));
if(/(?:^|\s)(?:-[a-z]*c|-command|\/[ck])\s*$|(?:^|\s)eval\s*$/i.test(x.slice(Math.max(0,j-60),j))&&Y(x.slice(Math.max(0,j-200),j)))Q.push(q==='"'&&!ps?b.replace(/\\(.)/g,"$1"):b);
z+=q+(q==="'"?b.replace(/[;&|\n\`()]/g,h=>h==="("?"\u0002":h===")"?"\u0003":"\u0001"):U(b))+(e<n?q:"");j=e+1}
if(d<3)for(const p of Q){const y=D(p,d+1);if(y)return y}
for(const g of z.split(/[;&|\n\`()]|\$\(/)){const k=K(g),a=Z(k,0);if(a>=k.length)continue;
const v=B(k[a]),R=k.slice(a+1),N=R.filter(h=>h[0]!=="-").map(h=>h.toLowerCase());
if(d<3&&SH.has(v)){const ix=v==="eval"?-1:R.findIndex(h=>h.length<64&&/^(?:-[a-z]*c|-command|\/[ck])$/i.test(h));if(v==="eval"||(ix>=0&&ix<R.length-1)){const y=D(R.slice(ix+1).join(" "),d+1);if(y)return y}}
if(A.has(v)||v==="su"||(/^(start-process|saps|start)$/.test(v)&&/(^|\s)-verb[\s:=]+runas/i.test(R.join(" "))))return "sudo or another privilege escalation";
if(S.has(v)||(v==="init"&&/^[06]$/.test(N[0]||""))||(v==="systemctl"&&/^(poweroff|reboot|halt)$/.test(N[0]||"")))return "a shutdown or reboot";
const G=(u,w)=>{const o=N.indexOf(u);return o>=0&&N[o+1]===w};
if((v==="az"&&G("group","delete"))||(v==="gcloud"&&G("projects","delete"))||(v==="aws"&&/^(close-account|delete-organization)$/.test(N[N.indexOf("organizations")+1]||"")&&N.includes("organizations")))return "a cloud resource-group, project or account deletion";
if(/^mkfs(\.\w+)?$/.test(v)||v==="wipefs"||v==="diskpart"||/^(format-volume|clear-disk|initialize-disk)$/.test(v)||(v==="format"&&R.some(h=>/^[a-z]:$/i.test(h)))||(v==="dd"&&R.some(h=>h.startsWith("of=/dev/")&&!/^of=\/dev\/(null|zero|stdout|stderr|tty|fd\/\d+)$/.test(h)))||(v==="shred"&&R.some(h=>h.startsWith("/dev/"))))return "a disk or filesystem format";
if(/^(rm|rmdir|rd|del|erase|ri|remove-item|rimraf)$/.test(v)&&(v==="rimraf"||R.some(h=>F(h)||h==="--recursive"||h.toLowerCase()==="/s"))&&R.some(h=>h[0]!=="-"&&!/^\/[a-z]$/i.test(h)&&X(h)))return "a recursive delete of a root, home or project folder"}
return ""};
let r="";if(/\bgit\b[^;&|]*\bpush\b[^;&|]*(--force(?!-with-lease)\b|(^|\s)-f\b)/.test(c))r="git push --force";else if(/\bvercel\b[^;&|]*--prod\b/.test(c))r="vercel --prod";else if(/(^|\/)\.env(\.(?!example$)[^\/]+)?$/.test(f)||/>\s*(\S*\/)?\.env(\.(?!example\b)\S+)?(\s|$)/.test(c))r="a .env write";else if(c){try{r=D(c,0)}catch(e){r="a command the guard could not analyse"}}
if(r){process.stderr.write("Blocked by agents-united guard: "+r+" requires explicit human approval outside the agent session. If you mean it, run it yourself in your own terminal.\n");process.exit(2)}})`.replace(/\n\s*/g, '');
}

/** The generic script: the role guards and the legacy inline form carry exactly this text. */
export const GUARD_SCRIPT = guardScript();

/**
 * The destructive guard script as it was before it blocked unreadable input (the maintainer's decision of 2026-11-17), kept so that an
 * entry written by that version is recognised as ours and renewed. Same ownership marker as the current script. The one list: the session
 * guard (`session-guard.ts`) and the native role check (`native-guard.ts`) both read it.
 */
export const EARLIER_GUARD_SCRIPTS: readonly string[] = [
  // [0] before the unreadable-input change; [1] the script that blocked unreadable input but read only `tool_input.file_path`
  // (a NotebookEdit to a protected path went through, because it sends `notebook_path`).
  String.raw`let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{let i={};try{i=JSON.parse(s)}catch(e){}const t=i.tool_input||{},c=String(t.command||""),f=String(t.file_path||"").replace(/\\/g,"/");let r="";if(/\bgit\b[^;&|]*\bpush\b[^;&|]*(--force(?!-with-lease)\b|(^|\s)-f\b)/.test(c))r="git push --force";else if(/\bvercel\b[^;&|]*--prod\b/.test(c))r="vercel --prod";else if(/(^|\/)\.env(\.(?!example$)[^\/]+)?$/.test(f)||/>\s*(\S*\/)?\.env(\.(?!example\b)\S+)?(\s|$)/.test(c))r="a .env write";if(r){process.stderr.write("Blocked by agents-united guard: "+r+" requires explicit human approval outside the agent session.\n");process.exit(2)}})`,
  String.raw`let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{let i;try{i=JSON.parse(s.trim())}catch(e){}if(i===null||typeof i!=="object"||Array.isArray(i)){process.stderr.write("Blocked by agents-united guard: unreadable hook input. The input of this tool call could not be read, so the guard cannot tell whether it is safe.\n");process.exit(2)}const t=i.tool_input||{},c=String(t.command||""),f=String(t.file_path||"").replace(/\\/g,"/");let r="";if(/\bgit\b[^;&|]*\bpush\b[^;&|]*(--force(?!-with-lease)\b|(^|\s)-f\b)/.test(c))r="git push --force";else if(/\bvercel\b[^;&|]*--prod\b/.test(c))r="vercel --prod";else if(/(^|\/)\.env(\.(?!example$)[^\/]+)?$/.test(f)||/>\s*(\S*\/)?\.env(\.(?!example\b)\S+)?(\s|$)/.test(c))r="a .env write";if(r){process.stderr.write("Blocked by agents-united guard: "+r+" requires explicit human approval outside the agent session.\n");process.exit(2)}})`,
  // [2] the script of ADR 0068 (fail-closed on unreadable input, NotebookEdit path), before ADR 0074 added the destructive shell commands.
  String.raw`let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{let i;try{i=JSON.parse(s.trim())}catch(e){}if(i===null||typeof i!=="object"||Array.isArray(i)){process.stderr.write("Blocked by agents-united guard: unreadable hook input. The input of this tool call could not be read, so the guard cannot tell whether it is safe.\n");process.exit(2)}const t=i.tool_input||{},c=String(t.command||""),f=String(t.file_path||t.notebook_path||"").replace(/\\/g,"/");let r="";if(/\bgit\b[^;&|]*\bpush\b[^;&|]*(--force(?!-with-lease)\b|(^|\s)-f\b)/.test(c))r="git push --force";else if(/\bvercel\b[^;&|]*--prod\b/.test(c))r="vercel --prod";else if(/(^|\/)\.env(\.(?!example$)[^\/]+)?$/.test(f)||/>\s*(\S*\/)?\.env(\.(?!example\b)\S+)?(\s|$)/.test(c))r="a .env write";if(r){process.stderr.write("Blocked by agents-united guard: "+r+" requires explicit human approval outside the agent session.\n");process.exit(2)}})`,
];

/**
 * The four regex literals of the three rules every lane carries: a forced push, `vercel --prod`, and a `.env` write (by path, and by redirect).
 * They are the patterns of `EARLIER_GUARD_SCRIPTS[2]`, which the Cline plugin and the Antigravity hook copy, and they stay byte for byte in the
 * current script. The destructive shell rules of ADR 0074 are Claude-only until the other lanes are ported; the drift tests of the three lanes
 * compare each file against this constant.
 */
export const SHARED_GUARD_PATTERNS: readonly string[] = [
  String.raw`/\bgit\b[^;&|]*\bpush\b[^;&|]*(--force(?!-with-lease)\b|(^|\s)-f\b)/`,
  String.raw`/\bvercel\b[^;&|]*--prod\b/`,
  String.raw`/(^|\/)\.env(\.(?!example$)[^\/]+)?$/`,
  String.raw`/>\s*(\S*\/)?\.env(\.(?!example\b)\S+)?(\s|$)/`,
];

/** Text every version of the destructive guard script carries: the ownership marker (the read-only guard says "read-only guard", so it never matches). */
export const GUARD_OWNERSHIP_MARKER = 'Blocked by agents-united guard';

/**
 * The exec-form handler: `node -e <script>`, no shell on any OS. It carries `onFailure: 'block'` (Claude Code 2.1.295 or later; the
 * maintainer's decision of 2026-11-17): the legacy inline form and the settings-level session guard block when the script cannot run.
 */
export function guardHandler(): FailClosedHandler {
  return { type: 'command', command: 'node', args: ['-e', GUARD_SCRIPT], onFailure: 'block' };
}

/** The PreToolUse groups a projected role carries: the matchers of the native guard (`nativeGuardHooks`, the one source), so `PowerShell` and `MultiEdit` are guarded too. */
export function managedGuardHooks(): { PreToolUse: Array<{ matcher: string; hooks: ReturnType<typeof guardHandler>[] }> } {
  return nativeGuardHooks();
}

/** The two native Claude guards: the destructive-command guard (writers) and the read-only guard (roles that never mutate). */
export type NativeGuardKind = 'destructive' | 'read-only' | 'mode-line';

/**
 * Plan 032 close-out follow-up (6) — the native lane ships each guard as a script file under `.claude/hooks/`, because Claude prints
 * the whole `node -e <script>` in every block message (about 600 characters, which also reaches the model). The file is the same
 * script byte for byte (`registry/hosts/claude/hooks/<name>.js` is generated from `GUARD_SCRIPT` / `READ_ONLY_GUARD_SCRIPT` and a
 * test ties them). The role names it with `${CLAUDE_PROJECT_DIR}`, the only path placeholder a user-owned script can use, so a GLOBAL
 * install (roles in `~/.claude/agents`, where that placeholder is whichever project is open) keeps the inline guard instead.
 * A hook whose script cannot start does not block by default (it fails open). The native guard handlers therefore carry
 * `onFailure: 'block'` (Claude Code 2.1.295 or later): a guard whose script cannot run blocks the calls it guards, so the doctor still
 * warns when the file is gone (the role's shell and write tools are blocked until it is restored). The mode-line gate does not carry it.
 */
export const NATIVE_GUARD_FILES: Record<NativeGuardKind, { name: string; rel: string; reference: string }> = {
  destructive: {
    name: 'agents-united-guard',
    rel: '.claude/hooks/agents-united-guard.js',
    reference: '${CLAUDE_PROJECT_DIR}/.claude/hooks/agents-united-guard.js',
  },
  'read-only': {
    name: 'agents-united-readonly-guard',
    rel: '.claude/hooks/agents-united-readonly-guard.js',
    reference: '${CLAUDE_PROJECT_DIR}/.claude/hooks/agents-united-readonly-guard.js',
  },
  // Plan 035 N2 slice (e): not a guard of what a role may do but a gate on the lead's first message (`mode-line-gate.ts`); it rides on the same
  // script-file machinery, so it is installed, refcounted, uninstalled and checked by the doctor like the other two.
  'mode-line': {
    name: 'agents-united-mode-line-gate',
    rel: '.claude/hooks/agents-united-mode-line-gate.js',
    reference: '${CLAUDE_PROJECT_DIR}/.claude/hooks/agents-united-mode-line-gate.js',
  },
};

/** Claude Code release that introduced the hook handler field `onFailure` (host-library/claude/pages/hook/hooks.md). */
export const GUARD_ON_FAILURE_MIN_VERSION = '2.1.295';

/** A native guard handler: the exec-form command plus `onFailure: 'block'` (a failed or timed-out hook blocks the call), last in key order. */
export interface FailClosedHandler { type: 'command'; command: string; args: string[]; onFailure: 'block' }

/**
 * The exec-form handler that runs a guard script file: `node <file>`, no shell on any OS. The two guards block when their hook cannot run (`onFailure: 'block'`); the destructive guard also blocks (exit 2) a payload it cannot read, as the read-only guard does (the maintainer's decision of 2026-11-17);
 * the mode-line gate does not: it is not a guard of what a role may do, and a lead whose gate script is missing could make no tool call at all.
 */
export function guardFileHandler(kind: 'destructive' | 'read-only'): FailClosedHandler;
export function guardFileHandler(kind: NativeGuardKind): { type: 'command'; command: string; args: string[]; onFailure?: 'block' };
export function guardFileHandler(kind: NativeGuardKind): { type: 'command'; command: string; args: string[]; onFailure?: 'block' } {
  const handler = { type: 'command' as const, command: 'node', args: [NATIVE_GUARD_FILES[kind].reference] };
  return kind === 'mode-line' ? handler : { ...handler, onFailure: 'block' };
}

/** The inline (`node -e`) form of the destructive-command guard for native agents: the file handler's fail-closed field, the script embedded. */
export function nativeGuardHandler(): FailClosedHandler {
  return guardHandler();
}

/** The destructive-command guard of a native agent, as a script file (project scope): the matchers of `nativeGuardHooks`, a file handler. */
export function nativeGuardFileHooks(): { PreToolUse: Array<{ matcher: string; hooks: FailClosedHandler[] }> } {
  return { PreToolUse: nativeGuardHooks().PreToolUse.map(group => ({ matcher: group.matcher, hooks: [guardFileHandler('destructive')] })) };
}

/**
 * Plan 032 PR E — the destructive-command guard for native agents: same script and exec form, but the shell matcher
 * also covers `PowerShell` (a class-derived grant holds it on Windows, and the legacy `Bash`-only matcher would let a
 * forced push through it). `managedGuardHooks`, the guard of a projected role, returns these same groups.
 */
export function nativeGuardHooks(): { PreToolUse: Array<{ matcher: string; hooks: FailClosedHandler[] }> } {
  return {
    PreToolUse: [
      { matcher: 'Bash|PowerShell', hooks: [nativeGuardHandler()] },
      { matcher: 'Write|Edit|MultiEdit|NotebookEdit', hooks: [nativeGuardHandler()] },
    ],
  };
}
