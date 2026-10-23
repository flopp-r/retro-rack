# Retro Rack

3D pixel pool you can play against the computer, on one device, or online against a friend.

## What's in this folder

| File | What it is |
|---|---|
| `index.html` | The game. It works on its own for offline play. |
| `config.js` | One setting: your relay address, so online play knows where to connect. |
| `sw.js`, `manifest.webmanifest`, `icons/` | Let people install the game as an app and play it offline. |
| `relay/` | A tiny Cloudflare Worker that passes messages between the two players, and keeps the ideas players send. |
| `src/`, `vendor/`, `tools/`, `tests/` | The source code, the 3D engine and fonts, the build tool and the tests. `index.html` is built from these. |
| `AGENTS.md`, `CLAUDE.md`, `HANDOVER.md` | Notes for AI assistants and developers: how the project fits together and how to change it (`CLAUDE.md` points Claude Code to `AGENTS.md`), and its history and decisions. |
| `CONTEXT.md`, `CONTEXT-SHORT.md` | The whole project in one file, for an AI that can't open this repository (see "Asking another AI about the project" below). Made by the build; don't edit them. |

Everything here runs on free plans. You need a GitHub account and a Cloudflare account, and everything is done in your web browser.

---

## Step 1: Put the game on GitHub Pages

1. Sign in to github.com and open https://github.com/flopp-r/retro-rack.
2. Click **Fork** (top right), keep the name `retro-rack`, and click **Create fork**. You now have your own copy.
   (GitHub Pages is free for public repositories, so anyone can see the code. That's fine; there's nothing private in it.)
3. Go to the repository's **Settings**, then **Pages** in the left sidebar. Under **Build and deployment**, set **Source** to **Deploy from a branch**, choose the **main** branch and the **/ (root)** folder, then click **Save**.
4. Wait a minute or two and refresh the page. It will show your site address, something like `https://yourname.github.io/retro-rack/`. Open it and the game should load. Offline modes work already.

## Step 2: Put the relay on Cloudflare

1. In the Cloudflare dashboard, open **Workers & Pages** (it may be under **Compute** in the sidebar) and click **Create**.
2. Choose **Import a repository** and click **Get started**. Connect your GitHub account when asked, and give Cloudflare access to the `retro-rack` repository.
3. Pick the `retro-rack` repository.
4. Set the project name to exactly `retro-rack-relay`. It must match the name in `relay/wrangler.jsonc`.
5. Open the advanced or build settings and set the **Root directory** (sometimes called **Path**) to `relay`. Leave the build command empty, and leave the deploy command as `npx wrangler deploy`.
6. Click **Save and Deploy** and wait for the build to finish, which takes a minute or two.
7. Open the new Worker. Its address looks like `https://retro-rack-relay.yourname.workers.dev`. Visit that address in your browser; it should say **Retro Rack relay is running.**

Cloudflare occasionally renames buttons. If something doesn't match exactly, look for the closest option with the same meaning.

## Step 3: Connect the game to the relay

1. On GitHub, open `config.js` in your repository and click the **pencil** icon to edit it.
2. Paste your relay address between the quotes on the last line, so it looks like this:

   ```js
   window.RETRO_RACK_RELAY = "https://retro-rack-relay.yourname.workers.dev";
   ```

3. Click **Commit changes**. GitHub Pages updates within a minute or two.

That's it.

---

## Playing online

1. Open your game address, choose **Multiplayer**, then **Online**, and type your name.
2. To join a friend, pick their room from **Open rooms** and click **Join**, or type their code into **Join with code**.
3. To host, click **Create a room**, choose the game, pick **Listed** or **Private**, then click **Create room**. You get a five-character room code and an invite link.
   - **Listed** rooms appear in Open rooms for anyone who opens your game page, until a second player joins.
   - **Private** rooms never appear in the list; they can only be joined with the code or link.

The player who creates the room chooses the game and the aim guide, and those settings apply to both players. You see your friend's cue move as they aim, in their own cue design and gloves; the table uses the host's cloth. Your first online win each day pays £100 and two gold cases. If either connection drops, the game waits and puts you both back on the same table when you reconnect, including after reloading the page. If you close the game by accident (the app swiped away, the tab shut, a flat battery), the home screen shows **Rejoin** (for example "Rejoin 8-ball with Sam") for three hours; it puts you back in your seat, and on the same table if your friend's game is still open. Quitting on purpose forgets it. A room leaves the list as soon as someone joins it, or if its creator leaves first, so nobody can wander into a game already in progress. Rooms tidy themselves away after six hours unused.

**Fair play.** Your game only accepts your friend's shot *inputs* (aim, power, spin and cue ball placement), then works out what happens itself. An edited copy of the game can't report fake results or place the cue ball illegally without your game noticing. It can't stop someone using an aiming aid on their own screen, though, so this is for friendly games.

**Cost.** Cloudflare's free plan covers this comfortably. If the daily free allowance were ever used up, online play would simply stop working until the allowance resets at midnight UTC. You can't be charged unless you upgrade the plan yourself.


## Installing it as an app

Open your game address, then:

- **Edge or Chrome on a computer:** click the **App available** (install) icon at the right of the address bar, then **Install**.
- **Android:** open the browser menu (**⋮**) and choose **Install app** or **Add to Home screen**.
- **iPhone or iPad:** in Safari, tap **Share**, then **Add to Home Screen**.

The app opens in its own window. Once installed and opened once, it starts without internet for games against the computer, on one device, and practice. Online play still needs a connection.

Updates arrive by themselves: whenever there's a connection, the app fetches the latest version, and the saved copy is only used offline. The version is shown at the bottom of the menu.

## Features worth knowing

- **Career:** in **Single player**, **Career** starts a tour of knockout tournaments: the pub circuit (reds & yellows on the 7 ft table), then the club and hall circuits (8-ball) and the national tour (9-ball), on the 9 ft table. Pick a name, a look and an aim guide (fixed for the whole career), then enter events, play your way through the draw against named computer players, and win prize money, cases and trophies. Winning an event opens the next, and winning a circuit's championship opens the next circuit. Each circuit has its own room. The career is saved after every shot, so you can leave a match and carry on later. It is stored in this browser on this device: **Save to file** keeps a copy, with your locker (or moves both to another device with **Load from file**), and clearing your browser's data would delete them.
- **Locker:** on the home screen (and the career's hub). It holds your money, your cases and every cloth, cue and pair of gloves. Some are sold outright; the rest come in **cases**, in four grades (bronze, silver, gold and diamond) with their odds shown on each. A diamond case is always epic or better, but costs the most to open (£250). Opening a case costs money: the room goes dark, a big reel of the case's items spins to a stop on your prize, and the background lights up in its colours, more wildly the rarer it is. The rarest, **mythic** (red), can come in any case but very rarely; the six mythic looks move (a drifting aurora cloth, a glowing magma cloth, two cues with moving patterns and two gloves that change colour). Gloves are low-poly hands that grip the cue, make the bridge and react after a shot. An epic or better is guaranteed within every 8 cases, and anything you already own is sold for you. You earn money and cases by winning frames against the computer (every frame won pays £15 on Easy up to £150 on Expert, and gives a case of that level's grade: bronze on Easy up to diamond on Expert), playing the career (prize money, two cases for every event won, and a case of the circuit's grade for every frame won), and with your first online win each day (£100 and two gold cases). Practice and same-device games earn nothing. Looks work in every game, stay if you retire a career, and online your opponent sees your cue and gloves. **Gloves** hold the cue and make the bridge on the cloth, and give a thumbs-up when you pot, a shrug when you foul and a fist pump when you win the frame. The locker has three tabs: **Cases**; **Inventory**, one long list of everything you own, rarest first; and **Shop**, with the looks for sale and each rarity's collections. There are fifteen **collections**: the cloths, the cues and the gloves of each rarity. Complete one for money and cases; complete all three of a rarity (its **set**) for a much bigger prize and an effect only a set gives: a chalk trail behind the cue ball (common), gold rails (rare), sparks when a ball drops (epic), your name in neon (legendary) and a cosmic cue ball (mythic). All fifteen bring £50,000 and open the room onto a starfield. Each effect can be switched off in the inventory, and only you see them. A mythic is never a duplicate until you own all six. Choose looks in the locker, or in **Settings** (the cog, top right in the menus). Your money is shown beside the cog on every menu screen, counting up or down when it changes; tap it to open the locker. **Preview**, in the locker, shows your cloth, cue and gloves at the table; tap a look you don't own first to try it on. The reel's tiles are in their rarity's colour: grey common, blue rare, purple epic, gold legendary, red mythic.
- **Halloween (1 October to 10 November):** the locker gets a Halloween tab with two cases of their own, holding 30 Halloween looks you can't get anywhere else (two cloths, two cues and two pairs of gloves at each rarity). Your first frame won each day in the season (against the computer, in the career or online) earns a **Trick case**: any Halloween look, duplicates sold as usual. A **Treat case** is bought, and always gives a look you don't have yet, so 30 of them finish the set. Each rarity's six looks pay money and cases, and all 30 turn the room at home into the **Haunted Hall**: jack-o'-lanterns, bats, cobwebs, moonlit windows, fog, a portrait whose eyes follow the cue ball, a skeleton in the corner and a Haunted Hall sign (switch it off in the Inventory). Out of the season the cases can't be bought or earned, but ones you have still open, and everything stays yours.
- **Replay:** press **V** or the **Replay** button to watch the last shot again. Use slow motion and orbit the camera while it plays.
- **Menus:** **Single player** leads to games against the computer and to practice; **Multiplayer** to online and same-device games. Back (or Esc, or a phone's back gesture) returns a screen. **Play again** on the home screen starts your last setup in one tap.
- **Matches:** on a game's setup screen, under **Match**, choose first to 3, 5 or 7 racks, for CPU, same-device and online games.
- **Concede or re-rack:** both are in the **Pause** menu. Online, a re-rack is offered to your opponent, who can accept or decline.
- **Quick chat:** in online games, the **Chat** button sends a short preset message.
- **Ideas:** the lightbulb beside the cog in the menus sends the game's maker an idea of up to 100 characters, with your online name if you've set one. Up to five a day.
- **Trick shots:** in **Practice**, choose the **Trick shots** rack. **Show me** plays a demo. **Edit table** lets you drag balls into your own layout and shows **Add balls**, which puts more on the table (or takes them off). **Save layout** adds it to the list.
- **Reds & yellows, "On black":** on the setup screen, choose whether a player on the black gets two visits after a foul or only one (a common pub rule). Online, the host's choice applies to both players.
- **Shot camera:** when you press Shoot, your aim is held for a moment while the view glides in to stand over the cue; then the cue strikes, and a moment later the view rises high above the side of the table so you can watch every ball, with the buttons faded out of the way (if you shot from the Overhead view, it rises back to that). It goes back to your view once the balls stop. Turn it off under **Pause**, **Shot camera**.
- **Markers:** a pulsing gold halo shows the balls you're on once you have a colour (in 9-ball, the lowest ball). Turn it off under **Pause**, **Markers**.
- **Pause and Settings:** Pause in a game (or Esc), or the cog at the top right of the menus, opens a panel with tabs along the top. In a game it opens on **Match**: Resume, Re-rack, Concede frame and Quit to menu, with the score. The other tabs hold the settings: **Play** (aim guide, markers, shot camera, follow next shot), **Looks** (cloth, cue and gloves), **Display** (pixel size and colours; 1× and full colours are the default, Max uses every pixel a scaled screen or phone has for the finest lines, and a bigger pixel size is more retro and easier on phones) and **Sound** (volume, and vibration on phones). Each tab scrolls on its own, Resume at the end of the tab row works from any tab, and from the menus it opens on the tab you last used. On a phone it fills the screen; on a computer, click outside it to close it.
- **Sound and fullscreen:** **Settings** sets the volume (Off to 100%). The **Fullscreen** button, in the menu and in game, hides the browser's bars where the browser allows it (not on iPhone, where installing the app does the same job).
- **Phones:** held upright, the game suggests turning sideways (tap OK to stop the hint). On Android, your pots give a short buzz and fouls a longer one; switch it off under **Vibration**.
- **Fine aim:** the **<** and **>** buttons either side of the aim readout turn by 0.05° per tap; held, they start turning slowly and speed up. For finer still, slide a finger (or the mouse) along the aim readout: 4 screen pixels turn 0.01°. On a keyboard, **Ctrl** with **←** or **→** turns 0.01°.
- **Fine power:** the readout under the power bar shows the cue ball's speed to 0.01 m/s. On a keyboard, **Ctrl** with **↑** or **↓** changes it by exactly 0.01 m/s per press (on a gentle shot, about 2 to 3 cm more or less roll); holding the keys does nothing more. On a touch screen, slide along that readout: 4 screen pixels change it by 0.01 m/s, right for more.
- **Follow next shot:** after a shot, when it's your turn again and you're using the free view, the camera glides to just behind the cue ball, looking at the ball it's pointing at (the nearest one you're on), with both on screen. It happens on your turns only, not while the computer or an online opponent is shooting. Switch it off in Settings (Follow next shot) for a view that stays where you put it. Cue view always follows the cue ball, and the overhead view shows the whole table.
- **Phone buttons:** on a phone the game's buttons are small squares with pictures (Shoot keeps its word). Press and hold one to see its name.
- **Spin diagram:** the small ball beside the power bar shows where the tip will strike; tap it to show or hide the big spin diagram. It starts hidden on a phone and shown on a computer, and remembers your choice.
- **Controls panel:** the keys listed in it can be tapped, and do what the key does: handy on a phone for things like **O** (centre the spin) and **F** (reset the view). The views, Shoot and the practice keys close the panel; aim, power and spin keys leave it open for more taps.

## Updating later

- **New version of the game:** on GitHub, use **Add file**, then **Upload files**, and drop in the new files. Files with the same name replace the old ones. Commit, and the site updates in a minute or two.
- **With Claude Code:** open this repository in Claude Code and describe the change. It reads `AGENTS.md` (through `CLAUDE.md`) to learn how the project works, edits the source in `src/`, rebuilds `index.html`, runs the tests, and pushes. The site and relay then update by themselves. Other AI coding tools read `AGENTS.md` directly.

## Asking another AI about the project

To give an AI that can't open this repository (ChatGPT, Gemini or Claude in a browser, say) the whole picture, paste it this link and ask your question:

https://raw.githubusercontent.com/flopp-r/retro-rack/main/CONTEXT.md

It holds the notes, a map of the code and all the source code written for the game, about 350 KB (it grows with the game). If the AI can't open links, download the file and attach it. If it says the file is too big, use `CONTEXT-SHORT.md` instead (the notes and the map, without the code). Both are remade by every build, so they always match the latest version.
- **New version of the relay:** upload the changed files into the `relay` folder the same way. Cloudflare rebuilds and redeploys it automatically.

## If something isn't working

- **Stuck on "Connecting…" or "Reconnecting to the relay…":** check the address in `config.js`. It should start with `https://` and end with `workers.dev`, with nothing else inside the quotes. Visit the address directly to confirm it says the relay is running.
- **Cloudflare build fails mentioning the name:** make sure the Worker is called `retro-rack-relay`, or change `"name"` in `relay/wrangler.jsonc` to match your Worker's name.
- **GitHub Pages shows a 404:** give it a few more minutes, and make sure `index.html` sits at the top level of the repository, not inside another folder.
- **"That room already has two players in it":** someone else is in that room. Create a new one.
- **"…different versions of Retro Rack" or "…an older version":** online players must have the same version. Reload (Ctrl+F5 on a computer, or close and reopen the app on a phone), then come back to the room. The version is shown at the bottom of the menu, so you can compare.
