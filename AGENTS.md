# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Product decisions

- The weekly raid schedule runs Wednesday through the following Tuesday.
- Preserve the recognizable spreadsheet language: colored raid headers, green role rows, four-person parties, and member color cells.
- Lost Ark API data is used for a stored account-roster snapshot of up to six characters per member and refreshed manually.
- Schedule slots display and select actual character names while retaining the parent member's color and unavailable weekdays.
- Raid types, difficulties, party size, minimum item level, and acquired gold are administrator-managed because the official API does not expose a reliable complete raid requirement catalog.
- Acquired gold is display-only. Eligibility warnings use member availability and character item level, not combat power or gold.
- Member fixed unavailable weekdays remain editable and produce schedule warnings; warnings do not block assignment.
- Members, raid catalog entries, and the weekly schedule are shared through the Supabase `raid_board_state` record; the selected personal member and character filters remain browser-local.
- Member colors and raid header colors are editable, persisted, and reused consistently across management and schedule views.
- Use `serverName:characterName` as the canonical character key in member rosters and schedule slots. Manual roster refreshes must preserve assignments and character-specific settings by matching this key instead of generating replacement IDs.
- Recover the existing legacy schedule once by mapping each old prefix-and-number ID to the corresponding member and current roster position; keep the pre-recovery Supabase snapshot as a rollback backup.
