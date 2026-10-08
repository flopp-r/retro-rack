# Retro Rack: decisions, history and changes

This file records why Retro Rack is the way it is: the decisions and their reasons, reference numbers, the ideas list, and a dated list of every change shipped. It began as the handover from the Claude chat where the game was first built; work has continued in Claude Code since. Read it together with `AGENTS.md`, which explains how the code works and how to change it.

---

## 1. Current status

- The game is live at https://flopp-r.github.io/retro-rack/, served by GitHub Pages from the public repository `github.com/flopp-r/retro-rack` (branch `main`, root folder).
- The relay is a Cloudflare Worker named `retro-rack-relay` on the free plan, deployed automatically by Cloudflare Workers Builds from the repository's `relay/` folder. Its `workers.dev` address is in `config.js`; leave that file alone.
- Everything in section 9 (changes shipped) is live. The version shown at the bottom of the menu matches the `BUILD` value in the committed `index.html`.

---

## 2. Working preferences

Personal working preferences are kept in the owner's own Claude Code settings, not in this public repository. Project conventions (plain-language explanations, UK English, metric units, a clean console, testing before pushing) are in `AGENTS.md`.

---

## 3. How the project got here (short history)

1. **First version:** a single-file 3D pool game. Pixel-art rendering (low-resolution render target, depth outlines, Bayer dithering, colour quantisation) and realistic physics. 8-ball, 9-ball and practice modes, a CPU with four levels, a same-device mode, aim guides by difficulty, an orbit camera, a cue view and an overhead view.
2. **Clean console:** switched from the deprecated three.js UMD build to the r159 ES-module build, inlined. Migrated from `useLegacyLights` to physical light units, matching the old look (see section 5).
3. **Reds & yellows:** added a 7 ft British table with 2-inch balls and tight rounded pockets, a baulk line, and British pub rules.
4. **Aiming:** fine aim became one step per key press (0.05°, auto-repeat ignored). Shift held with the arrow keys turns smoothly, at 10°/s easing up to 40°/s. An aim angle readout was added.
5. **Spin widget:** fixed it so the label always takes two lines (no layout jumping), the dot tracks the pointer exactly, and it renders at an exact 3× pixel scale. The HUD was made about 15–20% smaller.
6. **Online 1v1:**
   - GitHub Pages plus the Cloudflare relay.
   - Deterministic physics.
   - The "input-only check" anti-cheat.
   - Live aim preview, reconnect and resync after a reload, and rematches.
   - The relay address moved into `config.js`.
7. **Open rooms list:** Listed or Private rooms, plus notifications stacked in one column so they never overlap.
8. **The update package:** instant replay, touch fine-aim buttons, quick chat, concede and re-rack, matches (first to 3, 5 or 7), trick shots with "Show me" demos plus a ball editor and saved layouts, and the project restructure for Claude Code (`src/`, `vendor/`, `tools/`, `tests/`).
9. **Claude Code (from 6 October 2026):** every change since has gone through a pull request; they are listed in section 9.

---

## 4. Key decisions and why

**Delivery**
- **One self-contained `index.html`,** with fonts and three.js inlined, so the game works offline as a single downloaded file. Online play needs `config.js` next to it.
- **three.js is pinned at r159** (ES-module build, wrapped by `tools/build.js`). Upgrading is possible but not needed. If you do upgrade, re-check lighting, the `DepthTexture` outline pass and the console.

**Online play**
- **Determinism over server-side physics.** The relay never simulates. Both browsers run identical physics; the rules for that are in `AGENTS.md`. This keeps the relay tiny and free, and enables replays.
- **The trust model is aimed at friendly games:**
  - Receivers accept only shot inputs and recompute the result themselves. Cue ball placement is validated, and the strike velocities are checked.
  - The shooter's `sync` is a cross-check; on a mismatch, the receiver warns and adopts the shooter's table.
  - Known gaps: aiming aids on someone's own screen can't be detected. A modified client could stall a game by sending an illegal cue ball placement (honest clients can't do this). (A duplicated browser tab used to share the original tab's client id and fight over the seat; it now picks a fresh id.)

**Rooms**
- A listed room appears only while its creator waits, and disappears when a second player joins or the creator leaves. Nobody can join a game in progress or take a seat someone dropped out of.
- The list forgets rooms after 45 minutes waiting. Unused rooms are deleted after 6 hours.
- Rejoin is kept on the player's own device for 3 hours, well inside the 6 hours a room lasts. It uses the same seat-by-client-id reconnect as a reload, so the relay needed no change. The table itself lives only in the players' open pages, so if both close, the frame starts again.
- Chat is preset messages only (sent as an index), so there's nothing to moderate in listed rooms.

**Free tier**
- Uses the WebSocket Hibernation API, keep-alive pings answered automatically, no polling, and the open rooms list is pushed over WebSockets. Usage is far inside the free limits.

**Tooling**
- **Changes reach GitHub through Claude Code's GitHub connector.** This has been working well; keep using it. Pushing to `main` deploys to the live site, and to the relay if `relay/` changed.

**Game rules**
- **8-ball:** WPA-style but no called pockets. An illegal break (no pot and fewer than 4 balls to a rail) counts as a foul. The 8 potted on the break is re-spotted.
- **9-ball:** no push-out rule.
- **Reds & yellows:**
  - A foul gives the opponent two visits, and the first is a free ball (any ball may be hit first).
  - The two-visit advantage carries while the player keeps potting.
  - An in-off gives ball in hand behind the baulk line.
  - Potting the opponent's colour is a foul.
  - The black on the break is re-spotted, not re-racked.
  - "Lose the second visit when on the black" is an option on the setup screen ("On black: Two visits / One visit"), off by default because pubs differ.
- **Physics limitation:** the cue is always level, so there are no jump or massé shots.

**Trick shots**
- Each demo was found by searching with the real physics (`tools/find-trick-demos.js`) and checked for robustness, meaning nearby aims also work.

**Career (chosen by the owner, October 2026)**
- **A tour of tournaments,** tier by tier from the pub to a world final, rather than league seasons or a simple ladder. Each event is an 8-player knockout against named computer players, with longer matches in later rounds.
- **All three game types across the tiers:** reds & yellows in the pubs, 8-ball in clubs and halls, 9-ball at the top.
- **Rewards are looks only:** prize money will buy cloths, cues, ball sets and venue looks. No entry fees, so you can't go broke. Player "upgrades" were rejected: your skill is your real aim, and boosting it would fight the physics.
- **The aim guide is chosen when a career starts** and stays fixed for it, like a difficulty setting.
- **Opponents' strength is measured, not guessed:** `tools/sim-career.js` plays each against the Medium CPU (80 frames, accurate to about ±45 rating points). Personalities come from the CPU's own settings: accuracy, long-pot weakness, safety play, break power, and nerves on the final ball. The pub tier runs from about 1245 to 1560 (Medium is 1500), so its final boss is a little stronger than the Medium CPU; later tiers will go much higher.
- **Matches between computer players** in a draw are settled from their ratings with a seeded random number, so they're instant and never change on reloading.
- **Saving:** in the browser (localStorage) after every shot, plus Save to file / Load from file. There are no accounts or cloud saves (that would need a login and server storage). Safari can clear a site's storage after 7 days without a visit, and clearing browsing data deletes it, so the README tells players to keep a file copy.
- **Built in stages,** each playable: Stage 1 (pub tier, opponents, draws, saving), Stage 2 (more tiers and game types, venue looks, spending prize money), Stage 3 (rivals, story cards, trick-shot challenges, trophy cabinet, world final).

**Career, Stage 2 (October 2026)**
- **Difficulty aimed at the owner,** who beats the Medium CPU and loses to Hard: the national tour's best (The Metronome) measures about 70 points below the Hard CPU in 9-ball, and every tier's championship has the tier's strongest player. Yardsticks measured with `tools/sim-career.js`, Medium = 1500: Easy 1245 (8-ball) and 1309 (9-ball); Hard 1819 (8-ball) and 1728 (9-ball). 9-ball squeezes ratings together (its breaks and lucky pots matter more), so for the stars a 9-ball rating is stretched by 319/228 to compare with 8-ball. The tiers: pub 1245 to 1560, club 1420 to 1625, hall 1515 to 1705 (8-ball), national 1535 to 1655 (9-ball, 1549 to 1717 stretched).
- **Personalities can cost more than expected.** Nerves on the final ball hurt far more in 9-ball, where most frames are decided on the 9: The Metronome with nerves 1.5 measured only 1535, so his nerves are now 1.25.
- **The shop sells cloths and cues only,** so the balls always stay readable; cloth colours were chosen to keep reds, yellows and the black clear.
- **Bought looks belong to the device,** not the career: they work in every game, survive retiring, and come with a career loaded from a file.
- **Online, looks are shared:** each player's cue shows on both screens, and the table wears the host's cloth (one table, one cloth, like the host choosing the game). Unknown ids from the other side fall back to the defaults.
- **A room per tier:** carpet, walls, skirting and the neon sign (with the event's name) change; the table and lighting don't.

**Settings and graphics (October 2026)**
- **The sharpest picture is the default** (pixel size 1×, full colours), as the owner chose, and it was applied once to everyone already playing (`S.gfx`), since saved settings would otherwise keep the old 3× and 8 shades. It costs more on phones and softens the pixel-art look; anyone can pick a bigger pixel size in Settings.
- **Settings is a big panel** in four sections, two columns on computers, with bigger buttons; it fits a 1280×720 screen without scrolling. A click outside it closes it.
- **The browser tests draw in software,** so the sharper default made them slower.

**Looks: cases, the locker and gloves (October 2026)**
- **Earning, as the owner chose:** cases from career event wins (a better grade for championships), from frames won against the computer (a better grade on harder levels), from the day's first online win, and bought with money; every case costs money to open. Duplicates are sold for money (the owner chose this over a crafting currency). Practice and same-device games earn nothing, because they're too easy to farm.
- **One wallet per device, in the locker:** opening cases needs money outside the career too, so the career's prize money, the pay for frames won against the computer, the daily online win and sold duplicates all go into one locker. It survives retiring a career and travels inside a career file. Loading a file merges its locker in and never takes anything away (re-loading the same file can't stack money).
- **Fair randomness:** the odds are shown on every case, an epic or better is guaranteed within 8 cases, and legendaries only come in silver cases and better. The reel decides the prize first and then lands on it honestly: the other items on the strip are drawn from the case's own odds, and where it stops within the prize's tile is random, so it never fakes a near miss (the trick real-money loot boxes use).
- **A starter case:** a new locker has one silver case and £40 to open it, so everyone sees the reel straight away.
- **Mythic, a fifth rarity, in every case (the owner chose "every case, tiny"):** 0.2% in bronze, 0.5% silver, 1% gold, 3% diamond, so even a bronze case can hold one. It counts for the guarantee like any epic or better. Six mythics, two of each kind (the owner's pick), and each one moves, which nothing else does.
- **The case opening is a show (the owner asked for a dimmed room, a reel filling most of the screen and a background in the prize's colours, livelier the rarer it is):** the room stays barely visible behind the dim rather than going black, so it still feels like the same room. Nothing flashes: brightness changes smoothly, no faster than about 3 times a second, and with reduced motion the reel doesn't spin, the screen doesn't shake and the background is one still picture.
- **Gloves look like the sports and tactical gloves in shooting games (the owner asked for "CS gloves"),** after three rounds of prototypes: blocky cartoon gloves, then smooth realistic hands, then simplified ones. The owner asked for less wrist, less surface detail and no fingertips, so each hand is a rounded palm, two jointed sections per finger and thumb ending in a stub, and a short cuff. The glove types differ by small, low parts (a slim back panel, a knuckle bar or guards, finger pads, a strap tab, wraps), kept subtle at the owner's request. Most novelty gloves (oven mitt, washing-up, goalkeeper and so on) were replaced by real glove types; boxing, robot and skeleton stay as novelties. Gloves (and their reactions) add a little of their own colour as glow, because the faces towards the camera get little light and otherwise look grey. Reactions are off with reduced motion.
- **Dev mode exists so the owner can try every look:** a secret word, typed as the online name, swaps in a test locker with everything; the real locker is untouched. The word is known only to the owner; the public code holds just its fingerprint.
- **Cloth patterns stay low-contrast:** each pattern's colour is close to its cloth's, and every one was checked in screenshots with the balls on the table.
- **Two open pages share one locker:** every change re-reads the stored locker first, and the other page updates when it hears about the change. Chromium only passes these changes between pages reliably over http(s), so the locker's browser test runs on the local web server rather than from disk.

---

## 5. Reference numbers

**Tables** (playing area, ball size)
- **US 9 ft:** 2.54 × 1.27 m, balls 57.15 mm and 170 g. Pocket mouths: corners 116 mm, sides 132 mm. Jaw angles 38° and 76°. Head string at a quarter of the length.
- **UK 7 ft:** 1.83 × 0.915 m, balls 50.8 mm and 140 g. Pocket mouths: corners 89 mm, sides 97 mm. Jaw angles 52° and 80°, rounded with fillets of 30 mm (corners) and 24 mm (sides). Baulk line at a fifth of the length.

**Physics**

| Quantity | Value |
|---|---|
| Sliding friction | 0.2 |
| Rolling resistance | 0.010 |
| Spin decay | 10.9 rad/s² |
| Ball–ball restitution | 0.95, with speed-dependent friction (this produces throw) |
| Cushion restitution | 0.88 − 0.035 × normal speed, minimum 0.62 |
| Cushion friction | 0.2 |
| Cushion nose height | 0.27 R above the ball's centre |
| Cue mass | 0.54 kg |
| Tip restitution | 0.8 |
| Maximum tip offset | 0.5 R (the miscue limit) |
| Squirt | about 1.3° at full side spin |
| Time step | 1 ms |

**Power:** cue speed = 0.08 + 6.5 × power^1.7 m/s. Full power sends the ball off at about 9 m/s.

**Lighting**, in physical units, equal to the old legacy values × π:

| Light | Intensity |
|---|---|
| Hemisphere | 0.32π |
| Sun | 0.22π |
| Camera fill | 0.2π |
| Two point lights | 0.51π each, distance 6, decay 0.43 (fitted to the old falloff) |

**Cases** (`GRADES` in `looks.js`; a first guess, to be tuned once the owner has played)

| Grade | Common | Rare | Epic | Legendary | Mythic | Open | Buy |
|---|---|---|---|---|---|---|---|
| Bronze | 72% | 24% | 3.8% | 0% | 0.2% | £15 | £45 |
| Silver | 50% | 36% | 11.5% | 2% | 0.5% | £40 | £110 |
| Gold | 25% | 45% | 23% | 6% | 1% | £90 | £260 |
| Diamond | 0% | 50% | 34% | 13% | 3% | £200 | £600 |

- **Duplicates sell for** £10 (common), £30 (rare), £80 (epic), £200 (legendary), £500 (mythic).
- **Frames won against the computer pay** £5 (Easy), £15 (Medium), £30 (Hard), £50 (Expert), and every 3 at a level fill a case of its grade (bronze, silver, gold, diamond). Career frames fill the circuit's grade (pub bronze, club silver, hall gold, national diamond) without pay.
- **The day's first online win:** £30 and a gold case. **A new locker:** £40 and a silver case.
- **The collection:** 60 looks in cases (14 cloths, 20 cues, 26 gloves; 17 common, 18 rare, 12 epic, 7 legendary, 6 mythic), plus the shop's 5 cloths and 6 cues and the free white gloves.

**CPU** (`DIFF` in `core.js`)
- **Aim error, by level:** 1.3° on Easy, 0.55° on Medium, 0.22° on Hard, 0.09° on Expert.
- **Hard and Expert:** also plan position, play safeties and re-test their best options under noise.
- **When snookered:** all levels try one-cushion kicks.

---

## 6. How things are tested

- **Career rules:** `tests/career.test.js` (24 tests): tour data, tiers, draws, results and money, saving and loading (including saves from before the locker), and the opponents' CPU settings.
- **Looks:** `tests/looks.test.js` (17 tests): the catalogue, case odds over many openings, the guarantee, mythics, opening, buying, duplicates, earning, the saved locker, and career opponents' gloves.
- **Physics and rules:** `tests/physics.test.js` (27 tests). These cover bit-identical determinism, pockets on both tables, breaks, the rules for every mode, the trick demos, and that the context packs are up to date.
- **The browser:** headless Chromium (Playwright) with software WebGL (SwiftShader). The page exposes `window.__rr` (state, world, game, aim, NET, beginStroke and so on) to make scripting easy. The browser tests have lived in `tests/browser/` since 7 October 2026; `node tests/browser/run-all.js` runs them all (see `AGENTS.md`, Testing).
- **Online:** the real Cloudflare runtime runs locally (`npx wrangler dev`), and the game is opened with `?relay=ws://127.0.0.1:8787` in **separate browser contexts**, so each gets its own client id. After every shot, the ball positions and the `game` objects of both clients are compared, and they must be identical. Covered: reload rejoin, Rejoin from the home screen, a full room, rematch, re-rack and concede, chat, replaying while the opponent shoots, duplicated tabs, and version mismatches.
- **Software WebGL is slow,** so keep test windows small (about 480×360) unless the size is what's being tested.

---

## 7. Ideas list (discussed; the ones built since say so)

- **Installable app (PWA):** built in Claude Code, together with a version check for online play. The service worker is network first, so nobody gets stuck on an old copy; see `AGENTS.md`.
- **A pulsing marker on your own balls:** built, chosen instead of colour-blind markings. A gold halo round each ball you're on, shown only on your shot once groups are decided, with an on/off setting. A ring flat on the cloth was tried first but vanished in the cue view, so the halo faces the camera.
- **Stats:** pot percentage, wins per CPU level, longest run and break-and-dish, stored in the browser. Set aside by the owner in favour of a career mode.
- **Career mode:** Stages 1 and 2 built (the pub, club, hall and national tiers, the shop and venues). Stage 3 is planned; see section 4, "Career".
- **Cosmetics overhaul:** built: the locker, cases with a spinning reel, patterned cloths, patterned and glowing cues, and floating gloves with small reactions; Settings and Fullscreen became corner icons in the menus. See section 4, "Looks".
- **A bigger case opening and a mythic rarity:** built: a dimmed room, a reel filling most of the screen, a background show in the prize's colours, and six moving mythic looks.
- **New menus:** built. Home leads to Single player (computer, practice) and Multiplayer (online, same device), then the game and its setup, with slide transitions, a "Play again" button and back-gesture support.
- **Small comforts:** a volume setting, a fullscreen button, a "turn your phone sideways" hint and phone vibration on pots and fouls are built.
- **Rejoin last game:** built. An online game left by accident (app closed, tab shut) shows a Rejoin button on the home screen for 3 hours. The table comes back if the opponent's game is still open; if both left, the same room starts a fresh frame. Possible next step: keep the table when both players leave (each page saves its snapshot and the room restores the newest), which changes how online games start.
- **A rules option:** "lose the second visit when on the black", for reds & yellows: built as "On black: One visit".
- **Adding balls to trick shots:** built ("Add balls", under "Edit table").
- **Possibly:** a colour-blind-friendly marking option for reds and yellows.
- **Discussed and set aside:** spectators (needs a lot of relay work), turn timers (annoying between friends) and achievements.

---

## 8. How changes are made

- Work happens in Claude Code, which pushes to GitHub through its GitHub connector. That is set up and working.
- **Node.js** is needed for `node tools/build.js` and `node tests/physics.test.js`. If it's missing, install the LTS version from nodejs.org.
- **The routine** (details in `AGENTS.md`, "How changes are made"): describe a change; Claude Code explains the options and builds the one chosen on a branch, rebuilds `index.html`, runs the tests and opens a pull request. When the owner says "merge it", it is squash-merged into `main`, and the live site updates a minute or two later (Ctrl+F5 to see it).
- **Keep it to one change at a time.** Test online changes with the local relay before merging, since both players need the same version.
- **To undo a change,** revert it and push the revert, so the site goes back to how it was.

**Suggested first message in a new session:**
> Read AGENTS.md and HANDOVER.md. Run the tests and the build, and tell me whether everything is working. Don't change or push anything yet.

**To give another AI the whole project:** give it the link https://raw.githubusercontent.com/flopp-r/retro-rack/main/CONTEXT.md (or the file itself). If it can't take a file that size, use `CONTEXT-SHORT.md`.

---

## 9. Changes shipped

Every change since the move to Claude Code, newest last. The version is the fingerprint shown at the bottom of the menu.

| Date | Pull request | Version | What changed |
|---|---|---|---|
| 6 Oct 2026 | #1 | 2880b44b | Installable app (manifest, icons, network-first service worker); online version check; a duplicated tab gets a fresh client id. |
| 6 Oct 2026 | #2 | 4f7f829c | Pulsing gold halo on the balls you're on, with an on/off setting. |
| 6 Oct 2026 | #3 | 93d5d1f2 | Volume setting, fullscreen button, "turn your phone sideways" hint, vibration on pots and fouls. |
| 6 Oct 2026 | #4 | 501f2ef4 | Phone layout for short screens: no HUD overlaps on phones held sideways. |
| 6 Oct 2026 | #5 | ff47e0c2 | New menus: home, single player and multiplayer screens with transitions, Play again, back-gesture support. |
| 6 Oct 2026 | #6 | c39a9ee4 | Shorter menu text, smaller cards, arcade-style sprites, a gliding panel; restored shared styles that #5 removed by mistake. |
| 7 Oct 2026 | #7 | c22e5b21 | "Add balls" in the trick-shot editor; "On black: One visit" rule option for reds & yellows. |
| 7 Oct 2026 | #8 | 9496b96e | "Move balls" renamed "Edit table", so Add balls is easier to find. |
| 7 Oct 2026 | #9 | 1dcd4655 | Rejoin button for an online game left by accident. |
| 7 Oct 2026 | #10 | 1dcd4655 (game unchanged) | Browser tests moved into `tests/browser/`; `AGENTS.md` guide; `CONTEXT.md` and `CONTEXT-SHORT.md` for other AIs; notes checked against the code. |
| 7 Oct 2026 | #11 | d768a32b | Career mode, Stage 1: the pub circuit (three reds & yellows knockout events, nine named computer opponents with measured strengths), saving after every shot, Save to file / Load from file. Also fixed: closing Pause with its button now redraws the aim guide and keeps the phone's back gesture working first time; with "reduce motion" on, menu cards no longer lift on hover. |
| 8 Oct 2026 | #12 | e6611735 | Career mode, Stage 2: the club and hall circuits (8-ball) and the national tour (9-ball), 27 new opponents with measured strengths, a shop of cloths and cues (looks work in every game; online, both players see each other's cue and the host's cloth), a room per tier. Also fixed: the event screen's list of players was squashed into one row. |
| 8 Oct 2026 | #13 | 31287894 | Cosmetics: the Locker (one wallet per device, cases and every look), cases in four grades with their odds shown, a guarantee and duplicates sold, opened on a spinning reel; money and cases for frames won against the computer, career events and the day's first online win; 12 patterned cloths, 18 patterned or glowing cues and 24 gloves in real glove types (shown to the other player online) with small reactions; dev mode with a test locker for the owner; Settings and Fullscreen as corner icons in the menus. |
| 8 Oct 2026 | #14 | 49866a3f | Settings is a much bigger panel in four sections (two columns on computers, bigger buttons), closed by clicking outside it; the sharpest graphics (pixel size 1×, full colours) are the default, applied once to everyone already playing. |

**Lessons worth keeping**
- #5 deleted CSS that Settings and the overlays also used (`.row`, `.lbl`, `.seg` and others), and nobody noticed until the live site looked wrong. The `fit` browser test now checks those styles.
- After #7, the version reported in chat was misremembered, so the owner waited for an update that had already arrived. Always read the version from the committed `index.html`.
- A comment placed partway along a line of code silently swallowed the code after it, twice: a closing bracket in #8 (caught by a syntax check) and the "close Pause" branch from #7, which went unnoticed until #11. Put comments on their own line or at the very end of a statement.
- Generic class names clash: the career's list of players used the class `field`, which the online screen's name box already styled, so the list was squashed into one row in #11 and nobody noticed until #12. Give new class names a prefix (`bField`, `cEvt`, `shopItem`).
- An early version of Rejoin saved one "last game" per browser. With two tabs playing each other on one device, a reopened tab could take over the seat of the tab that was still open. Entries are now kept per client id, and a Web Lock marks seats that are still open.
