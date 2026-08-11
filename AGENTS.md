# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Product decisions

- The weekly raid schedule runs Wednesday through the following Tuesday.
- Preserve the recognizable spreadsheet language: colored raid headers, green role rows, four-person parties, and member color cells.
- Lost Ark API data is used for a manually refreshed account-roster snapshot; up to six selected characters may earn gold, but additional characters can remain stored.
- Schedule slots display and select actual character names while retaining the parent member's color and unavailable weekdays.
- Raid types, difficulties, party size, minimum item level, and acquired gold are administrator-managed because the official API does not expose a reliable complete raid requirement catalog.
- Acquired gold is display-only. Eligibility warnings use member availability and character item level, not combat power or gold.
- Member fixed unavailable weekdays remain editable and produce schedule warnings; warnings do not block assignment.
- Members, raid catalog entries, and the weekly schedule are shared through the Supabase `raid_board_state` record; the selected personal member and character filters remain browser-local.
- A member can store more than six characters. `earnsGold` marks at most six gold-earning characters; additional characters remain schedulable and default to non-gold.
- A character earns gold from up to three distinct raids per week but may be assigned to additional raids as a no-gold participant. The same raid family remains limited to once per week, regardless of difficulty or stage.
- Additional no-gold participation is shown in amber while same-family conflicts remain red. Each affected raid card provides a collapsed detail list with the character name plus every relevant day, time, raid, and difficulty.
- For characters scheduled more than three times, mark only the lowest-item-level extra assignment(s) as no-gold (one raid at 4/3, two at 5/3) and show all such characters in a separate weekly extra-participation summary.
- Replacing a character in its current raid slot may reuse another eligible character from the same member, while the same member remains blocked from occupying a second slot in that raid. If no same-member replacement is eligible, the picker lists each blocked character and its role, level, weekly-count, or duplicate-raid reason.
- Supabase saves members, raid catalog, and schedule as separate column updates so a stale browser tab cannot overwrite unrelated shared data.
- Roster refresh preserves existing character IDs by character name. Schedule loading reconnects legacy and API-style IDs by character name so refreshing a roster does not orphan existing assignments.
- Member colors and raid header colors are editable, persisted, and reused consistently across management and schedule views.
- Local previews connect only to the dedicated `suqaaebnhcakpuctjmeq` Dev DB and must never connect to the production Supabase project. The published site connects only to the production project.
- Use `serverName:characterName` as the canonical character key in member rosters and schedule slots. Manual roster refreshes must preserve assignments and character-specific settings by matching this key instead of generating replacement IDs.
- Recover the existing legacy schedule once by mapping each old prefix-and-number ID to the corresponding member and current roster position; keep the pre-recovery Supabase snapshot as a rollback backup.
- Weekly unavailable days are edited from the weekly schedule in a single member overview modal; member management only summarizes the current week's selection.
- Each scheduled raid instance has an editable start time that is shared through the schedule and shown in member and personal schedule summaries.
- Weekly schedules can be copied as a whole to the following week, preserving raid rosters and initial day/time placement while resetting that week's member absence dates.
- `모바출` is an eighth weekly bucket for fixed raid rosters whose date and time are still being coordinated; moving a raid between a dated day and this bucket preserves its assigned characters.
- Dated raids default to 20:30, may be left untimed, and use 30-minute time choices through the late-night range; mobile-call raids remain untimed until moved to a dated day.
- Raid card order is stored independently from start time, supports drag and arrow-button reordering, and can be reset with the explicit time-sort action.
- Weekly navigation includes a direct current-week action and is limited to the current week, the preceding four weeks, and the immediately following week; older records stay stored but are not exposed through normal navigation.
- Personal schedules reuse raid colors, show progress toward three gold-earning raids, distinguish additional no-gold assignments from duplicate-family errors, and total gold from at most three distinct raids per character.
- When a personal character has fewer than three distinct guild-scheduled raids, suggest up to two highest-gold eligible raids at the character's item level, using only the highest eligible difficulty per raid family and excluding already assigned families. Personal extra-raid choices are browser-local, week-specific, reversible, and included in progress and estimated gold.
- Raid catalog display order is stable within each raid family: numeric stages ascend, and named difficulties display as normal, hard, then nightmare.
