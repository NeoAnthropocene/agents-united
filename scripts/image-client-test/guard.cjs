const fs = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
// path.relative follows the running platform: Windows ignores drive/path case;
// POSIX preserves it. Do not lowercase paths on every platform.
const sameFolder = (left, right) => typeof left === 'string' && left.length > 0 && typeof right === 'string' && right.length > 0 && path.relative(path.resolve(left), path.resolve(right)) === '';
const realResolved = target => {
  let ancestor = path.resolve(target);
  const missing = [];
  while (!fs.existsSync(ancestor) && path.dirname(ancestor) !== ancestor) { missing.unshift(path.basename(ancestor)); ancestor = path.dirname(ancestor); }
  return path.resolve(fs.realpathSync(ancestor), ...missing);
};
const inside = (root, target) => {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) return false;
  const realRelative = path.relative(realResolved(root), realResolved(target));
  if (realRelative === '..' || realRelative.startsWith('..' + path.sep) || path.isAbsolute(realRelative)) return false;
  return true;
};
const no = reason => ({allow:false,reason});
function desktopDefinition(cfg) {
  const selected = cfg.desktopSetup;
  const holders = {gemini:['GEMINI_API_KEY','AGENTS_UNITED_GEMINI_API_KEY'],openai:['OPENAI_API_KEY','AGENTS_UNITED_OPENAI_API_KEY'],seedream:['ARK_API_KEY','AGENTS_UNITED_ARK_API_KEY']};
  if (!selected || !Array.isArray(selected.providers) || !selected.providers.length || !selected.providers.includes(selected.defaultProvider) || selected.providers.some(p => !Object.hasOwn(holders,p)) || new Set(selected.providers).size !== selected.providers.length) return null;
  const env = {IMAGE_PROVIDER:selected.defaultProvider,SKIP_PROMPT_ENHANCEMENT:'true',IMAGE_OUTPUT_DIR:path.join(cfg.workspace,'assets/generated')};
  for (const provider of selected.providers) { const [key,holder] = holders[provider]; env[key] = '${' + holder + '}'; }
  return {mcpServers:{'image-gen':{type:'stdio',command:'npx',args:['-y','mcp-image@0.18.0'],env}}};
}
function decide(cfg, input) {
  if (!sameFolder(input.cwd, cfg.workspace)) return no('Test project differs from the actual working folder; stop and report the folder.');
  const tool = input.tool_name, args = input.tool_input ?? {};
  if (tool === 'mcp__image-gen__generate_image') {
    const armFile = path.join(cfg.workspace,'.probe/armed.json');
    if (!fs.existsSync(armFile)) return no('Image probe is not armed by the human; no generation is authorized yet.');
    const arm = JSON.parse(fs.readFileSync(armFile,'utf8'));
    if (arm.sessionId !== input.session_id) return no('The image authorization belongs to another session.');
    const verifiedMain = !input.agent_id && !input.agent_type && arm.verifiedMainAgent === 'agency-creative-designer';
    if (input.agent_type !== 'agency-creative-designer' && !verifiedMain) return no('Only the configured creative designer may make this image.');
    if (args.provider !== 'gemini' || args.quality !== 'fast' || args.imageSize !== '2K' || args.aspectRatio !== '4:5' || args.fileName !== cfg.imageBase || args.inputImagePaths?.length || args.useGoogleSearch === true || typeof args.prompt !== 'string') return no('This probe permits one new synthetic Gemini fast 2K 4:5 image, without inputs or grounding.');
    try { fs.writeFileSync(path.join(cfg.workspace,'.probe/image-attempt.json'), JSON.stringify({at:new Date().toISOString(),toolUseId:input.tool_use_id}), {flag:'wx'}); }
    catch { return no('The one image attempt is already used; failed calls count, with no retry or regeneration.'); }
    return {allow:true};
  }
  if (tool?.startsWith('mcp__') || ['WebFetch','WebSearch','Artifact','Monitor','ScheduleWakeup','CronCreate','CronDelete'].includes(tool)) return no('External services, publishing and scheduling are outside this synthetic probe.');
  if (tool === 'Bash' || tool === 'PowerShell') {
    const command = args.command?.trim();
    const allowed = ['pwd','Get-Location','echo "TEAMS=$CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS TODO=$CLAUDE_CODE_ENABLE_TODO_TOOLS"','echo TEAMS=$CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS TODO=$CLAUDE_CODE_ENABLE_TODO_TOOLS','Write-Output "TEAMS=$env:CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS TODO=$env:CLAUDE_CODE_ENABLE_TODO_TOOLS"','node .claude/skills/image-creation/scripts/image-check.mjs assets/generated --stamp --json','node .claude/skills/image-creation/scripts/image-check.mjs assets/generated --json'];
    return allowed.includes(command) ? {allow:true} : no('Test containment allows only the exact local image checker and the two non-secret team flags. Run credentialed setup yourself outside the chat.');
  }
  if (['Read','Grep','Glob','Write','Edit'].includes(tool)) {
    if (['Grep','Glob'].includes(tool)) return no('Use explicit non-secret project file reads; broad searches may expose credential configuration.');
    const supplied = args.file_path ?? args.path ?? cfg.workspace;
    const target = path.isAbsolute(supplied) ? supplied : path.resolve(cfg.workspace,supplied);
    const projectFile = sameFolder(target,path.join(cfg.workspace,'.mcp.json'));
    const mergeFile = sameFolder(target,path.join(cfg.workspace,'deliverables/image-gen.private-merge.json'));
    if (projectFile || mergeFile) {
      if (tool !== 'Write' || !inside(cfg.workspace,target)) return no('Only an exact credential-free definition Write is allowed; no credential configuration reads or edits.');
      const expected = desktopDefinition(cfg);
      try {
        const definition=JSON.parse(args.content);
        const compact=args.content.replace(/\"(?:\\.|[^\"\\])*\"|\s+/g, token => token.startsWith('\"') ? token : '');
        if (compact !== JSON.stringify(definition)) return no('Use plain JSON with no duplicate fields or hidden values.');
        const output=definition?.mcpServers?.['image-gen']?.env?.IMAGE_OUTPUT_DIR;
        if (expected && typeof output === 'string' && path.isAbsolute(output) && sameFolder(output,expected.mcpServers['image-gen'].env.IMAGE_OUTPUT_DIR) && inside(cfg.workspace,output)) definition.mcpServers['image-gen'].env.IMAGE_OUTPUT_DIR=expected.mcpServers['image-gen'].env.IMAGE_OUTPUT_DIR;
        if (!expected || !isDeepStrictEqual(definition,expected)) return no('Definition must match the selected credential-free image-gen server exactly.');
      } catch { return no('Definition must be valid credential-free JSON.'); }
      // Never inspect an unknown existing file, even to decide whether it has keys.
      if (projectFile && (cfg.desktopSetup.projectConfig !== 'absent' || fs.existsSync(target))) return no('Existing project configuration is unknown; write deliverables/image-gen.private-merge.json for human private merge.');
      return {allow:true};
    }
    if (/^(?:\.env(?:\..*)?|.*\.(?:pem|key)|credentials(?:\..*)?)$/i.test(path.basename(target))) return no('Credential files are excluded.');
    if (!inside(cfg.workspace,target) || ['.claude.json','.mcp.json','claude_desktop_config.json'].includes(path.basename(target).toLowerCase())) return no('Read only this synthetic project; credential files are excluded.');
    if (['Write','Edit'].includes(tool) && !['assets/generated','deliverables'].some(relative => inside(path.join(cfg.workspace,relative),target))) return no('Write only deliverables and generated image records; test controls and native definitions are immutable.');
    return {allow:true};
  }
  if (tool === 'Agent') return args.subagent_type === 'agency-creative-designer' ? {allow:true} : no('Use only the configured creative designer for this probe; no additional team.');
  if (tool === 'SendMessage') {
    const known = fs.existsSync(path.join(cfg.workspace,'.probe/peers')) ? fs.readdirSync(path.join(cfg.workspace,'.probe/peers')).map(file => JSON.parse(fs.readFileSync(path.join(cfg.workspace,'.probe/peers',file),'utf8'))).filter(peer => peer.sessionId === input.session_id) : [];
    return args.to === 'team-lead' || known.some(peer => [peer.agentId,peer.agentName].includes(args.to)) ? {allow:true} : no('No message to an unrelated session or an unregistered recipient.');
  }
  return ['ToolSearch','Skill','AskUserQuestion','TaskCreate','TaskGet','TaskList','TaskUpdate','TodoWrite','ListAgents'].includes(tool) ? {allow:true} : no('Tool outside the synthetic image-probe scope.');
}
module.exports = {decide,inside,sameFolder,desktopDefinition};
