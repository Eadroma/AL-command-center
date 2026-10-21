# Adventure Land Command Center

[![Build and tests](https://github.com/Eadroma/AL-command-center/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Eadroma/AL-command-center/actions/workflows/ci.yml)
[![Code quality](https://github.com/Eadroma/AL-command-center/actions/workflows/quality.yml/badge.svg?branch=main)](https://github.com/Eadroma/AL-command-center/actions/workflows/quality.yml)
[![Dependency audit](https://github.com/Eadroma/AL-command-center/actions/workflows/security.yml/badge.svg?branch=main)](https://github.com/Eadroma/AL-command-center/actions/workflows/security.yml)
![Node.js 24](https://img.shields.io/badge/Node.js-24-339933?logo=nodedotjs&logoColor=white)
![pnpm 12.4.1](https://img.shields.io/badge/pnpm-12.4.1-F69220?logo=pnpm&logoColor=white)

A local dashboard for managing your [Adventure Land](https://adventure.land) characters, configuring farming scripts, and monitoring their activity. Built with React, TypeScript, Fastify, and SQLite, with additional in-game interfaces.

This is an independent project. Run the dashboard on your own computer; the current application is intended for local use and should not be exposed directly to the Internet. Cloning the repository does not deploy any characters.

## Quick start

Requirements: Git, **Node.js 24**, and **pnpm 12.4.1** available in your terminal.

```sh
git clone https://github.com/Eadroma/AL-command-center.git
cd AL-command-center
pnpm --dir dashboard-v2 install --frozen-lockfile
pnpm dev
```

Open **http://localhost:5173**. The local API runs at **http://127.0.0.1:9320**. The setup wizard connects your account and prepares a profile; saving and deploying are separate actions.

To run the compiled application locally instead:

```sh
pnpm build
pnpm --dir dashboard-v2 server
```

Open **http://127.0.0.1:9320**. Keep the terminal open while using the dashboard; press `Ctrl+C` to stop the service. `pnpm --dir dashboard-v2 preview` serves only the frontend and does not replace the API server. Keep `dashboard-v2/` and `code/` in their original relative locations.

## First deployment

These steps use **Browser CODE**: the dashboard and game browser must run on the same computer, with the selected characters open in the game. caracAL is optional and is not needed for this mode.

1. Sign in to [Adventure Land](https://adventure.land), open your characters on the desired server, and keep them open.
2. Open [Mainframe](https://adventure.land/mainframe), select **Connect an AI**, and retrieve your MCP token using **Reveal token**, or **Create token** if needed. Use the token, never your game password. Rotating an existing token invalidates the previous one.
3. Open **Team → Manage team** (`/#team?tool=setup`). In **First farming setup**, paste the token and select **Connect and discover characters**. This verifies the account and lists its characters; it does not start them.
4. Choose the **home** region and server matching the game. Select the characters, their v2 scripts, and the leader. For a solo character, use **Independent / leader**. Selecting a server in the dashboard does not move characters in the game.
5. Choose a target appropriate for their equipment. The specialized crab rogue and crab ranger scripts keep their dedicated target, even if you choose another global target. The rogue requires equipment that grants its specific skills.
6. In **Review**, check the composition and select **Stage cautious profile**. This prepares an editable draft. Trading features and advanced activities remain disabled in this initial profile; script-specific potions and safety behavior still apply.
7. Select **Save profile**, then **Deployment preview → Preview saved deployment**. Review the characters, scripts, and CODE differences before proceeding. Preview does not upload or restart anything.
8. Select **Deploy saved profile** to apply the saved configuration. This writes generated bundles to `CC_<name>` slots and requests a reload. The dashboard backs up replaced slot contents in its local data directory.
9. Wait for fresh telemetry in Team, then check the character's movement and CODE console. A successful upload alone does not confirm that the script is running correctly. Use **Stop** in the roster when needed.

For later changes, follow **edit → Save profile → Preview saved deployment → Deploy saved profile**. Saving alone does not update running scripts. Deployment remains unavailable while edits are unsaved or an operation is in progress.

The [first farming guide](dashboard-v2/docs/FIRST-FARMING.md) provides additional setup details and runtime limitations in French.

## Dashboard features

| Screen | Purpose |
| --- | --- |
| Team (`#team`) | Character roster and status; open Team setup, Farming & events, Equipment & bags, or Activity & insights when needed |
| Merchant (`#merchant`) | Current merchant activity and blockers; configuration and planning open in focused dialogs |
| Bank (`#bank`) | Searchable bank snapshots; Bank actions opens deposits, sorting and recurring deposit rules |

The Studio theme uses a dark palette, spacious layouts and system typography. Retro remains available in the theme selector. The main navigation has exactly three destinations. Setup, inventory, farming, events, performance, deployment history and diagnostics remain available as contextual tools rather than separate pages. Existing links such as `#events`, `#inventory` and `#deployments` open the corresponding Team tool.

Saving and deploying remain separate. You can close a tool without losing changes already made to the profile draft. Merchant seasonal activities are under **Merchant → Configure merchant → Overview**.

XP and gold per hour depend on received telemetry. `Loot Gold/h` tracks loot events; `Balance gains/h` can include transfers. Missing telemetry means the current state is unconfirmed. The WebSocket indicator describes the connection to the dashboard, rather than a character's online status.

## Dashboard usage

Select **Usage** beside Search to review page visits, tool opens, control interactions, active days and last use. Filter by area, used/unused features, and the last 7, 30 or 90 days. Collection starts when this version is first opened; past usage cannot be reconstructed.

Only registered feature identifiers, counters and dates are kept in this browser's local storage. No form values, search text, character names or credentials are collected, and no usage data is sent to the server. Pause/resume, reset and JSON export are available in the report. Opening the report does not count as feature use; background polling and game telemetry do not count. Interactions describe UI activity, not successful game operations or time spent.

The preview, development and live dashboard have separate storage when their browser origin differs (including hostname or port). Clearing browser data removes the history. Counts are decision aids: zero use alone does not establish that a rare, unavailable or automated feature should be removed.

## Configuration and private data

The setup wizard stores a verified token in `credentials.json` inside the local data directory. Alternatively, set `AL_MCP_TOKEN` in the server process environment. Environment values take precedence over the saved token. No `.env` file is loaded automatically. Never put a token in source code or an exported profile.

| Variable | Purpose | Default |
| --- | --- | --- |
| `ALCC_PORT` | Local API port | `9320` |
| `ALCC_DATA_DIR` | SQLite, telemetry, backups, and generated bundles | `AdventureLandDashboard` under `LOCALAPPDATA`, or the user home directory |
| `AL_CODE_DIR` | Character script directory | Sibling `code/` directory |
| `ALCC_CARACAL_DIR` | Optional external caracAL installation | Sibling `caracAL/` directory |
| `ALCC_DISABLE_LEGACY_CREDENTIALS` | Set to `1` to disable the legacy MCP configuration fallback | Disabled |
| `AL_MCP_TOKEN` | Game account token | Wizard's saved token, then legacy MCP configuration if available |

Set environment variables before starting the server. For example, in PowerShell:

```powershell
$env:ALCC_DATA_DIR = Join-Path $env:LOCALAPPDATA 'ALCommandCenter-Test'
pnpm dev
```

This uses a separate local profile and data directory. The Vite development proxy targets port `9320`; changing the API port also requires updating that proxy. The compiled application served by Fastify does not need the Vite proxy.

Credentials, runtime data, backups, installed dependencies, the full game repository, and unrelated local projects are excluded from the publication scope.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| UI or API unavailable | Restart `pnpm dev`; check Node 24 and ports 5173/9320. For a compiled build, run `pnpm --dir dashboard-v2 server`. |
| Token rejected | Retry the wizard connection and check the associated account. An existing `AL_MCP_TOKEN` environment variable overrides the stored token. |
| `Open character first` | Open that character manually in Adventure Land on the selected server. |
| Deployment unavailable | Save the draft and wait for any current operation to finish. |
| No telemetry | Check the CODE console, running script, and access to the local API from the game browser. |
| Save conflict | Preserve useful edits, use `Discard edits` to reload the profile, then reapply your changes. |

## Continuous integration

GitHub Actions runs three workflows on pushes to `main` and on pull requests. Feature branches are validated through their pull request, avoiding duplicate runs for the same change:

- **Build and tests**: frozen dependency installation, publication audit, TypeScript/frontend build, full Vitest suite, script tests, and an API/UI smoke test.
- **Code quality**: Oxlint checks.
- **Dependency and publication audit**: secret-pattern checks within the explicit publication scope and pnpm dependency auditing, failing on high or critical advisories. It also runs weekly.

The workflows need no game credentials and never deploy characters. Dependabot proposes weekly dependency and GitHub Actions updates. The smoke test uses temporary data with no enabled characters. TypeScript checks currently cover the frontend and shared schema; the backend is not yet fully checked in strict mode.

`main` requires pull requests, an up-to-date branch, and successful `validate`, `lint`, and `audit` checks. Unresolved review conversations block merging. These rules also apply to administrators; force pushes and branch deletion are disabled. No outside approval is required for solo maintenance.

Run the same checks locally from the repository root after installing dependencies:

```sh
pnpm lint
pnpm build
pnpm test
pnpm test:combat
pnpm test:smoke
pnpm audit:public
pnpm --dir dashboard-v2 audit --audit-level high
```

Tests isolate their data and do not deploy real CODE. The smoke test exercises routes in memory without opening a listening port or reading account credentials. Secret-pattern scanning is a limited check, not proof that all possible secrets are absent.

## Repository layout

| Directory | Contents |
| --- | --- |
| `dashboard-v2/` | Maintained application: UI, API, schemas, tests, and assets |
| `code/` | Character scripts and in-game interfaces |
| `combat/` | Combat modules shared by historical scripts |
| `tests/` | Script and publication-scope tests |
| `tools/` | Maintenance, auditing, and local export tools |
| `docs/` | Architecture notes and publication audit |

Character names in source files are historical examples. The dashboard builder injects names and settings from your own profile. Prefer `*-v2.js` scripts; historical variants remain for compatibility and regression tests. The current rogue script specializes in crabs.

Further documentation, currently primarily in French: [dashboard reference](dashboard-v2/README.md), [first farming](dashboard-v2/docs/FIRST-FARMING.md), and [scripts and in-game interfaces](code/README.md).

[Halloween activities](dashboard-v2/docs/HALLOWEEN-2026.md) explains Headless Horseman, Graveyard Rising, daily Trick or Treat visits and automated Witch’s Cipher brewing.

See the [cleanup report](docs/CLEANUP-2026-10-21.md) for the latest maintenance changes, validation scope and remaining work.

## Preparing a clean export

```sh
pnpm export:public
```

This creates `.release/public-candidate/` using an explicit file allowlist and a SHA-256 manifest. It refuses to overwrite an existing export and stops if configured secret patterns are detected. To choose a new destination, run `node tools/prepare-public.mjs .release/another-candidate`. The tool does not create a remote repository or push to GitHub.

The generated `PUBLIC-MANIFEST.json` belongs to its export directory and is not tracked as a permanent repository snapshot. Each new export generates fresh checksums.

## Credits and licensing

Read the [repository audit](docs/REPOSITORY-AUDIT.md), [third-party notices](THIRD_PARTY_NOTICES.md), and [security policy](SECURITY.md). Game assets retain their `AdventureLandOnlyUse` terms. Some community-derived scripts still require licensing clarification, and a license for original project contributions has not been selected. Public availability does not grant a blanket MIT license or resolve third-party permissions.
