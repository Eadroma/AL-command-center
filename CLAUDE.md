# CLAUDE.md — Adventure Land Command Center

Context file for resuming work. Keep it under ~5k tokens; push detail into `docs/` (see "Overflow docs").
Last refreshed: 2026-11-02.

## Project summary

Local dashboard + bot scripts for the MMO [Adventure Land](https://adventure.land). The dashboard (`dashboard-v2/`) edits a
revisioned team **profile**, **builds** instrumented CODE bundles from `code/*.js`, **deploys** them to the game's
`CC_<name>` CODE slots (via the game MCP token), and shows live **telemetry** sent back by the running scripts.
Local-only tool (binds 127.0.0.1); not a hosted service. GitHub: `Eadroma/AL-command-center` (protected `main`, PR-only).

Core flow (never shortcut it): **edit → Save profile (revision check) → Preview saved deployment → Deploy saved profile**.
Saving never deploys; deploy is disabled while the draft is dirty or an operation is pending.

Roster in scripts (historical names; the builder injects the real ones from the profile):
Eadroma warrior (party leader), Aedroma priest, Droma ranger (crab AOE variant has `FIXED_FARM`), Dromas rogue (crabs),
EadroSell merchant (logistics/orchestration), Tonerre mage (legacy). Home server EU IV (since 2026-11-01).

### Active features (dashboard-v2)
- **Navigation (redesign in progress, 2026-10-21):** only **Team**, **Merchant**, **Bank** are top-level destinations; other
  pages open as Team tools/dialogs (`setup`, `farming`, `inventory`, `insights`). Legacy hash URLs (`#party`, `#combat`, …)
  still resolve. Routing: `src/hooks/usePage.ts` + `src/models/navigation.ts`.
- First-run wizard (MCP token → discover characters → cautious profile). Token stored in `credentials.json` under data dir.
- Team: composition, roster status, party map, decision/evidence drawer, deployment preview + rollback, incidents.
- Farming/Events: targets, hunts (Daisy), 8 boss rounds, AOE/Mono/Tank loadouts, 17+ events incl. Halloween
  (Horseman, Graveyard), on-demand event duo (warrior+priest launched by merchant), Cave Dreams.
- Merchant: kit/consumables (min/target/max), gifts, NPC sell, exchanges (remote w/ Computer), Leo crafting, upgrades,
  compound, Ponty wishlist, stand listings, buy orders, production contracts, circuit breakers, Trick-or-Treat, Witch's Cipher.
- Bank hub v1 (`code/bank-coordinator.js`): single visit owner for deposits + stand restock, stock ledger, journal.
- Insights: combat metrics, loot simulator / Loot Lab, performance history + CSV export, activity log, scripts catalogue.
- **Kills & loot tracker** (2026-10-27, Insights, `#loot`): per-monster kills (`kill_credit` mtype) and loot (chest id → monster of
  the kill just before its `drop`) sent as `loot.monsters`, bucketed in `performance-history`; `src/models/loot-tracker.ts`
  dedups team kills (max per slot), sums loot shares, projects /h and /day, filters bosses (`worldBosses` + `expeditionBosses`).
- **Crypt run** (2026-11-02, not yet run in game): HUD "Start crypt"/"Abort crypt" (`merchant-actions-gui.js`) →
  `code/crypt-supply.js` (merchant: asks warrior+priest+ranger for `ready`, withdraws 1 `cryptkey` via BankCoordinator, hands it
  over at the Cave door, keeps the ledger) → `code/crypt-run.js` (farmers: warrior opens, others `enter("crypt", id)`, safe-target
  whitelist `vbat, a3, a7` (Bill a2 and Orlok a4 in the flee list), priest tanks with Absorb, waypoint loop, smart_move guard).
  Profile rev 233: `farming.style` maps vbat/a3/a7 to a `crypt` loadout (Aedroma: vit/hpbelt/candleward from the bank;
  Eadroma/Droma: copy of mono); `StyleLoadout` uses `CryptRun.monster()` while inside the crypt. Protocol `cm {t:'crypt'}`. Design artifact:
  https://claude.ai/artifact/5BFdPY5xYPsLWE7guR9vuK (now a shared field guide: update it after every run). Legacy standalone slots `*-crypt.js` untouched.
- Themes: **Night** (default, ink + gold, IBM Plex Sans; `src/styles/guild.scss`, `html[data-theme="guild"]`) and Retro (`_variables.scss`). Key `alcc.dashboard.theme`.
- **Usage stats (new today):** local, opt-in (off by default) feature-usage counters (`src/models/usage.ts`, `usage-store.ts`,
  `components/layout/UsageStats.tsx`). Store static feature IDs only — never DOM text, form values, names or tokens.

## Tech stack
- Node **24** (`.nvmrc`), **pnpm 12.4.1**. Root `package.json` only proxies to `dashboard-v2/`.
- Frontend: React 19, TypeScript ~7, Vite 8, TanStack Query 5, SCSS Modules (sass), lucide-react, Radix switch.
- Backend: Fastify 5 (+static, +websocket `/live`), SQLite via Drizzle, Zod 4 schema (`shared/schema.ts`),
  acorn (parse script `CONFIG`), esbuild (bundle builds). Run with `tsx`.
- Tests: Vitest 5 (`maxWorkers: 2`, 15 s timeout, `tests/setup.ts` isolates data per worker), `node --test` for
  `tests/combat.test.cjs` + `tests/public-repository.test.mjs`. Lint: **oxlint** (react/typescript/oxc plugins).
- Game scripts: plain browser JS run inside Adventure Land CODE (not Node). Optional headless runner: caracAL (external).
- CI (GitHub Actions): `validate` (install frozen, public audit, build, vitest, smoke, combat tests), `lint`, `audit` (+weekly).

### Commands (from repo root)
```sh
pnpm --dir dashboard-v2 install --frozen-lockfile
pnpm dev            # UI http://localhost:5173, API http://127.0.0.1:9320
pnpm build && pnpm --dir dashboard-v2 server   # prod on :9320
pnpm lint | pnpm test | pnpm test:combat | pnpm test:smoke | pnpm audit:public
pnpm --dir dashboard-v2 audit --audit-level high
pnpm --dir dashboard-v2 assets:refresh          # re-import game item/sprite catalogue
pnpm export:public                              # allowlisted export to .release/ (tools/repository-files.mjs)
```
Env: `ALCC_PORT`, `ALCC_DATA_DIR` (use a temp dir for manual tests!), `AL_CODE_DIR` (default `../code`),
`ALCC_CARACAL_DIR`, `AL_MCP_TOKEN` (overrides saved token), `ALCC_DISABLE_LEGACY_CREDENTIALS=1`. No `.env` autoload.

## Repository layout
| Path | Role |
| --- | --- |
| `dashboard-v2/src/` | `api/` transport · `hooks/` queries/WS/draft lifecycle · `models/` pure transforms · `types/` · `components/{ui,layout,pages,party,merchant,…}` · `styles/` |
| `dashboard-v2/server/` | `index.ts`, `routes/*.ts`, `builder.ts` (bundle generation, managed CONFIG keys), `telemetry.ts`, `deploy.ts`, `scripts.ts` (catalogue/AST), `store.ts`, `ws.ts`, `migrations/` |
| `dashboard-v2/shared/` | Profile schema + shared domain types (front+back) |
| `dashboard-v2/tests/` | ~80 Vitest files (567 tests at last count) |
| `dashboard-v2/docs/` | Feature docs (mostly French): FIRST-FARMING, MERCHANT-*, EVENT-EXPEDITIONS, HALLOWEEN-2026, DECISION-EVIDENCE, THEMING, ROADMAP… |
| `code/` | In-game scripts. Prefer `*-v2.js`; v1 kept for compat/tests. Shared modules: `runtime-policy.js`, `bank-coordinator.js`, `event-expedition.js`, `movement-watchdog.js`, `combat-gear.js`, `style-loadout.js`, `merchant-*-gui.js`, `gui.js` (HUD) |
| `combat/`, `tests/`, `tools/`, `docs/` | Shared combat modules, script tests, maintenance/audit/export tools, architecture notes |
| Ignored / out of scope | `caracAL/`, `command-center/` (dashboard v1), `dashboard/` (v0), `adventureland_mongodb/` (game source, reference only), `sites/` (unrelated), `.local-archive/`, `.release/`, `.research/`, `.tmp*/`, `backups/` |

## Code style & conventions
- `.editorconfig`: UTF-8, LF, 2-space indent, final newline. **Do not reformat historical scripts** (some use tabs) in functional fixes.
- React/TS: named exports, explicit `XxxProps` interfaces, `import type`, **no new `any`** in UI code, one component per file
  with sibling `Xxx.module.scss`; use SCSS tokens (`@use '../../styles/variables' as *`) and Guild runtime CSS vars, no hard-coded colours.
- Layering: transport in `api/`, orchestration in `hooks/`, pure immutable logic in `models/` (tested), pages receive data from `App`.
- Never mutate cached profiles; drafts keep their original revision. Unknown/stale telemetry is shown as unknown — never invent data.
- Files kebab-case (`merchant-circuit.ts`), components PascalCase, hooks `useXxx`, tests `tests/<feature>.test.ts`.
- Code comments/JSDoc in **English**; user docs mostly **French** (README root in English). Script headers/comments are French without accents.
- Game scripts: ES5-style `var`, top-level `var CONFIG = {…}` (parsed by acorn; the builder overrides values and injects `__ALCC`),
  modules as IIFEs (`var RuntimePolicy = (function(){…})()`), storage keys prefixed `alcc:<area>:v1:`. Builder-managed keys
  (NAME, PARTY, TEAM_SLOTS, HOME, …) cannot be per-character overrides. `CONFIG.FIXED_FARM = true` pins a script's target.
- Commits/PRs: describe behaviour change, verification, remaining limits. Dependency change ⇒ include lockfile + audit.

## Hard rules (safety)
- Never deploy CODE or touch a real account from tests/CI; tests use isolated `ALCC_DATA_DIR`.
- Never commit/print tokens, `credentials.json`, `caracAL/config.js`, `.cursor/mcp.json`, SQLite/telemetry data. No `git add -f` on ignored files.
- Uncertain in-game actions (bank moves, brews, trades) are journaled and **never blindly replayed**.
- Don't add a global licence; third-party provenance is in `THIRD_PARTY_NOTICES.md`.

## Known bugs / doc drift
- `src/components/pages/README.md` links `docs/DASHBOARD-REDESIGN.md`, which **does not exist** — write it or fix the link.
- Root `README.md` "Dashboard features" table and `dashboard-v2/README.md` "Navigation" still describe the old 9–15 top-level
  pages, not the Team/Merchant/Bank redesign.
- `docs/THEMING.md` presents Retro as *the* theme; Guild is now default (`docs/themes.md`). Reconcile.
- Backend not strict-typed (`any` in AST parsing, SQLite store, deploy responses); `tsc -b` covers only frontend + shared.
- Builder tests depend on sibling `../code` (setup sets `AL_CODE_DIR`); no self-contained fixtures yet.
- Oversized modules: `server/builder.ts` (~56 KB), `shared/schema.ts` (~35 KB), `MerchantPage.tsx` (~34 KB), v1 scripts 100–155 KB.
- Telemetry/history JSON files (`telemetry.json`, `performance-history.json`, `party-statistics.json`) are written at most every 15 s
  (`server/json-file.ts`); a hard kill loses up to 15 s. Runtime commands are resent until the script acks their id (`acks` in the packet).
- Bank hub ledger "surplus" is an estimate for stand rules only — must not be used as craft availability yet.

## dashboard-solid (rewrite in progress, started 2026-10-26)
- New folder `dashboard-solid/`: full TypeScript rewrite, SolidJS + Hono in one package, fr/en from day one.
  Docs in `dashboard-solid/docs/` (CONVENTIONS, ESLINT, SETTINGS, DOCUMENTATION, MARKET); validated configs in `docs/reference/`.
- Tracking: Kanban artifact https://claude.ai/artifact/82c7UZFnRkNrNkxGEf7gjo (cards in its db; update each card's lane/criteria
  as work progresses). Proposal/audit/inventory: https://claude.ai/artifact/XuaAazMvCyFG54itziYGdB.
- Settings live in `%LOCALAPPDATA%\ALCC\settings.json` (port 9321 and `deploy.enabled: false` while v2 keeps 9320 and stays the only deployer).
- Gate: `pnpm --dir dashboard-solid check` (tsc 6.0 — typescript-eslint does not support TS 7 —, ESLint incl. a lint-fixture guard, i18n:check, node:test).
- Server runs via Node 24 type stripping (`node server/index.ts`): `.ts` import extensions, no enum/namespace/parameter properties.

## Next TODOs (priority order)
0. Crypt v0 in game: validate the 51 waypoints with `can_move_to`, trio survival on Vampirelings, paused-instance rejoin, then
   widen `CRYPT_SAFE` (a2, a3) and move it into the profile. Port v2's funded buy-order stand logic to
   `dashboard-solid/server/builder/runtime/merchant-stand.js` (only remaining `dashboard-solid check` failures, Trader parity).
1. Finish/verify the navigation redesign + usage stats (build, lint, full test suite; mobile 390px check) and update README docs.
2. Bank hub v2: migrate craft, Xyn and compound withdrawal adapters onto `bank-coordinator.js` (see `docs/BANK-CENTRIC-ARCHITECTURE.md`).
3. **P1 before public release:** clarify licences for `code/gui.js` (Crowns3bc HUD), `merchant-party-gui.js`, credited snippets; choose project licence.
4. Split `builder.ts` / `schema.ts` / `MerchantPage.tsx` by domain; strict-type the backend.
5. Self-contained builder fixtures; extract remaining API types out of hooks with runtime validation.
6. Remaining roadmap features: Dragold, scroll budget, upgrade exclusions, mluck, per-character potion thresholds; consolidate v1/v2 scripts with runtime coverage.
7. Release hygiene: Playwright, semver, changelog, pin Actions by SHA.

## Untested / unverified scenarios
- No automated browser/E2E tests: hook lifecycle, WebSocket reconnect, save → conflict (two windows) → discard → deploy.
- Usage-stats: `tests/usage.test.ts` covers the model (opt-in, parsing); `usage-store` (localStorage unavailable, reset) still untested.
- Halloween: Trick-or-Treat & Witch's Cipher only have synthetic tests — rewards, season end, account limits unconfirmed in-game.
- Event duo: only Mr. Green / Mr. Pumpkin on home server; live cleanup-timeout and coordinator-loss paths not observed in-game.
- Bank hub v1 rollback (`tools/restore-bank-central.ps1`) not exercised end-to-end; no real in-game trade is tested anywhere.
- Crypt run, first in-game run 2026-11-02 (one key used): handover, opening, joining by id and the `wipe` exit worked.
  The trio wiped on Bill (a2): ~3.1k phys/s outpaced the priest's Absorb tanking → put a2 back in KEEP (avoid) before the next key.
  Lucinda (a7) regenerates when left (fight focus added). No `kill_credit` ever counted inside the instance (unverified whether nothing
  died or the event is missing). Marceline/Angel/Bill bubbles block corridors: route = visibility graph + 30 s danger memory + skips.
  Crypt state is per character (`alcc:crypt:v1:farmer:<name>`): game `get`/`set` share one browser localStorage.
  Run 2 (second key): crypt loadout worked (Aedroma 11.4k HP), Lucinda killed (oozingterror), Lestat likely; no deaths. Aborted
  when Bill roamed to the Vampirelings and chased the priest. Open bugs: `absorb_victim` walks the priest to allies hit by RUN
  monsters (Bill) — must skip RUN; `kill_credit` never counted in the instance (neither CryptRun nor telemetry loot saw a7).
  Fixed same day (rev 234): absorb skips RUN, retreat (step out 60 s, come back by id, max 3) instead of abort, HUD
  "Resume crypt" rejoins the last instance without a key (resume of run 2 worked), Bill bubble 340 px + instant retreat
  on any RUN aggro, tank waits for the party (300 px) and pings its position, regroup threshold 160 px. Still open:
  kill counting; a Vampireling is only safe with Bill > 460 px away, so a Bill parked by the pack blocks the main loot.
  `fieldgen0` added to the Gabriel sell list.
  Rev 235: every Aedroma loadout wears cring+2 ×2 / cearring+1 ×2, every Eadroma loadout cave_loaded_die+2;
  `StyleLoadout` swaps the priest's offhand to lantern+4 against `damage_type: "magical"` monsters (builder keeps it in
  LOADOUT_ITEMS). Merchant now compounds under exchange space pressure (it was deadlocked with 1 free slot).
  Run 3 (third key, 2026-11-02): 7 vbat + Lucinda + Lestat killed, nobody lost. Fixes from it: kills counted by the lead
  when a <20% HP monster within 400 px vanishes (`kill_credit` never arrives in the instance); a retreat re-entry is not a
  death; a member who leaves sends `left` (priest leaving ends the run); ranger holds max range ≥80 px from allies
  (Lestat has anger 300 + 20 px splash); loadout monster held 10 s (heals flipped Lantern/Candleward); crypt gear kept
  during retreats; blocked routes hold up to 5 min instead of skipping the round; run ends on "objective done"
  (7 vbat + each safe unique). Merchant crafts merge split ingredient stacks and back off 60 s after a refusal.
  Rev 237 (not yet deployed/run): Dromas (rogue) replaces Droma in the trio with `code/dromas-rogue-party-v2.js`
  (follows the warrior at 60 px, Fan of Knives on engaged packs, Mental Burst, Rogue Swiftness on the team). Builder
  `RANGER` = ranger || rogue; CryptRun gives the rogue the ranger's spacing. Bill (a2) study: tanking fails (poison
  ×0.25 heals, no gear reaches the 86% pnresistance needed); plan = pillar kite in the bat section (Bill re-paths only
  when idle) with Dromas + Eadroma Hard Shell. Snowballs (Frozen −40 speed/−70% attack) set aside for now.
  Built (not yet run): CryptRun Bill mode. Pillar = free 64x96 block at (992..1056, −584..−488), clear ring 80–120 px.
  Lead starts it once per run when Bill is idle within 300 px of the pillar, the third member is a rogue and both are
  >80% HP (`CONFIG.CRYPT_BILL === false` disables). Whoever Bill targets runs the ring (r 90, flees along it); the other
  hits him (rogue 120 px range cannot hit across the pillar); the rogue pulls; warrior Hard Shell / rogue Invisibility
  under 50 px; priest heals from ≥340 px. Retreat on tank <35% without Hard Shell, rogue <35% while chased, Bill on the
  priest >5 s, or 8 min. Fixed: the rogue's own bundle had no RANGER key, so crypt/cave rosters left him out.
  Run 4 (2026-11-02, Dromas as third): Lestat + Lucinda + 1 vbat. Bill fight started from 850 px away and was dropped
  (now needs the lead within 400 px of the pillar, and only an engaged fight counts as the run's try). Fixes after it:
  deaths are counted from `character.rip` (2 = "died twice"), not guessed from re-entries; after every entry the lead
  waits at the door until the party is within 300 px (5 min max); a follower with no safe route for 15 s sends `stuck`
  and the lead walks to it; warrior/rogue wait until the priest holds the target (8 s fallback) and the priest opens
  on idle targets; rogue spacing tries reachable spots before the route node. Telemetry now prints rejection reasons.
  Run 5 (2026-11-02, rev 239 at the end): 7 vbat + Lestat + Lucinda, no deaths. First real Bill fight: Dromas ran the
  pillar ring at full HP while Bill went 419k→~390k, ended on "tank low". Since then: priest curses/heals Bill's
  victims and orbits if chased; a low warrior steps out alone (no party retreat); 2 engaged Bill tries per run; a
  character in a stale instance (abort + new start) exits first; after the objective the trio waits up to 10 min for
  Bill at (1184,−384) when a try is left (fight also starts when Bill already targets one of us). Open: Dromas is
  sometimes outside the instance with 0 deaths (cause unknown, he re-enters); merchant `oozingterror` upgrade rule
  (max +7) destroyed two today.
  Found (rev 241): Dromas runs in his own window; the merchant supervisor saw his report >60 s old during long chores,
  called start_character, the second login dropped his window and the server put him at the crypt exit (on_exit on
  login). Fixed: farmers reporting in the last 5 min and not children of the merchant are never restarted; pings also
  run in the supervisor loop. Orlok (a4) stays in RUN, decided 2026-11-02: Scare does despawn his spawned zappers
  (stype "spawn" removed on stop_pursuit), but zaps hit everyone within 300 px (1200 pure/s, one zapper per 1.6 s on
  any damager within 400 px) and Scare has a 5 s cooldown; the trio's HP cannot absorb it, even with a jacko each.
  Runs 6–10 (rev 242–243): order Lucinda → Lestat → Bill → Vampirelings; rogue fights Bill alone (warrior out, taunts Bill
  off the priest), priest curses and backs out, Bill wait 20 min with vbat farming while he is far. Run 10 = first full clear
  (Bill killed). Lessons: paused instance keeps Bill's target (retreat never shakes him: engaged Bill = start the fight);
  `move()` to a monster's position walked the rogue into Bill (now 110 px pull, vanish at 100 px; Curse/Taunt aim for range);
  deaths are watched on a timer (movement loops return early while dead); regroup needs 3 s after entering. Angel (curse aura
  300 px puts the rogue at 68 < her 76) and Marceline (8,960 per hit, Weakness −30 speed 20 s, only a paladin cleanses it,
  no loop near her spawn; only 3 walk-around obstacles in the crypt) stay avoided — details in the shared guide.
  Runs 17–18 (2026-11-04): full clears (12.5 / 15.5 min). Fixed: kills uncounted when the monster comes back in sight,
  no Bill fight on a dead Bill. Run 19: Bill parked on the Vampirelings + Orlok/Elena/Marceline in the east corridor →
  26 min of loop ping-pong; added "Bill in the way" hold (bosses done + Bill tries left), wrap goes to the waypoint nearest
  the pillar, lead keeps ≤380–450 px of Bill / walks to his last position. Mid-fight deploy at 03:28 → trio wiped once
  (never deploy during a Bill fight). Blind "walk to Bill's last position" removed after the second run 19 wipe;
  no engaged Bill fight unless the rogue is in sight. Runs 20–22: rogue stays hidden while a RUN monster is <450 px,
  no Bill wait once the rogue left the run, Bill hold logs its reason and gives up after 3 min, no new pull under
  70% HP, Vampireling part restarts at waypoint 0 after the bosses, Bill counted dead only within 250 px of the lead.
  Run 22 = full clear in 15 min. Open: rogue death 16 s into the run 20 Bill fight with Invisibility ready.
  Runs 23–24: off-pillar Bill fights wiped/failed again → after the bosses Bill is fought only at the pillar; lead keeps
  pinging and allies report sightings (`bill_seen`); rogue never pulls without Invisibility ready. Run 24 aborted by hand,
  autopilot stopped at 07:15 on 2026-11-04. Next fix: the run 13 "Bill blocks the way to a boss" exception still skips the
  pillar checks (started run 24's fatal fight). Bill reliability fell after run 19's changes (13–18 were reliable).
  Rev 249 (2026-11-04): blocking Bill before the bosses only fought within 400 px of the pillar (run 24 fix); Dromas's
  crypt loadout wears snowflakes+8 offhand (freeze ~9%/hit, 5 s: speed 1, −70% attack rate; Bill/Marceline have no
  fzresistance). Inside the crypt every fight (Bill, Marceline too) uses the crypt loadout (only vbat/a3/a7 set `monster()`).
  Run 25 (rev 249): full clear in ~14.5 min, Bill killed in ~4 min (fastest yet), Bill frozen 22% of 1 s samples, no
  deaths until Marceline. Marceline attempt (`CONFIG.CRYPT_MARCELINE = true` set at runtime on Eadroma, resets on reload):
  she roamed onto the rogue, Weakness, pull while weakened, then she hit him while hidden at 5 px → rogue died once.
  Fixed after: no Marceline pull while weakened or with her <150 px and Invisibility down; walk off while hidden.
  Merchant key fetch aborted "no Crypt Key" when `character.bank` was not loaded yet (waits/retries now). Added the
  warrior Hard Shell rotation (user): Bill on the rogue + Hard Shell/Taunt ready + warrior >70% HP → Taunt, 8 s under
  the shell, then leave the 300 px anger radius so Bill returns to the rogue.
  Run 26: rotation killed Bill in 4 min (frozen 52%, Bill on the warrior 80% of the time, warrior down to 3.7k once);
  priest died to the first vbat after Bill, then warrior + rogue → pulls now wait for priest ≥70% HP, priest down =
  retreat, warrior <50% between shells runs the ring. Monsters level up on kills: vbats ≤ level 3 are pulled now.
  Rogue vanishes from Bill late (60 px, 100 px under 60% HP, frozen Bill only if hurt and <45 px). Marceline v2 (user:
  rogue + Curse + Snowflakes): speeds rogue 92 (62 weakened) vs Marceline charge 86 / 66 cursed / 26 cursed+frozen;
  rogue waits for the priest, kites at 100–125 px, steps away <105, vanishes <85; priest follows the rogue's party
  position out of sight (she stood at the entry all of run 26's attempt). Marceline v2 not yet seen in a real fight.
  Audit (2026-11-04, rev 250-253): Curse held on Bill (82% uptime run 28), Hard Shell taunt only on a cursed/frozen Bill,
  vbats of any level pulled, one `vanish_now()` rule, `CRYPT_BILL`/`CRYPT_MARCELINE` are real warrior CONFIG keys
  (profile override), recovery retreat after Bill when the priest is <70% HP or <50% MP (HP/MP pots share a 2 s
  cooldown; she drinks HP only under 40%), pulls need priest ≥40% MP. Runs 30-33: full clears, Bill ~3.5 min.
  Marceline: rogue-alone kiting (rewritten twice) never landed more than 1 hit; warrior Hard Shell rotation with Scare
  (jacko in Eadroma's crypt orb; Scare drops every monster targeting you, a hit only retargets a monster with no
  target, Taunt steals from party members) built and tested in unit tests only. Run 34 wiped in its attempt: Spike (a1)
  roams her corner and killed the warrior, her home (2752,-1744) is a dead end where step-out finds no exit, and after
  Scare her contact aggro (32 px, rage 1) hit the whole group. `CRYPT_MARCELINE: false` since rev 253.
- Cave of Dreams (2026-11-16): followers looped "searching path" in spookytown: the mummy-rage guard (priest/rogue `setInterval`)
  stopped every walk near the rage box while the warrior waited at Dorr. Now it only holds walks whose `smart.map` is spookytown.
- Loot Lab calibration accuracy vs real loot (buffs, server bonus, jackpots) unvalidated.

## Overflow docs
- `docs/CLAUDE-SUBSYSTEMS.md` — invariants for merchant/bank/expedition/telemetry/deploy subsystems (read before touching them).
- Existing: `docs/CLEANUP-2026-10-21.md`, `docs/REPOSITORY-AUDIT.md`, `dashboard-v2/docs/ROADMAP.md`, `REVIEW-2026-09-23.md`.

## Maintaining this file
Update "Active features", "Known bugs", "Next TODOs" and "Untested" at the end of each session. Move anything
subsystem-specific or long into `docs/` and link it here. Future-system notes (e.g. a v3 / MK2) go in their own `docs/<name>_notes.md`.
