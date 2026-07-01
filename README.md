# Conseal — Bulk Anonymization Workstation

**Demo video:** [Vimeo — Conseal demo](https://vimeo.com/1205787772)

Hackathon prototype for **Problem 2: Working at Volume** (Maya, paralegal).

**Full-stack, local desktop app:** Python FastAPI sidecar (backend) + Electron UI (frontend). Start the backend first, then open the desktop window — two processes, one product.

**This is not a browser webapp.** Use the platform launcher below (`START-CONSEAL.bat` on Windows, `START-CONSEAL.sh` on macOS) or the manual terminal commands.

| Platform | First-time setup | Every run |
|----------|------------------|-----------|
| **Windows** | `SETUP.bat` | `START-CONSEAL.bat` |
| **macOS** | `./SETUP.sh` | `./START-CONSEAL.sh` |

---

## Windows

### Prerequisites (first time only)

You need **Node.js** (desktop UI) and **Python 3** (backend). Both must be on your PATH — open a **new** Command Prompt after installing.

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
2. Run the installer — **check “Add python.exe to PATH”** on the first screen, then **Install Now**.
3. Official guide: [Python on Windows (Microsoft Learn)](https://learn.microsoft.com/en-us/windows/python/beginners) · [Python docs — Windows](https://docs.python.org/3/using/windows.html)

**Verify:**
```bash
python --version
pip --version
```

> **Troubleshooting:** If `python` is not recognized, reinstall with **Add to PATH** enabled. Close and reopen terminals after installing.

### First-time project setup

1. Confirm Node.js and Python 3 are installed (see above)
2. Double-click **`SETUP.bat`**

### Every time you use Conseal

**Option A — one click**

Double-click **`START-CONSEAL.bat`**

- Starts backend if not already running
- Opens Conseal desktop app in its own window

**Option B — two steps**

| Step | Action |
|------|--------|
| 1 | Double-click `scripts\1-start-backend.bat` — **keep this window open** |
| 2 | Double-click `scripts\2-open-conseal.bat` |

No browser. No `localhost:3000`.

> **Port 8000 already in use?** Backend is already running — skip step 1 and open Conseal directly.

### Portable `.exe` (optional, Windows only)

After `SETUP.bat` once:

```bash
npm run pack:win
```

Output: **`dist/Conseal-portable.exe`** — still requires the Python backend (`scripts\1-start-backend.bat`) running separately.

---

## macOS

The app runs on macOS (Electron + Python). Use the shell scripts below — `.bat` files are Windows-only.

### Prerequisites (first time only)

#### Install Node.js

1. Download the **LTS** installer: [https://nodejs.org/en/download](https://nodejs.org/en/download) (macOS `.pkg`)
2. Or with Homebrew: `brew install node`
3. Official guide: [How to install Node.js](https://nodejs.org/en/learn/getting-started/how-to-install-nodejs)

**Verify:**
```bash
node --version
npm --version
```

#### Install Python 3

1. Download: [https://www.python.org/downloads/macos/](https://www.python.org/downloads/macos/)
2. Or with Homebrew: `brew install python`
3. Official guide: [Python on macOS](https://docs.python.org/3/using/mac.html)

**Verify:**
```bash
python3 --version
python3 -m pip --version
```

> On macOS, commands use **`python3`** (not `python`).

### First-time project setup

```bash
git clone <repo-url>
cd sprintfour-hack
chmod +x SETUP.sh START-CONSEAL.sh scripts/*.sh
./SETUP.sh
```

### Every time you use Conseal

**Option A — quick start**

```bash
./START-CONSEAL.sh
```

In **Terminal tab 1**, start the backend if it is not already running:

```bash
./scripts/1-start-backend.sh
```

Then run `./START-CONSEAL.sh` (or open the app directly with step 2 below).

**Option B — two terminals (recommended)**

**Terminal 1 — backend (keep open):**
```bash
./scripts/1-start-backend.sh
```

**Terminal 2 — desktop app:**
```bash
./scripts/2-open-conseal.sh
```

> **Port 8000 already in use?** Backend is already running — skip Terminal 1.

---

## Manual commands (any platform)

**Terminal 1 — backend (keep open):**

```bash
pip install -r backend/requirements.txt
# Windows:
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
# macOS:
python3 -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
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
- **Data**: persists in `backend/db.json` (created on first run)
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

`npm run dev` + browser is only for UI development. **Submit/demo using Electron** (`START-CONSEAL.bat` / `START-CONSEAL.sh` or `npm run desktop`).

## Submission assets (per hackathon handout)

| Required | Asset | Status |
|----------|-------|--------|
| Application | This repo — `START-CONSEAL.bat` (Windows) or `START-CONSEAL.sh` (macOS) | Ready |
| Writeup (~½ page) | [`WRITEUP.md`](WRITEUP.md) | Ready |
| Demo video | [Vimeo — Conseal demo](https://vimeo.com/1205787772) | Ready |
| Resume | [`Lohit_Resume.pdf`](Lohit_Resume.pdf) | Ready |
| Participant info | [`participant.md`](participant.md) | Ready |
