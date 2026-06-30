# Demo Video Script (~2–3 minutes)

Record screen + optional voiceover. **Use the desktop app, not the browser.**

## Setup (10 sec)

- Double-click `START-CONSEAL.bat` (or run backend + `scripts\2-open-conseal.bat`).
- Conseal opens in its **own window** — not Chrome/Edge.

## 1. Volume context (20 sec)

- Point to **“X remaining · Y anonymized”** in the left panel.
- Say: *Maya has dozens of case files left before end of day — she needs to see progress at a glance.*

## 2. Fast triage (45 sec)

- Select a pending document.
- Point out **PII type** and **confidence** on each span card (handout gives both).
- Use **`↓`** to move through PII spans in the right panel; center panel sync-scrolls.
- **`Space`** to toggle a span off (keep visible) — show dashed underline in center.
- **`Space`** again to mark for anonymization — green strikethrough.

## 3. Anonymized output (40 sec)

- Press **`A`** (or click **Anonymized**) in the center header.
- Show tokens like `[PII_TOKEN_01]` replacing sensitive text.
- Click **Copy safe output** or **Download .txt**.
- Say: *This is what Maya actually ships — not just marked-up source.*

## 4. Advance the queue (25 sec)

- Press **`D`** — document marked anonymized, auto-advance to next pending file.
- Show throughput counter update.

## 5. Edge cases (20 sec, optional)

- Press **`U`** to undo all anonymizations on current doc.
- Briefly show **sidecar offline** banner (stop uvicorn, click Retry) — proves graceful failure.

## Close (10 sec)

- *Keyboard-first, three-pane, built for a paralegal who will abandon anything that slows her down.*
