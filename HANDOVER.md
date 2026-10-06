# Retro Rack: handover from the Claude chat

This file captures what was built, what was decided and why, and what's next, from the original chat where Retro Rack was created. Read it together with `CLAUDE.md`, which explains how the code works.

---

## 1. Status at handover (5 October 2026)

**Live and working**
- The game is at https://flopp-r.github.io/retro-rack/, served by GitHub Pages from the public repository `github.com/flopp-r/retro-rack` (branch `main`, root folder).
- The relay is a Cloudflare Worker named `retro-rack-relay` on the free plan, deployed automatically by Cloudflare Workers Builds from the repository's `relay/` folder. Its `workers.dev` address is in `config.js`; leave that file alone.
- The live version includes everything up to the **open rooms list** (relay version with the `Lobby` Durable Object, migration `v2`) and the **stacked notifications**.

**Built and tested, possibly not yet uploaded**

The "update package" adds:
- instant replay;
- touch fine-aim buttons;
- quick chat;
- concede and re-rack;
- matches (first to 3, 5 or 7);
- trick shots with "Show me" demos, plus a ball editor and saved layouts;
- the project restructure: `src/`, `vendor/`, `tools/`, `tests/`, `CLAUDE.md` and this file.

**How to tell:** if the repository has a `src/` folder, the update is in. If not, the repository only holds the built `index.html`, `config.js`, `README.md` and `relay/`. The update package then needs uploading first.

---

## 2. Working preferences

Personal working preferences are kept in the Claude Code project's own instructions, not in this public repository. Project conventions (UK English, metric units, a clean console, testing before pushing) are in `CLAUDE.md`.

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
8. **The update package (see section 1):** replay, touch aim buttons, chat, concede and re-rack, matches, trick shots, and the project restructure for Claude Code.

---

## 4. Key decisions and why

**Delivery**
- **One self-contained `index.html`,** with fonts and three.js inlined, so the game works offline as a single downloaded file. Online play needs `config.js` next to it.
- **three.js is pinned at r159** (ES-module build, wrapped by `tools/build.js`). Upgrading is possible but not needed. If you do upgrade, re-check lighting, the `DepthTexture` outline pass and the console.

**Online play**
- **Determinism over server-side physics.** The relay never simulates. Both browsers run identical physics; the rules for that are in `CLAUDE.md`. This keeps the relay tiny and free, and enables replays.
- **The trust model is aimed at friendly games:**
  - Receivers accept only shot inputs and recompute the result themselves. Cue ball placement is validated, and the strike velocities are checked.
  - The shooter's `sync` is a cross-check; on a mismatch, the receiver warns and adopts the shooter's table.
  - Known gaps: aiming aids on someone's own screen can't be detected. A modified client could stall a game by sending an illegal cue ball placement (honest clients can't do this). A duplicated browser tab shares the client id with the original tab, so the two fight over the seat.

**Rooms**
- A listed room appears only while its creator waits, and disappears when a second player joins or the creator leaves. Nobody can join a game in progress or take a seat someone dropped out of.
- The list forgets rooms after 45 minutes waiting. Unused rooms are deleted after 6 hours.
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
  - "Lose the second visit when on the black" was deliberately left out because pubs differ; it could become an option.
- **Physics limitation:** the cue is always level, so there are no jump or massé shots.

**Trick shots**
- Each demo was found by searching with the real physics (`tools/find-trick-demos.js`) and checked for robustness, meaning nearby aims also work.

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

**CPU** (`DIFF` in `core.js`)
- **Aim error, by level:** 1.3° on Easy, 0.55° on Medium, 0.22° on Hard, 0.09° on Expert.
- **Hard and Expert:** also plan position, play safeties and re-test their best options under noise.
- **When snookered:** all levels try one-cushion kicks.

---

## 6. How things were tested in the chat

- **Physics and rules:** Node scripts, now collected as `tests/physics.test.js` (22 tests). These cover bit-identical determinism, pockets on both tables, breaks, the rules for every mode, and the trick demos.
- **The browser:** headless Chromium (Playwright) with software WebGL (SwiftShader), for screenshots and scripted play. The page exposes `window.__rr` (state, world, game, aim, NET, beginStroke and so on) to make scripting easy.
- **Online:** the real Cloudflare runtime ran locally (`cd relay && npx wrangler dev`), and the game was opened as `index.html?relay=ws://127.0.0.1:8787` in **separate browser contexts**. Each tab gets its own client id from sessionStorage. After every shot, the ball positions and the `game` objects of both clients were compared, and they must be identical. Also tested:
  - reload rejoin;
  - a full room;
  - rematch;
  - re-rack and concede;
  - chat;
  - replaying while the opponent shoots.
- **Software WebGL is slow,** so keep test windows small (about 480×360, pixel size 6).

---

## 7. Ideas list (discussed, not built)

- **Installable app (PWA):** the most wanted next feature, and the suggested first Claude Code job. It needs a manifest, icons and a service worker for offline CPU play. Version the cache so updates arrive; avoid people getting stuck on an old copy.
- **Stats:** pot percentage, wins per CPU level, longest run and break-and-dish, stored in the browser.
- **Small comforts:**
  - a "rejoin last game" menu button;
  - a fullscreen button and a "turn your phone sideways" hint;
  - a volume slider;
  - phone vibration on a pot.
- **A rules option:** "lose the second visit when on the black", for reds & yellows.
- **Possibly:** a colour-blind-friendly marking option for reds and yellows.
- **Discussed and set aside:** spectators (needs a lot of relay work), turn timers (annoying between friends) and achievements.

---

## 8. How changes are made

- Work happens in Claude Code, which pushes to GitHub through its GitHub connector. That is set up and working.
- **Node.js** is needed for `node tools/build.js` and `node tests/physics.test.js`. If it's missing, install the LTS version from nodejs.org.
- **The routine:** describe a change; Claude Code edits `src/`, rebuilds `index.html`, runs the tests, then pushes once the change is approved. Check the live site with Ctrl+F5 a couple of minutes later.
- **Keep it to one change at a time.** Test online changes with the local relay before pushing, since both players need the same version.
- **To undo a change,** revert it and push the revert, so the site goes back to how it was.

**Suggested first message in a new session:**
> Read CLAUDE.md and HANDOVER.md. Run the tests and the build, and tell me whether everything is working. Don't change or push anything yet.
