# Working in Pixel Scout

These instructions apply to coding agents, including Codex, Antigravity, and similar harnesses. Read `README.md`, `CONTRIBUTING.md`, and `docs/ADDING_GAMES.md` before changing architecture.

## Commands

- Node.js 22 or newer; no API keys, accounts, package installation, or build step needed for local work.
- `npm run dev` serves `dist/` at `http://127.0.0.1:4173`.
- `npm run check` runs the public-file scan and all tests.
- `npm run game:new -- penalty-quiz "Penalty Quiz"` scaffolds an isolated mini game.

## Source map

- `dist/` is **editable source**, not a generated build directory. Do not delete it.
- `dist/app.js`, `engine.js`, `reveal.js`, `player-search.js`, `bonus.js`: existing football game UI and independent rule modules.
- `dist/players.json`: committed, offline player snapshot. Data provenance lives in `research/`.
- `dist/games/registry.json`: mini game list; `dist/games/index.html` is the launcher.
- `dist/games/<slug>/`: independent mini games. Start from `templates/mini-game/` via the scaffold command.
- `tests/`: Node's built-in test runner. No browser test library is installed.

## Preserve behavior

Keep the football game at `/`, its Demo opening bonus, unknown values, 125 target portraits, full 2,329-player search, eight guesses, sequential reveals, and stored score compatibility unless the task specifically changes them. New games must use their own folder and versioned localStorage key. Do not change the shared player snapshot just to satisfy a new game's tests.

Keep UI Turkish by default, keyboard usable, and responsive. Use relative asset URLs so forks can deploy on other origins. Never infer missing player facts. Preserve author/source/license metadata when changing portraits.

## Collaboration and security

Use a focused branch and pull request. Coordinate before editing shared registry or football UI files. Run relevant checks and summarize actual validation. Never publish or deploy without the maintainer's request; opening a pull request is enough for a contributor task.

Never commit `.env*`, tokens, passwords, email addresses, cookies, local paths, credentials, `.vercel/`, `.openai/`, harness state, or private conversation exports. Never print credentials in logs or add them to browser code. A future secret belongs on a server, not in `dist/`. The public-file scanner is a guardrail, not proof that a file is safe; inspect staged changes too.

## Licensing

Original code is MIT. Third-party images, font, and player data are not blanket MIT. Follow `THIRD_PARTY_NOTICES.md`. The demo bonus uses an original MIT SVG. Never add a personal photograph without the rights and explicit permission to redistribute it.
