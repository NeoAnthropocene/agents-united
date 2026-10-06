import json, os, glob, sys, re
sid='3a0dca4d-dbed-41c2-8310-cd8a8f9db3e4'
base=os.path.expanduser('~/.claude/projects/C--github-scratch-pilot-h1-team3/'+sid)
def T(c):
    if isinstance(c,str): return c
    return ' '.join((x.get('text','') if x.get('type')=='text' else '') for x in c if isinstance(x,dict))
def evs(p):
    for l in open(p,encoding='utf-8'):
        try: yield json.loads(l)
        except: pass
def sub(name):
    return glob.glob(base+f'/subagents/agent-a{name}-*.jsonl')[0]
which=sys.argv[1]
if which=='lead':
    print('--- typed prompts / synthetic / first assistant texts')
    for e in evs(base+'.jsonl'):
        m=e.get('message') or {}; ts=e.get('timestamp','')[11:19]
        if e.get('type')=='user':
            t=T(m.get('content'))
            if t and not t.startswith('Another Claude') and not t.startswith('<teammate'): print(f'[user {ts}]', repr(t[:160]))
        if e.get('type')=='assistant':
            t=T(m.get('content'))
            if m.get('model')=='<synthetic>': print(f'[SYNTHETIC {ts}]', repr(t[:200]))
            elif t.strip() and ts<'10:41': print(f'[lead {ts}]', t[:700].replace('\n',' '))
            for b in (m.get('content') if isinstance(m.get('content'),list) else []):
                if b.get('type')=='tool_use' and ts<'10:39:40' and b['name'] in ('Agent','SendMessage'):
                    print(f'  [{b["name"]} {ts}]', json.dumps(b['input'])[:900])
else:
    p=sub(which); print('---',which,p[-30:])
    for e in evs(p):
        m=e.get('message') or {}; ts=e.get('timestamp','')[11:23]
        c=m.get('content')
        if e.get('type')=='assistant':
            if m.get('model')=='<synthetic>': print(f'[SYNTHETIC {ts}]', repr(T(c)[:200]))
            for b in (c if isinstance(c,list) else []):
                if b.get('type')=='text' and b['text'].strip(): print(f'[text {ts}]', b['text'][:int(sys.argv[2]) if len(sys.argv)>2 else 300].replace('\n',' '))
                if b.get('type')=='tool_use':
                    i=b['input']; s=i.get('file_path') or i.get('command') or i.get('message') or i.get('taskId') or json.dumps(i)
                    extra=''
                    if b['name']=='Edit': extra=' OLD='+repr(i.get('old_string','')[:90])+' NEW='+repr(i.get('new_string','')[:90])
                    print(f'[{b["name"]} {ts} msg={e.get("message",{}).get("id","")[-6:]}]', str(s)[:150].replace('\n',' ')+extra, '| status:' + str(i.get('status','')) if b['name']=='TaskUpdate' else '')
