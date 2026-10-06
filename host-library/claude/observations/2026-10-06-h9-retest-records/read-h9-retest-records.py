import json, os, glob, sys, re

proj, sid, who = sys.argv[1], sys.argv[2], sys.argv[3]
lim = int(sys.argv[4]) if len(sys.argv) > 4 else 700
base = os.path.expanduser(f'~/.claude/projects/C--github-scratch-pilot-{proj}/{sid}')


def T(c):
    if isinstance(c, str):
        return c
    return ' '.join((x.get('text', '') if x.get('type') == 'text' else '') for x in c if isinstance(x, dict))


def evs(p):
    for line in open(p, encoding='utf-8'):
        try:
            yield json.loads(line)
        except Exception:
            pass


p = base + '.jsonl' if who == 'lead' else glob.glob(base + f'/subagents/agent-a{who}-*.jsonl')[0]
res = {}
for e in evs(p):
    c = (e.get('message') or {}).get('content')
    if isinstance(c, list):
        for b in c:
            if b.get('type') == 'tool_result':
                r = b.get('content')
                res[b['tool_use_id']] = T(r) if isinstance(r, list) else str(r)
SKIP = {'TaskCreate', 'TaskUpdate', 'TaskGet', 'TaskList'}
for e in evs(p):
    m = e.get('message') or {}
    ts = e.get('timestamp', '')[11:19]
    c = m.get('content')
    if e.get('type') == 'user' and who == 'lead' and e.get('isSidechain') is not True:
        t = T(c)
        if t and not t.startswith('Another Claude') and not t.startswith('<teammate'):
            print(f'[user {ts}]', repr(t[:lim]))
    if e.get('type') == 'assistant':
        if m.get('model') == '<synthetic>':
            print(f'[SYNTHETIC {ts}]', repr(T(c)[:120]))
        for b in (c if isinstance(c, list) else []):
            if b.get('type') == 'text' and b['text'].strip():
                print(f'[text {ts}]', b['text'][:lim].replace('\n', ' '))
            if b.get('type') == 'tool_use':
                n, i = b['name'], b['input']
                if n in SKIP:
                    continue
                if n == 'Bash':
                    s = i.get('command', '')[:lim]
                elif n == 'Agent':
                    s = f"{i.get('name')} ({i.get('subagent_type')}): " + i.get('prompt', '')[:lim]
                elif n == 'SendMessage':
                    s = json.dumps(i.get('message'), ensure_ascii=False)[:lim]
                else:
                    s = json.dumps(i, ensure_ascii=False)[:lim]
                print(f'[{n} {ts}]', s.replace('\n', ' '))
                if n in ('Bash', 'AskUserQuestion', 'Skill', 'Read'):
                    print('    ->', re.sub(r'\s+', ' ', res.get(b['id'], ''))[:lim])
