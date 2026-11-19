# Worked example: a plan checked against the sheet, then a specialist finds it out of date

The user asks: "Plan the local setup for the data service: containers for the database, and a 20 GiB model download." The sheet below is constructed to show the reading; it is not from a real machine.

## 1. The coordinating agent collects once

No `.agents-united/system-specs.md` exists, so the coordinating agent runs `collect` during planning. Exit 0, "System specs written". It will pass the sheet's path, not its text, in each brief.

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
Not determined (found, but timed out or failed): gcloud
```

## 3. Decide, and say which line each decision rests on

- Containers: docker and docker compose are present with versions, so the plan uses compose for the database. Podman is absent, so no podman step.
- Download: free disk is 18 GiB and the model is 20 GiB. The plan does not start the download; it proposes a different volume or a smaller model and asks the user.
- GPU: not determined. The plan does not claim GPU speed-ups; it asks the user which GPU the machine has.
- gcloud: not determined. The plan does not rely on it; the coordinating agent runs `collect --refresh` once, and if it is still not determined the tool is unknown.

## 4. A specialist finds the sheet out of date

Later the database specialist is about to write the compose file. It runs `check`: exit 3, "changed: podman". It does not refresh the sheet. It reports to the coordinating agent: "podman now resolves on the path; the sheet says absent; please update." The coordinating agent runs `collect --refresh` and tells the specialists that depend on the sheet. A specialist working alone would run `collect --refresh` itself.

If `check` had said "unchanged" while the specialist saw a different node version after a version-manager switch, the same report applies: `check` cannot see that, and `--refresh` is the answer.
