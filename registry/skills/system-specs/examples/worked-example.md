# Worked example: a plan checked against the sheet before it picks tools

The user asks: "Plan the local setup for the data service: containers for the database, and a 20 GiB model download." The sheet below is constructed to show the reading; it is not from a real machine.

## 1. Find or collect the sheet

No `.agents-united/system-specs.md` exists, so the lead runs the collect command from the runbook. Exit 0, "System specs written".

## 2. Read it

```
- OS: Windows 11 Pro, release 10.0.26200, x64 (windows, WSL present)
- CPU: Example CPU, 16 logical cores
- Memory: 32 GiB
- GPU: not determined
- Free disk (workspace volume): 18 GiB
## Tools
- node 24.1.0
- docker 27.3.1
- docker compose 2.29.7
Absent: podman, terraform
Not determined (timed out or unreadable): gcloud
```

## 3. Decide, and say which line each decision rests on

- Containers: docker and docker compose are present with versions, so the plan uses compose for the database. Podman is absent, so no podman step.
- Download: free disk is 18 GiB and the model is 20 GiB. The plan does not start the download; it proposes a different volume or a smaller model and asks the user.
- GPU: not determined. The plan does not claim GPU speed-ups; it asks the user which GPU the machine has.
- gcloud: not determined (timed out). The plan does not rely on it; it offers `--refresh` and a manual check.

## 4. Hand over

The brief for each worker names `.agents-united/system-specs.md` and its collected-at time. It does not paste the sheet.
