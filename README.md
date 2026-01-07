# Alliance Dashboard userscript


## Overview
Alliance Dashboard is a userscript UI overlay for Command & Conquer: Tiberium Alliances that centralizes alliance management tasks: roster tracking, team coordination, POI planning, targets/milestones, and chat message preparation.

The codebase is a modular TypeScript project built with Vite and bundled into a single userscript output: `dist/AllianceDashboard.user.js`.


## Global features
- **Floating button (FAB)**
  - Opens/closes the dashboard panel
  - Draggable (position is saved and restored)
  - Panel is positioned relative to the FAB
- **Tabbed panel UI**
  - Tabs are rendered inside a single dashboard shell
  - Chat logs tab is pushed to the far right and forced to be the last tab
- **Local persistence (localStorage)**
  - All dashboard data is stored with the prefix `AllianceDashboard_v01_` (world-specific)
- **Manual refresh**
  - Player data refresh is triggered via the UI (no aggressive polling)
- **Theme color (accent)**
  - Accent color can be configured from the **Diagnostics → Settings** section
  - Applies globally to buttons, tabs, highlights and other non-semantic accents
  - Stored per world+player
- **Map utilities**
  - Center map to player base coordinates
  - Base move order: Map pick mode (click map to select coords) used for move-base orders

---

# Tabs

Tab order:
Diagnostics / Players / Teams / Targets / POI / (Endgame*) / Chat logs

\* Endgame tab is only shown when at least **32** alliance members have a hub.

## Players
- **Players list**
  - Shows players fetched from alliance member IDs + public player info
  - Presence/last-seen indicators
  - **Team badge** next to player name if assigned to a team
  - **Tier badge** (Gold/Silver/Bronze) next to player name (computed from Targets thresholds)
- **Filters**
  - **Online**: includes `Online` and `Away`
  - **Has hub**: only players with a hub
  - **Team** dropdown: filter players assigned to a specific team (hidden if no teams exist)
  - **Counter**: shows `filtered / total`
- **Player details**
  - Role / rank / points / bases / last seen
  - Offense + defense stats (avg/best) when available from alliance roster
  - **Notes** per player (stored in localStorage)
- **Bases section (per player)**
  - Lists known bases from `GetPublicPlayerInfo`
  - **Center map** button per base
  - **Give order to move base**
    - Creates a chat log entry containing `[pick]`
    - Activates map pick mode to replace `[pick]` with `[coords]x:y[/coords]`

## Teams
- **Create / delete teams** (PVP or PVE)
  - Delete is confirmed (also clears assignments)
- **Assign players to teams**
  - Team assignment is stored per player
- **Team objectives (with optional POI detection)**
  - Add objectives by clicking **Pick objective** then clicking on the map
  - If the clicked tile is a POI and the client exposes the data, the script automatically stores:
    - `poiTypeId` (1-7)
    - `poiLevel`
  - Objectives are displayed as pills like `x:y` (and can include a POI label when detected)
  - Clicking an objective pill **centers the map** on it
  - Remove objective via `×`
- **Team chat helpers**
  - **Send objectives**: adds a chat log line containing objectives as `[coords]x:y[/coords]`
  - **Send players**: adds a chat log line containing assigned players as `[player]Name[/player]`

## Targets
Player progression goals.

- **Scopes (Everyone vs Team overrides)**
  - Targets are editable in two scopes:
    - **Everyone (global)**: the default thresholds and milestones for the whole alliance
    - **Team: <name>**: optional per-team overrides
  - A team scope can either:
    - **Inherit Everyone** (override disabled)
    - **Override Everyone** (override enabled)
  - When a player is assigned to a team with an enabled override, their **Tier** and target-based actions use that team’s tiers/milestones.

- **Stat targets (tiers)**
  - Configure **Gold / Silver / Bronze** thresholds:
    - **Max off** → `BestOffenseLvl`
    - **Max def** → `BestDefenseLvl`
    - **Avg def** → `AvgDefenseLvl`
  - Tier is computed per player and shown in the Players list
- **Base milestones (global deadlines)**
  - Define milestones like: `N bases by <deadline>`
  - Used for reminders/actions (based on roster/public base count)
- **Actions**
  - **Send Gold players / Silver players / Bronze players**: appends chat logs listing qualifying players
  - **Send missing bases**: appends a chat log listing players missing at least one base milestone

## Chat logs
A queue of message lines you want to send to alliance chat.

- Stores queued lines (not sent automatically)
- Display order is **oldest first** (oldest queued line is on top)
- Used by:
  - Move-base pick workflow (`[pick]` → `[coords]x:y[/coords]`)
  - Teams “Send objectives / Send players”
  - Targets actions (tier lists / missing bases)
  - Endgame “Call for next attack” (queues `[b]NEXT ATTACK:[/b] Name`)
- **Per-line actions**
  - Edit text in place
  - Send
  - Copy
  - Remove
- **Pick mode integration**
  - Cancel pick (ESC also works)
- **Pre-recorded orders**
  - Save reusable message templates
  - Click template to send to chat
  - Delete templates

## Endgame
Endgame helper tools for calling attackers one-by-one.

- **Availability**
  - Only appears when at least **32** members have a hub
- **Quick orders**
  - Buttons for common alliance-wide orders
  - Clicking a quick order **queues it into Chat logs** (does not send immediately)
- **Virus injections (last 8h)**
  - Shows code owners (`hc`) who have **not** injected virus in the last 8 hours
  - **Refresh virus status**: loads alliance member data + recent viral-attack notifications
  - **Call missing injections**: queues a single chat message with all missing player names
- **Player list**
  - Sorted by **Best Offense** (descending)
  - Filters: Online, Has hub
  - **Call for next attack**: queues `[b]NEXT ATTACK:[/b] <player>` into Chat logs
  - **Attack done**: moves player into “Already attacked” list (persisted)

## POI
POI planning and simulation.

- **Alliance POI overview**
  - Shows per-POI-type score, rank, and bonus totals
  - Uses POI type names + colors
  - Bonus formatting:
    - Tiberium/Crystal/Reactor: `+X/h`
    - Other POIs: `+Y%`
  - Values are rounded to avoid floating point artifacts
- **Owned POIs**
  - Shows all owned POIs grouped by POI type
  - Each type group is collapsible (default collapsed)
  - Compact per-POI rows with level/score and a **Center** button
- **Tier / rank simulator**
  - Simulate captures (supports multiple POI types at once)
  - Displays base score, simulated score, tier, rank, bonus and total bonus
  - Shows **global POI factor** and **rank boost** separately
  - Bonus formatting:
    - Tiberium/Crystal/Reactor: `+X/h`
    - Other POIs: `+Y%`
  - Values are rounded to avoid floating point artifacts
- **Team objectives integration**
  - Objectives can store detected POI type/level at creation time
  - Simulator can simulate directly from team objectives
  - Objectives already simulated are hidden from the “available” list

## Diagnostics
- **Settings**
  - **Theme color** palette (9 accent colors)
- **Tools**
  - **Export players CSV**
    - Exports a `;`-separated CSV
    - Numbers are rounded to **2 decimals**
    - Columns include:
      - `Name, Role, Rank, Score, Bases, LastSeenText, Team, Tier, AvgOffenseLvl, BestOffenseLvl, AvgDefenseLvl, BestDefenseLvl, HasControlHubCode (Yes/No)`
  - **Export players TSV**
    - Same columns as CSV, but tab-separated
- **Save / Restore (localStorage)**
  - Copy backup JSON
  - Download backup
  - Restore from backup JSON
  - Clear ALL dashboard data
- **Log viewer**
  - Shows recent internal log lines
