# INFRASYNC AI — Site Command

Real-time construction site coordination: workers report from the field, the manager dashboard updates instantly.

## Run on Windows
1. Install Python 3.10+ from python.org (tick **Add python.exe to PATH**).
2. Unzip the project, then double-click **run.bat**. The first run installs everything and opens http://localhost:8000.

## Run (Ubuntu)
```bash
unzip infrasync-ai.zip && cd infrasync-ai
chmod +x run.sh && ./run.sh
```
Open http://localhost:8000 (the script also prints a Wi-Fi URL for phones).

| Role | Login | PIN |
|---|---|---|
| Manager | Site Manager | `admin123` |
| Workers | Arjun, Priya, Rahul, Meera, Sanjay, Kavya, Imran, Anita | `1234` |

Change PINs: `MANAGER_PIN=xxxx WORKER_PIN=yyyy ./run.sh`   ·   Change port: `PORT=80 ./run.sh`

## Docker alternative
```bash
docker build -t infrasync . && docker run -d -p 8000:8000 -v infrasync-data:/data infrasync
```

## Features
1. Dark glassmorphism UI with live charts, responsive on phone and desktop.
2. Worker input (start, % progress, completed) appears on the manager dashboard in real time (WebSocket).
3. New project wizard: pick type → all related work shown by field → assign each field/worker + dates → create.
4. Delay flow: worker taps Finish → Completed or Delayed → picks cause, explains, adds photos → manager sees the AI-detected cause, days late and photo evidence (click to enlarge).
5. Workers only see their own tasks — no project progress or other workers' data (enforced on the server).

Data: `data/infrasync.db` (SQLite) and `data/uploads/` (photos). Delete the `data` folder to reset to demo data.
