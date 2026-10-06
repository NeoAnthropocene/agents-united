import json, os, glob, re
base = os.path.expanduser('~/.claude/projects/C--github-scratch-pilot-h6-mcp/a2e814d1-8d82-40e3-849d-33711702c292')
def events(p):
    for l in open(p, encoding='utf-8'):
        try: yield json.loads(l)
        except: pass
def text_of(c):
    if isinstance(c, str): return c
    return ' '.join((b.get('text','') if b.get('type')=='text' else '') for b in c if isinstance(b, dict))
print('=== files in subagents:', sorted(os.path.basename(p) for p in glob.glob(base+'/subagents/*')))
# real typed prompts in the lead record
for e in events(base+'.jsonl'):
    m=e.get('message') or {}
    if e.get('type')=='user':
        t=text_of(m.get('content'))
        if t and not t.startswith('Another Claude session') and not t.startswith('<'):
            print('[typed/user]', e.get('timestamp','')[11:19], repr(t[:200]))
hosts=set(); 
for p in [base+'.jsonl']+sorted(glob.glob(base+'/subagents/*.jsonl')):
    who = 'lead' if p.endswith(f'{os.path.basename(base)}.jsonl') else os.path.basename(p)[:30]
    results={}
    calls=[]
    for e in events(p):
        m=e.get('message') or {}
        c=m.get('content')
        if not isinstance(c,list): continue
        for b in c:
            if b.get('type')=='tool_use': calls.append(b)
            if b.get('type')=='tool_result':
                r=b.get('content'); 
                results[b.get('tool_use_id')] = text_of(r) if isinstance(r,list) else str(r)
    for b in calls:
        s=json.dumps(b.get('input'))
        for u in re.findall(r'https?://[A-Za-z0-9._:-]+', s): hosts.add(u)
    print(f'\n=== {who}: {len(calls)} calls')
    for b in calls:
        n=b['name']
        if n in ('Bash','mcp__playwright__playwright_evaluate','mcp__playwright__playwright_navigate','mcp__playwright__playwright_resize','mcp__playwright__playwright_get_visible_text','mcp__playwright__playwright_console_logs','mcp__playwright__playwright_screenshot') or 'chrome-devtools' in n:
            inp=b['input']; 
            short=(inp.get('command') or inp.get('script') or json.dumps(inp))[:230].replace('\n',' ')
            res=results.get(b['id'],'')[:230].replace('\n',' ')
            print(f'- {n.replace("mcp__","")}: {short}\n    -> {res}')
print('\nHOSTS in all tool inputs:', sorted(hosts))
