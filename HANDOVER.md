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
- **Pixel size Max, not a literal 0.5×** (the owner asked for finer aim lines). 1× already uses every pixel of a screen at 100%, so finer than that only helps where the screen has more pixels than the page: Windows scaled to 125% or more, and phones. Max matches the screen exactly (one game pixel per screen pixel). A literal 0.5× was tried: it matched Max at 200%, was a little softer at 150%, and at 100% the browser shrank it, leaving the 1-pixel aim line thin, faint and dotted. Max costs more drawing in proportion (2.25 times the pixels at 150%), so it isn't the default.
- **Settings is a big panel** in four sections, two columns on computers, with bigger buttons; it fits a 1280×720 screen without scrolling. A click outside it closes it.
- **The browser tests draw in software,** so the sharper default made them slower.

**Looks: cases, the locker and gloves (October 2026)**
- **Earning, as the owner chose:** cases from career event wins (a better grade for championships), from frames won against the computer (a better grade on harder levels), from the day's first online win, and bought with money; every case costs money to open. Duplicates are sold for money (the owner chose this over a crafting currency). Practice and same-device games earn nothing, because they're too easy to farm.
- **One wallet per device, in the locker:** opening cases needs money outside the career too, so the career's prize money, the pay for frames won against the computer, the daily online win and sold duplicates all go into one locker. It survives retiring a career and travels inside a career file. Loading a file merges its locker in and never takes anything away (re-loading the same file can't stack money).
- **Fair randomness:** the odds are shown on every case, an epic or better is guaranteed within 8 cases, and legendaries only come in silver cases and better. The reel decides the prize first and then lands on it honestly: the other items on the strip are drawn from the case's own odds, and where it stops within the prize's tile is random, so it never fakes a near miss (the trick real-money loot boxes use).
- **A starter case:** a new locker has one silver case and £40 to open it, so everyone sees the reel straight away.
- **Mythic, a fifth rarity, in every case (the owner chose "every case, tiny"):** 0.2% in bronze, 0.5% silver, 1% gold, 3% diamond (6% since diamond cases became epic or better, below), so even a bronze case can hold one. It counts for the guarantee like any epic or better. Six mythics, two of each kind (the owner's pick), and each one moves, which nothing else does.
- **Reel tiles in their rarity's colour (the owner asked, to tell rarities apart at a glance):** a fade from a dark shade at the top to nearly the full colour at the bottom was chosen over solid colour, which washed out pale pictures on pale common and gold tiles.
- **Preview at the table, rather than a model in the locker (the owner's pick):** it shows the real cue, gloves and cloth exactly as in a game, animations and all, and costs no room on a phone's locker screen. The camera swings round the side of the cue instead of circling right round, because from behind the butt end the cue hand filled the screen. Looks you don't own can be tried on too (the owner's pick), so you can see a look before buying it or chasing it in cases.
- **The case opening is a show (the owner asked for a dimmed room, a reel filling most of the screen and a background in the prize's colours, livelier the rarer it is):** the room stays barely visible behind the dim rather than going black, so it still feels like the same room. Nothing flashes: brightness changes smoothly, no faster than about 3 times a second, and with reduced motion the reel doesn't spin, the screen doesn't shake and the background is one still picture.
- **Gloves look like the sports and tactical gloves in shooting games (the owner asked for "CS gloves"),** after three rounds of prototypes: blocky cartoon gloves, then smooth realistic hands, then simplified ones. The owner asked for less wrist, less surface detail and no fingertips, so each hand is a rounded palm, two jointed sections per finger and thumb ending in a stub, and a short cuff. The glove types differ by small, low parts (a slim back panel, a knuckle bar or guards, finger pads, a strap tab, wraps), kept subtle at the owner's request. Most novelty gloves (oven mitt, washing-up, goalkeeper and so on) were replaced by real glove types; boxing, robot and skeleton stay as novelties. Gloves (and their reactions) add a little of their own colour as glow, because the faces towards the camera get little light and otherwise look grey. Reactions are off with reduced motion.
- **Low-poly gloves (October 2026; the owner found the jointed-parts hands clunky and their blocks of colour too noticeable, and asked for something closer to CS):** a first attempt sculpted a smooth, realistic hand (rounded shapes melted together and meshed, with shading in the creases); the owner found it "morphish" and the shadows ugly, and pointed to a low-poly hand on Sketchfab (which the cloud session's network couldn't reach, so it was matched by style, not copied). Each hand is now a low-poly mesh: flat faces, six-sided fingers, an eight-sided palm and cuff, no shading of its own, bent by a skeleton. Panels are whole faces, and every trim is toned towards the glove's main colour (accent 60%, cuff 75%, back panel 40% of the way), so they read as panels rather than raised blocks. The fingers have all three sections again: the earlier "no fingertips" choice made them stubby, which was part of the clunky look; this was put to the owner. The cuffs keep their earlier short lengths. Boxing is one faceted mitt; the robot claw and the skeleton stay as jointed parts, since they're meant to look mechanical and bony.
- **The owner's own hand model (October 2026):** the owner supplied a procedural hand module, "Retro Rack hands" (one low-poly skinned mesh per hand, 17 bones, poses with cue anchors), and asked for it to be built in. It was checked on this project's three.js (r159) first: it renders correctly, the grip wraps the cue and the bridge lies flat. It went in as a port rather than a separate file, because the game is one self-contained page and three.js is imported as a module rather than a global: the same sizes, rings, poses and anchors, with texture positions added for the patterned gloves, the glove types' extras (back panel, knuckle guard, finger pads, strap, nails) mapped onto its parts, its fifteen parts merged into eight materials (fewer draw calls), and three reaction poses added (fist, thumbs-up, open hand). Two things were found and handled: a higher cue line (top spin) would have lifted the bridge off the cloth, so the hand tips up on its fingertips instead; and full back spin lowers the cue about 1 cm into the index knuckle, visible only from in front of the hand, which was left as it is. While here, the boxing glove's bridge was moved so the cue no longer runs through the mitt, and a textured glove's knuckle guard now wears the texture instead of a flat bright block.
- **Shot camera (October 2026; the owner asked for each shot to feel real, from the player's eyes, and picked "swing in, then back" for their own shots only):** the view swings down behind the cue during the backswing (about half a second, so the shot isn't delayed and online play is untouched), stays where the shot was played while the balls roll, and goes back to your view once they stop. Following the ball, or staying in first person, were the other choices. Off with reduced motion, and a Settings switch for anyone who prefers a still camera. After trying it, the owner found the view too low and close and the swing rushed: it now stands higher and further back (about 40 cm up and 60 cm back), and pressing Shoot holds the aim for 0.9 s while the view glides in on an eased curve before the cue moves. Online, the shot is sent when the stroke starts, after the hold, so both screens stay in step; the message itself is unchanged. After the strike the view now rises to a high angle over the long side of the table (the owner asked to see everything once the shot is taken, and picked the high angle over a straight-down view, which reads like a diagram and hides the reactions, and over a view from behind the shooter, which turns the table sideways on some shots). It waits 0.3 s so the strike is seen from the player's eyes, then rises over 1.2 s. The spin and power panel fades while it's up, because on a phone held sideways it covered the right-hand end of the table; the left-hand buttons stay, since Pause must stay usable, so on a phone they still cover the near left corner, as they do in every view.
- **Halloween, the first season (October 2026; the owner asked for cases of exclusive themed looks, two of each kind and rarity, with a whole room as the final reward):** two cases were the owner's own idea: a basic one (Trick) with normal odds and duplicates sold, earned and bought, and a premium one (Treat), bought only, that always gives something new. The premium case exists because with normal odds and duplicates the six mythics alone would take a few hundred cases; with Treat cases thirty finish it. The season runs 1 October to 10 November each year: the cases sell, and the daily Trick case comes, only then, but held cases open any time and nothing is taken away. The 30 looks are a series apart from the everyday cases and the 15 collections, so those don't get harder; each rarity's six pay a reward (the owner picked milestones as well as the final reward), and all thirty give the Haunted Hall. Prices: Trick £120 to buy and £20 to open; Treat £400, free to open. The Halloween cloths stay dark and low-contrast like the others (Pumpkin patch, Blood moon and Soul fire were toned down after screenshots, so red, orange and green balls stay easy to see); there's no lightning or anything sudden in the room, only slow candle flicker, as the game never flashes. The room keeps its decorations by the walls and under the table, never over it, so no view of the table is blocked (the beams run along the walls for the overhead camera's sake). Tests see a fixed date outside every season, so the earnings checks don't change with the calendar.
- **The phone's game screen (October 2026; the owner asked for icon buttons, a spin diagram that can be put away, a finer aim and a Controls panel whose keys work):** the buttons on the left fade with the spin panel while the shot camera is up (they still work, so Pause is always there). On phones the game's buttons became 34 px pixel-icon squares, about a third of the room the words took; Shoot keeps its word because it's the one button never to miss, and a long press shows a button's name, since icons alone are harder to read at first. Computers keep the words. The spin diagram folds away behind a small ball beside the power bar that still shows where the tip will strike, hidden at first on phones and shown on computers; on a phone the panel only gets slightly narrower, because the aim row sets its width, but the big pad is out of the way. For finer aim, sliding along the aim readout was chosen over a fine/normal switch (easy to forget which is on) and a second pair of arrows (no room): 4 screen pixels turn 0.01°. The old hold on an arrow jumped to 10°/s after a third of a second and overshot; it now starts at 0.5°/s and doubles every 0.4 s. Ctrl + ←/→ turns 0.01° (not Alt, which is the browser's Back). The Controls panel's keys can be tapped, which also gives phones the keys with no button (O, F, Q, E); the ones you watch happen close the panel, the ones you adjust with leave it open.
- **Following the next shot (October 2026, from a player's report: "the camera is just still, focused around the last ball"):** the free view never moved by itself, so after a pot it stayed on the last ball, and moving the view mid-shot (which keeps your view, by design) left it parked right there. Of three fixes (follow the next shot, recentre on the next ball keeping angle and zoom, or start every turn in Cue view) the owner chose following: at the start of each of your turns the free view glides behind the cue ball, looking at the ball the cue points at, at your own tilt, far enough back for both to show below the scoreboard. Your turns only, so you can watch the computer or a friend from wherever you like; not on the break, so the opening view and trick-shot layouts show the whole table. Cue view already did this; the overhead view needs nothing. It has a Settings switch for anyone who wants a camera that stays put. Found on the way: while the shot camera swung in, the buttons' fade switched on and off every frame (a `true`/`undefined` mix-up passed to `classList.toggle`), and moving the view before the rise could leave them faded; fixed.
- **Fine power (October 2026, the owner asked for the smallest change per press, with Ctrl):** one press of Ctrl + ↑/↓ moves the speed readout by exactly 0.01 m/s, so the readout went from one decimal place to two (a smaller step than the readout shows would look like nothing happened). The step is taken from the shown value, not the exact one, so the readout never skips a number. It's in the readout's units (the cue ball's speed) rather than the power bar's, because the bar's scale is curved: the same bar step gives more than ten times as much speed at full power as at the softest. 0.01 m/s is about 2 to 3 cm of roll on a gentle shot. Only the arrows: Ctrl + W closes the tab in Edge and a page can't stop it. Phones got the same idea as fine aim, sliding along the readout (4 pixels per 0.01 m/s). Online, the live aim preview now notices power changes of 0.0001 rather than 0.001, so the opponent's preview follows the fine steps; the message itself is unchanged.
- **"Next case mythic" (dev mode only, at the owner's request):** a one-shot switch in Settings, so a mythic reveal can be seen whenever wanted; it only works in the test locker, never on real cases, and turns itself off after one case so it can't be left on by mistake. The other items on the reel still follow the case's odds.
- **Players' ideas (October 2026; the owner asked for ideas of up to 100 characters that show up in dev mode, and picked a lightbulb in the menus' corner, the dev word as the key and the online name sent with each):** the relay keeps them, in a Durable Object of its own (`Ideas`), so there's nothing new to host and nothing to pay. Dev mode is only a switch in the browser and the code is public, so the relay itself decides who reads them: it checks the word against the same fingerprint as the game, which also means there's nothing to set up in Cloudflare. A separate long key was recommended instead: the fingerprint is public, so a short or common dev word could be guessed offline, and whoever guessed it could read the ideas. The owner chose the one word. The limits live on the relay too, since anyone can post to it without the game: 100 characters, five a day from one address (kept only as a fingerprint and forgotten the next day), 300 a day in all, the newest 500 kept. Refusals answer as normal replies with a reason, so the console stays clean. Nothing is polled: dev mode asks once at start-up. The test sites now point at the local relay rather than the real one, which every SITE page used to reach through `config.js`.
- **An empty test locker in dev mode (October 2026; the owner reported that "only something new" didn't work):** for players it did (30 Treat cases gave all 30 looks, no repeats), but the test locker owns every look, so a Treat case had nothing new to give and paid out duplicates, and so did a forced mythic. Settings now has Empty test locker (no looks, no rewards, £100,000 and 50 of each case) and Fill test locker, so the owner sees exactly what a new player sees. The owner chose this over making dev mode pretend looks were new, which wouldn't have tested the real rule. Emptying puts away the cloth, cue and gloves it no longer owns, as switching dev mode off already did.
- **Dev mode exists so the owner can try every look:** a secret word, typed as the online name, swaps in a test locker with everything; the real locker is untouched. The word is known only to the owner; the public code holds just its fingerprint.
- **Cloth patterns stay low-contrast:** each pattern's colour is close to its cloth's, and every one was checked in screenshots with the balls on the table.
- **Collections and their rewards (the owner asked for a shop of collections and "cool" rewards, then for a collection per kind in each rarity with a massive reward for a whole rarity):** fifteen collections pay money and cases; the five sets (all three of a rarity) pay far more and carry the effects; all fifteen bring the starfield room. Each effect is one you can't get any other way, and they're display only and local, so online play needs no change (showing your opponent's would need both players on a new version).
- **Faster earning (the owner asked for much faster cases and faster money; the owner picked a case every frame and money ×3):** every frame won against the computer or in the career now gives a case (it took three), pay per frame is three times what it was, career prize money is doubled, an event win gives two cases, the daily online win £100 and two gold cases, and opening a case costs half as much, so the money isn't all spent opening them.
- **No duplicate mythics until all six are owned (the owner's pick):** with duplicates, owning all six took about 490 diamond cases on average; now about 200.
- **The inventory is one long list, rarest first, and the shop holds what you don't own (the owner asked to drop the cloth, cue and glove tabs):** the lists scroll inside the locker's panel, so the screen still fits a phone on its side.
- **The top-tier looks are painted from noise:** the old ones were a few lines and blobs. Painting a whole bed took up to 10 seconds in the test browser, so the noise uses a lookup table, these cloths are drawn at half the usual resolution (smooth noise doesn't need more) and the last four are kept: Magma now takes about 0.3 seconds there, Galaxy under 0.1. Magma and Synthwave were toned down after the first try, which was too bright to see the balls on. Blaze's flicker was slowed from about 3.7 times a second to about once.
- **The reel takes 7 seconds** (was 5.4), at the owner's request.
- **Diamond cases are epic or better, and dearer (October 2026; the owner asked for diamond cases harder to open but more rewarding, with no low rarities, the other cases unchanged, and picked the middle of three options):** 70% epic, 24% legendary, 6% mythic; £250 to open (was £100) and £900 to buy (was £600). Simulated with the real case code, owning every epic, legendary and mythic from diamond cases alone takes about 111 openings (£27,630 to open them) rather than 237 (£23,660): fewer, dearer and better openings for slightly more money in all. The buy price went up as well, or buying a diamond case would have made gold ones pointless for anything but commons and rares. Since an Expert frame pays £150, an Expert win no longer covers opening the diamond case it earns, and the diamond cases already held or paid by rewards cost the new price to open.
- **The money counter (the owner asked for a more visual counter in a top corner, viewable from everywhere, and chose the menus only over the menus and games):** beside the Settings cog on every menu screen, counting to each new amount with the change beside it. During a game the top corners are taken on a computer (the left-hand buttons and the scoreboard leave only the top left free on a phone on its side, and nothing on an upright phone), so the game screen is left alone; money earned in a game counts in on the way back to the menu instead. It stays in view above a case's reel, but holds at what's left after paying until the reel stops, so it never gives away that the prize is a duplicate. Tapping it opens the locker: not asked for, but the obvious place to go, and easy to take out.
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
| Bronze | 72% | 24% | 3.8% | 0% | 0.2% | £8 | £45 |
| Silver | 50% | 36% | 11.5% | 2% | 0.5% | £20 | £110 |
| Gold | 25% | 45% | 23% | 6% | 1% | £45 | £260 |
| Diamond | 0% | 0% | 70% | 24% | 6% | £250 | £900 |

- **Duplicates sell for** £10 (common), £30 (rare), £80 (epic), £200 (legendary), £500 (mythic). A mythic is a duplicate only once all six are owned.
- **Collection rewards** (`KIND_REWARD`, for each of a rarity's cloth, cue and glove collections): common £150 and a silver case; rare £400 and a gold case; epic £800 and a diamond case; legendary £2,000 and two diamond cases; mythic £5,000 and three diamond cases.
- **Set rewards** (`SETS`, all three of a rarity): common £1,000 and three gold cases (chalk trail); rare £2,500 and three diamond cases (gold rails); epic £5,000 and five diamond cases (pot sparks); legendary £12,000 and eight diamond cases (your name in neon); mythic £30,000 and twelve diamond cases (cosmic cue ball). All fifteen (`GRAND`): £50,000 and the starfield room.
- **Frames won against the computer pay** £15 (Easy), £45 (Medium), £90 (Hard), £150 (Expert), and each gives a case of the level's grade (bronze, silver, gold, diamond). Each career frame won gives a case of the circuit's grade (pub bronze, club silver, hall gold, national diamond), without pay. Career prize money was doubled at the same time (the Red Lion Open's winner now gets £200); an event win gives two cases.
- **The day's first online win:** £100 and two gold cases. **A new locker:** £40 and a silver case.
- **The collection:** 60 looks in cases (14 cloths, 20 cues, 26 gloves; 17 common, 18 rare, 12 epic, 7 legendary, 6 mythic), plus the shop's 5 cloths and 6 cues and the free white gloves.

**CPU** (`DIFF` in `core.js`)
- **Aim error, by level:** 1.3° on Easy, 0.55° on Medium, 0.22° on Hard, 0.09° on Expert.
- **Hard and Expert:** also plan position, play safeties and re-test their best options under noise.
- **When snookered:** all levels try one-cushion kicks.

---

## 6. How things are tested

- **Career rules:** `tests/career.test.js` (24 tests): tour data, tiers, draws, results and money, saving and loading (including saves from before the locker), and the opponents' CPU settings.
- **Looks:** `tests/looks.test.js` (32 tests): the catalogue, case odds over many openings, diamond cases only ever epic or better, the guarantee, mythics, collections and their rewards, no duplicate mythics, opening, buying, duplicates, earning, the saved locker, and career opponents' gloves.
- **Physics and rules:** `tests/physics.test.js` (27 tests). These cover bit-identical determinism, pockets on both tables, breaks, the rules for every mode, the trick demos, and that the context packs are up to date.
- **The browser:** headless Chromium (Playwright) with software WebGL (SwiftShader). The page exposes `window.__rr` (state, world, game, aim, NET, beginStroke and so on) to make scripting easy. The browser tests have lived in `tests/browser/` since 7 October 2026; `node tests/browser/run-all.js` runs them all (see `AGENTS.md`, Testing).
- **Online:** the real Cloudflare runtime runs locally (`npx wrangler dev`), and the game is opened with `?relay=ws://127.0.0.1:8787` in **separate browser contexts**, so each gets its own client id. After every shot, the ball positions and the `game` objects of both clients are compared, and they must be identical. Covered: reload rejoin, Rejoin from the home screen, a full room, rematch, re-rack and concede, chat, replaying while the opponent shoots, duplicated tabs, and version mismatches. The ideas players send go to the same local relay, read with a stand-in dev word (`ideas` test).
- **Software WebGL is slow,** so keep test windows small (about 480×360) unless the size is what's being tested.

---

## 7. Ideas list (discussed; the ones built since say so)

- **Installable app (PWA):** built in Claude Code, together with a version check for online play. The service worker is network first, so nobody gets stuck on an old copy; see `AGENTS.md`.
- **A pulsing marker on your own balls:** built, chosen instead of colour-blind markings. A gold halo round each ball you're on, shown only on your shot once groups are decided, with an on/off setting. A ring flat on the cloth was tried first but vanished in the cue view, so the halo faces the camera.
- **Stats:** pot percentage, wins per CPU level, longest run and break-and-dish, stored in the browser. Set aside by the owner in favour of a career mode.
- **Career mode:** Stages 1 and 2 built (the pub, club, hall and national tiers, the shop and venues). Stage 3 is planned; see section 4, "Career".
- **Cosmetics overhaul:** built: the locker, cases with a spinning reel, patterned cloths, patterned and glowing cues, and floating gloves with small reactions; Settings and Fullscreen became corner icons in the menus. See section 4, "Looks".
- **A bigger case opening and a mythic rarity:** built: a dimmed room, a reel filling most of the screen, a background show in the prize's colours, and six moving mythic looks.
- **Reel tiles in rarity colours, and Preview:** built: tiles fade from dark to their rarity's colour; Preview shows your looks at the table and can try on ones you don't own.
- **Collections, the inventory list and new top-tier looks:** built: an inventory in rarity order, a shop with a row per collection and rewards for completing them (effects, money and cases), no duplicate mythics, repainted legendary and mythic looks, and a 7-second reel.
- **New menus:** built. Home leads to Single player (computer, practice) and Multiplayer (online, same device), then the game and its setup, with slide transitions, a "Play again" button and back-gesture support.
- **Small comforts:** a volume setting, a fullscreen button, a "turn your phone sideways" hint and phone vibration on pots and fouls are built.
- **Rejoin last game:** built. An online game left by accident (app closed, tab shut) shows a Rejoin button on the home screen for 3 hours. The table comes back if the opponent's game is still open; if both left, the same room starts a fresh frame. Possible next step: keep the table when both players leave (each page saves its snapshot and the room restores the newest), which changes how online games start.
- **A rules option:** "lose the second visit when on the black", for reds & yellows: built as "On black: One visit".
- **Adding balls to trick shots:** built ("Add balls", under "Edit table").
- **Possibly:** a colour-blind-friendly marking option for reds and yellows.
- **A progression pass:** the owner would like one, but not yet (October 2026).
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
| 8 Oct 2026 | #15 | b03751b9 | A bigger case opening: the room dims, the reel fills most of the screen, and the background lights up in the prize's colours, livelier the rarer it is (still with reduced motion). Mythic, a fifth rarity (red), in every case but very rarely, with six moving looks: the Aurora and Magma cloths, the Event horizon and Plasma cues, and the Molten and Prism gloves. |
| 9 Oct 2026 | #16 | 9fa2ab02 | Reel tiles in their rarity's colour (grey, blue, purple, gold, red, fading from dark to the full colour). Preview in the locker: your cloth, cue and gloves at the table, with looks you don't own tried on (nothing bought or changed). The career, comforts and markers browser tests now run over http, after pages opened from disk were found not always to keep their storage. |
| 12 Oct 2026 | #17 | 82343c58 | Dev mode: a "Next case mythic" switch in Settings, so the next case opened in the test locker gives a mythic (once, then it switches itself off). The online looks browser test now plays gentle shots that can't end the frame. |
| 12 Oct 2026 | #18 | aa262916 | The locker's Inventory (one long list, rarest first) and Shop (for sale, then a row per collection); rewards for each completed collection (money, cases and an effect: chalk trail, gold rails, pot sparks, your name in neon, a cosmic cue ball, and with all five a starfield room); no duplicate mythics until all six are owned; repainted legendary and mythic cloths, cues and gloves; a 7-second reel. |
| 12 Oct 2026 | #19 | ab102c23 | Fifteen collections (a rarity's cloths, cues or gloves), each paying money and cases; sets (all three of a rarity) pay far more and bring the effects; all fifteen pay £50,000 and the starfield room. Much faster earning: a case for every frame won, pay ×3, career prizes ×2, two cases per event win, the day's first online win £100 and two gold cases, opening costs halved. |
| 12 Oct 2026 | #20 | 7e59e559 | Pixel size Max in Settings: one game pixel per real screen pixel, so a screen scaled above 100% or a phone shows finer aim lines and edges than 1× (at 100% it's the same as 1×, and its note says so). |
| 12 Oct 2026 | #21 | bc02def7 | Low-poly gloves: one faceted hand bent by a skeleton (six-sided fingers, an eight-sided palm and cuff, no crease shading), panels as whole faces in toned colours, the cue hand wrapped round the cue; Robot, Acid and Arctic no longer wear the Gold leaf texture. The shot camera: your shot swings the view down behind the cue and back once the balls stop (Pause → Shot camera to switch it off). |
| 13 Oct 2026 | #22 | d686b1fe | The shot camera stands higher and further back (about 40 cm up and 60 cm behind the cue ball), and pressing Shoot holds the aim for 0.9 s while the view glides in before the cue moves (online, the shot is sent when the stroke starts). |
| 13 Oct 2026 | #23 | fc920d49 | The gloves are the owner's own procedural hand model, built in: one low-poly, flat-shaded hand on a skeleton of 17 bones, placed on the cue by the pose's anchors (the grip on the butt, the bridge on the cue's line), with the patterned gloves' textures, each glove type's extras, eight materials and three reaction poses added. Top spin tips the bridge up on its fingertips; the boxing glove's bridge no longer has the cue through the mitt; a textured glove's trims wear its texture. |
| 13 Oct 2026 | #24 | 08c197c5 | After your shot, the camera rises to a high view of the whole table: 0.3 s after the strike it rises over 1.2 s to 60 degrees down above the long side you're nearer, the table and rails filling about 90% of the screen (back to the overhead view if you shot from it), with the spin and power panel faded meanwhile; your view comes back once the balls stop. |
| 13 Oct 2026 | #25 | 1a8fcf7a | The phone's game screen: the buttons are small pixel-icon squares (Shoot keeps its word; a long press shows a name), a small ball beside the power bar shows where the tip will strike and folds the spin diagram away (hidden at first on phones), sliding along the aim readout turns 0.01° per 4 pixels, a held aim arrow starts slowly, Ctrl + arrow turns 0.01°, the Controls panel's keys can be tapped, and the left buttons fade with the spin panel while the shot camera is up. |
| 14 Oct 2026 | #26 | 31c62c4b | Halloween, the first season (1 October to 10 November): a Trick case (earned with the first frame won each day in the season, or bought; normal odds) and a Treat case (bought; always a look you don't have), holding 30 Halloween looks of their own, two of each kind at each rarity, with moving mythics; each rarity's six pay a reward, and all thirty bring the Haunted Hall at home (jack-o'-lanterns, bats, cobwebs, moonlit windows, fog, a portrait whose eyes follow the cue ball, a skeleton, its own sign). The locker has a Halloween tab; browser tests see a fixed date outside every season. |
| 15 Oct 2026 | #27 | 93f06d05 | Fine power: the speed readout shows two decimal places, Ctrl + ↑/↓ moves it by exactly 0.01 m/s a press, sliding along it on a touch screen sets it finely, and the Controls panel's Ctrl arrows do the fine step for aim and power. |
| 15 Oct 2026 | #28 | c2dd7809 | Follow next shot (from a player's report): after a shot, when it's your turn in the free view, the camera glides behind the cue ball, looking at the ball the cue points at, both in view; your turns only, not on the break; a Settings switch. Also fixed the buttons flickering while the shot camera swung in, and staying faded if the view was moved before it rose. |
| 16 Oct 2026 | #29 | 7c955149 | Diamond cases give only epic or better (70% epic, 24% legendary, 6% mythic) and cost more: £250 to open, £900 to buy. A money counter in the top-right corner of every menu screen, beside the Settings cog: it counts up or down with the change beside it, holds while a case's reel spins so a duplicate's sale shows only when it stops, and opens the locker when tapped. A progression pass is on the ideas list. |
| 16 Oct 2026 | #30 | 7b6c54d2 | Players' ideas: a lightbulb beside the money counter in the menus opens a box for an idea of up to 100 characters, sent with the player's online name (five a day). The relay keeps them (a new Durable Object, `Ideas`) and checks them itself. In dev mode the lightbulb is the owner's inbox, unlocked by the dev word: new ones are counted on it and announced under the corner icons, and they can be deleted. On upright phones the menu panel now starts below the corner buttons. The test sites use the local relay. |
| 16 Oct 2026 | #31 | a985de1c | Dev mode: Empty test locker in Settings (no looks, no rewards, £100,000 and 50 of each case), so Treat cases (always new) and mythics (never repeated) can be seen working as they do for a new player; the full test locker owned everything, so they could only give duplicates. Fill test locker gives everything again. |

**Lessons worth keeping**
- From #18 the Robot, Acid and Arctic gloves wore the Gold leaf texture: `gloveTex()` picked a texture from the glove's effect (`glow` meant gold leaf) without checking that the glove was legendary or mythic. Found while redoing the gloves; the locker browser test now checks the robot's steel.
- The career browser test failed now and then when the machine was busy: after its page was closed, the reopened page found no career. Logging showed that pages opened from disk don't always share one storage in the test browser, and which way it goes varies from run to run. Like the locker test, it now runs on the local web server, as the real site does. Fixed waits for things that take time (a file being read) became "wait until" checks. The comforts and markers tests, which reload a page, moved too after the same thing happened once to the sideways hint. Any browser test that reloads or reopens a page, or uses two pages, should run over http. The online looks test once failed because one of its real shots, from a random rack, potted the 8-ball and ended the frame; tests that only need the turn to pass now play a gentle shot away from every ball. The markers test's 9-ball check failed the same way once (a break that potted the 9 wins the frame), so it now starts after the break instead of playing one.
- #5 deleted CSS that Settings and the overlays also used (`.row`, `.lbl`, `.seg` and others), and nobody noticed until the live site looked wrong. The `fit` browser test now checks those styles.
- After #7, the version reported in chat was misremembered, so the owner waited for an update that had already arrived. Always read the version from the committed `index.html`.
- A comment placed partway along a line of code silently swallowed the code after it, twice: a closing bracket in #8 (caught by a syntax check) and the "close Pause" branch from #7, which went unnoticed until #11. Put comments on their own line or at the very end of a statement.
- Generic class names clash: the career's list of players used the class `field`, which the online screen's name box already styled, so the list was squashed into one row in #11 and nobody noticed until #12. Give new class names a prefix (`bField`, `cEvt`, `shopItem`).
- An early version of Rejoin saved one "last game" per browser. With two tabs playing each other on one device, a reopened tab could take over the seat of the tab that was still open. Entries are now kept per client id, and a Web Lock marks seats that are still open.
