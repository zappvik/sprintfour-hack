# Conseal — Hackathon Writeup

**Problem:** 2 — Working at Volume (Maya, paralegal)  
**Author:** Lohit G (CB.SC.U4CSE24522)

## What I built

**Conseal** is a keyboard-first bulk anonymization workstation for Maya, who must clear ~200 case files before end of day. The app is a three-pane desktop workflow:

- **Left:** document queue with throughput (`X remaining · Y anonymized`) so Maya always knows if she is on track.
- **Center:** original text with highlighted PII spans, plus an **Anonymized** preview that shows token-replaced safe output (`[PII_TOKEN_01]`, etc.).
- **Right:** PII span cards — check to anonymize, uncheck to keep visible.

The interaction model is built for speed under pressure: `[` / `]` switch documents, `↑` / `↓` rove spans, `Space` toggles, `D` finalizes and auto-advances, `U` undoes all marks on the current file, `O` / `A` flip the center view. In anonymized view, Maya can **copy** or **download** the safe `.txt` output — the actual deliverable she needs to share.

**Stack:** Next.js (static export) + Python FastAPI sidecar (regex/heuristics, `db.json` persistence) + Electron desktop shell. Detection uses Option B (mock/seeded spans + local heuristics) so effort went into UX, not model tuning. The demo queue has 20 case files; the throughput UI is designed for Maya’s ~200-file end-of-day scale.

## Hard cases I noticed

1. **Review ≠ anonymization.** Early UI framed decisions as “defer,” which sounds like triage, not output. Maya’s job is producing shareable text — so I added a real anonymized preview and export, not just checkboxes.
2. **Queue cleared ≠ work stopped.** When all files are done, Maya may still need to revisit a file. A full-screen blocker would trap her; I kept the workspace open with a lightweight banner.
3. **Sidecar offline.** A local app that fails silently is worse than no app. The UI shows an explicit offline state with retry instructions.
4. **False confidence at volume.** I skipped vanity metrics (“time saved”) and flagging workflows — they add UI weight without helping Maya move faster.

## What I chose NOT to build (and why)

| Deferred | Reason |
|----------|--------|
| Portable `.exe` with bundled Python | `dist/Conseal-portable.exe` packages the desktop UI; Python sidecar still runs separately (`scripts\1-start-backend.bat`). Bundling Python via PyInstaller was deferred. |
| Cloud LLM detection | Option B removes API setup friction; judges said detection is not the point. |
| Per-type PII color coding | Extra visual noise; one anonymize style scans faster at volume. |
| Document flagging / progress bar | Maya abandons tools that slow her down; keyboard throughput beat dashboard chrome. |
| Marcus-style “why this?” explainability | Problem 2 is volume, not trust interrogation — depth there would dilute the queue workflow. |

## Tradeoff I made deliberately

I optimized for **documents per hour**, not **detection accuracy**. Maya will overrule the tool on edge cases; she will not wait for a modal. Every interaction stays in one screen, one keyboard flow, with immediate preview of what actually ships.
