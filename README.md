# Conseal — Bulk Anonymization Workstation

Hackathon prototype for **Problem 2: Working at Volume** (Maya, paralegal).

**Full-stack, local desktop app:** Python FastAPI sidecar (backend) + Electron UI (frontend). Start the backend first, then open the desktop window — two processes, one product.

**This is not a browser webapp.** Use `START-CONSEAL.bat` or the portable `.exe` for demo/submission.

## Windows — fastest way (recommended)

### Prerequisites (first time only)

You need **Node.js** (for the desktop UI) and **Python 3** (for the backend). Both must be on your PATH — open a **new** Command Prompt after installing and run the checks below.

#### Install Node.js

1. Download the **LTS** installer: [https://nodejs.org/en/download](https://nodejs.org/en/download)
2. Run the `.msi` installer — accept defaults (includes npm and adds Node to PATH).
3. Official guide: [How to install Node.js](https://nodejs.org/en/learn/getting-started/how-to-install-nodejs)

**Verify:**
```bash
node --version
npm --version
```

#### Install Python 3

1. Download Python 3: [https://www.python.org/downloads/windows/](https://www.python.org/downloads/windows/)
2. Run the installer — **check “Add python.exe to PATH”** at the bottom of the first screen, then click **Install Now**.
3. Official guide: [Python on Windows (Microsoft Learn)](https://learn.microsoft.com/en-us/windows/python/beginners) · [Python docs — Windows](https://docs.python.org/3/using/windows.html)

**Verify:**
```bash
python --version
pip --version
```

> **Troubleshooting:** If `python` is not recognized, reinstall Python with **Add to PATH** enabled, or use the [Python install manager](https://www.python.org/downloads/windows/) from python.org. Close and reopen any terminal windows after installing.

### First-time project setup

1. Confirm Node.js and Python 3 are installed (see above)
2. Double-click **`SETUP.bat`** in this folder

### Every time you use Conseal

**Option A — one click**

Double-click **`START-CONSEAL.bat`**

- Starts backend if not already running
- Opens Conseal desktop app in its own window

**Option B — two steps (more control)**

| Step | Action |
|------|--------|
| 1 | Double-click `scripts\1-start-backend.bat` — **keep this window open** |
| 2 | Double-click `scripts\2-open-conseal.bat` — opens the desktop app |

No browser. No `localhost:3000`.

> **Port 8000 already in use?** Backend is already running — skip step 1 and open Conseal directly.

---

## Build a portable `.exe` (optional)

After `SETUP.bat` once:

```bash
npm run pack:win
```

Output: **`dist/Conseal-portable.exe`**

You still start the Python backend separately (`scripts\1-start-backend.bat`), then run the `.exe`.

---

## Manual commands (if you prefer terminal)

**Terminal 1 — backend (keep open):**

```bash
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

**Terminal 2 — desktop app:**

```bash
npm install
npm run desktop
```

`npm run desktop` builds static UI + opens Electron.  
`npm run desktop:app` skips rebuild (use after first build).

---

## Architecture

- **Desktop UI**: Electron serves static Next.js export (`out/`) over a local HTTP server
- **Backend**: Python FastAPI sidecar on `127.0.0.1:8000` (start separately)
- **Data**: persists in `backend/db.json`
- **PII detection**: Option B — seeded mock spans (text, type, confidence) per document

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `[` / `]` | Previous / next document |
| `↑` / `↓` | Previous / next PII span |
| `Space` | Toggle anonymize span |
| `D` | Apply anonymization & advance queue |
| `U` | Undo all anonymizations on current doc |
| `O` / `A` | Original / Anonymized output |

In **Anonymized** view: **Copy safe output** or **Download .txt**.

## Developer note

`npm run dev` + browser is only for UI development. **Submit/demo using Electron** (`START-CONSEAL.bat` or `npm run desktop`).

## Submission assets (per hackathon handout)

| Required | Asset | Status |
|----------|-------|--------|
| Application | This repo — `START-CONSEAL.bat` | Ready |
| Writeup (~½ page) | [`WRITEUP.md`](WRITEUP.md) | Ready |
| Demo video | [Vimeo — Conseal demo](https://vimeo.com/1205787772) | Ready |
| Resume | [`Lohit_Resume.pdf`](Lohit_Resume.pdf) | Ready |
| Participant info | [`participant.md`](participant.md) | Ready |
