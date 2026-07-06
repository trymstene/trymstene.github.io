# Setting up the banana workshop on a new machine

The git repo carries all the code — but Claude's memory and the local tooling
config are deliberately NOT in git. This is the checklist for moving to a new
machine (written when Trym moved from the laptop to the desktop, Jul 2026).

## What travels with git (nothing to do)
Code, workers, tools, this doc. `git clone` and you have it.

## What does NOT travel with git
| Thing | Where it lives | Why it matters |
|---|---|---|
| **Claude's memory** (all the .md files: project status, rave plan, ecosystem plan…) | `%USERPROFILE%\.claude\projects\C--Web-Development-trymstene-com\memory\` | This is Claude's brain across sessions. Without it, a fresh Claude knows only what's in the repo. |
| `.claude\` (launch.json for the preview server, local settings) | repo root, gitignored | Preview/verify tooling config |
| `.mcp.json` (chrome-devtools MCP) | repo root, gitignored | Browser-tooling config |
| `ROADMAP.md` | repo root, gitignored | Local planning doc |
| `giphy-tenor-pack\` | repo root, gitignored | Upload pack, not for the site |
| Cloudflare auth | wrangler's own config | Needed to deploy workers |

All of the gitignored items above are bundled by the move-kit (see below).

## The steps

1. **Clone to the EXACT same path**: `C:\Web Development\trymstene.com`.
   The path is not cosmetic — Claude's memory folder is named after it
   (`C--Web-Development-trymstene-com`). Same path = memory just works.

2. **Transfer `banana-move-kit.zip`** (made on the old machine, sits on its
   Desktop) via USB/cloud, then unpack:
   - `memory\` → `%USERPROFILE%\.claude\projects\C--Web-Development-trymstene-com\memory\`
     (create the folders if missing — THIS IS THE IMPORTANT ONE)
   - `dot-claude\` → `.claude\` in the repo root
   - `.mcp.json`, `ROADMAP.md`, `giphy-tenor-pack\` → repo root

3. **Tooling**:
   - Node 20+ → `npm install` in the repo root
   - `npx wrangler login` (one-time browser auth; needed only to deploy workers)
   - Python 3 + Pillow (`pip install pillow`) — the pixel-asset pipeline
   - GitHub auth: pushing to main = the deploy, so make sure `git push` works

4. **Smoke test**: open Claude (Code/Desktop) in the repo folder and ask
   "what's the current state of the project?" — if it answers with the rave/
   pass/ecosystem specifics, the memory landed correctly. Then `npm run dev`
   and open localhost to confirm the site builds.

## Keeping two machines in sync later
Code syncs through git as always. Memory does NOT auto-sync — if you work a
long session on one machine, re-copy the memory folder to the other (it's a
plain folder of .md files; newest wins). Treat the machine you're currently
building on as the memory master.
