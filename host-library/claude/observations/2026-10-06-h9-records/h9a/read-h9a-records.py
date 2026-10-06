import json, os, glob, sys
sid='a5de969c-6d85-4136-be87-8798662e5047'
base=os.path.expanduser('~/.claude/projects/C--github-scratch-pilot-h9-provision/'+sid)
def T(c):
    if isinstance(c,str): return c
    return ' '.join((x.get('text','') if x.get('type')=='text' else '') for x in c if isinstance(x,dict))
def evs(p):
    for l in open(p,encoding='utf-8'):
        try: yield json.loads(l)
        except: pass
who=sys.argv[1]; lim=int(sys.argv[2]) if len(sys.argv)>2 else 600
p=base+'.jsonl' if who=='lead' else glob.glob(base+f'/subagents/agent-a{who}-*.jsonl')[0]
res={}
for e in evs(p):
    c=(e.get('message') or {}).get('content')
    if isinstance(c,list):
        for b in c:
            if b.get('type')=='tool_result': res[b['tool_use_id']]=T(b.get('content')) if isinstance(b.get('content'),list) else str(b.get('content'))
for e in evs(p):
    m=e.get('message') or {}; ts=e.get('timestamp','')[11:23]; c=m.get('content')
    if e.get('type')=='user' and who=='lead':
        t=T(c)
        if t and not t.startswith('Another Claude') and not t.startswith('<teammate'): print(f'[user {ts}]', repr(t[:lim]))
    if e.get('type')=='assistant':
        for b in (c if isinstance(c,list) else []):
            if b.get('type')=='text' and b['text'].strip(): print(f'[text {ts}]', b['text'][:lim].replace('\n',' '))
            if b.get('type')=='tool_use':
                n=b['name']; i=b['input']
                if n in ('TaskCreate','TaskUpdate','TaskGet','TaskList'): continue
                s=json.dumps(i, ensure_ascii=False)
                print(f'[{n} {ts}]', s[:lim].replace('\n',' '))
                if n in ('Bash','AskUserQuestion','ToolSearch'): print('    ->', re.sub(r'\s+',' ',res.get(b['id'],''))[:lim] if (re:=__import__('re')) else '')
