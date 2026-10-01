# Retro Rack

3D pixel pool you can play against the computer, on one device, or online against a friend.

## What's in this folder

| File | What it is |
|---|---|
| `index.html` | The game. It works on its own for offline play. |
| `config.js` | One setting: your relay address, so online play knows where to connect. |
| `relay/` | A tiny Cloudflare Worker that passes messages between the two players. |

Everything here runs on free plans. You need a GitHub account and a Cloudflare account, and everything is done in your web browser.

---

## Step 1: Put the game on GitHub Pages

1. On github.com, click **+** (top right), then **New repository**.
2. Name it `retro-rack`, choose **Public**, and click **Create repository**.
   (GitHub Pages is free for public repositories, so anyone can see the code. That's fine; there's nothing private in it.)
3. On the new repository page, click the **uploading an existing file** link.
4. Unzip `retro-rack.zip` on your computer and open the `retro-rack` folder. Select **everything inside it** (`index.html`, `config.js`, `README.md` and the `relay` folder) and drag it all into the browser window.
5. Check that the list includes `relay/src/index.js`, `relay/package.json`, `relay/package-lock.json` and `relay/wrangler.jsonc`, then click **Commit changes**.
6. Go to the repository's **Settings**, then **Pages** in the left sidebar. Under **Build and deployment**, set **Source** to **Deploy from a branch**, choose the **main** branch and the **/ (root)** folder, then click **Save**.
7. Wait a minute or two and refresh the page. It will show your site address, something like `https://yourname.github.io/retro-rack/`. Open it and the game should load. Offline modes work already.

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

1. Open your game address, choose a game, set **Opponent** to **Online friend**, and type your name.
2. Click **Create room**. You get a five-character room code and an invite link.
3. Send your friend the link. They open it and the game starts as soon as they arrive. They can also type the code into **Join room**.

The player who creates the room chooses the game and the aim guide, and those settings apply to both players. You see your friend's cue move as they aim. If either connection drops, the game waits and puts you both back on the same table when you reconnect, including after reloading the page. Rooms tidy themselves away after six hours unused.

**Fair play.** Your game only accepts your friend's shot *inputs* (aim, power, spin and cue ball placement), then works out what happens itself. An edited copy of the game can't report fake results or place the cue ball illegally without your game noticing. It can't stop someone using an aiming aid on their own screen, though, so this is for friendly games.

**Cost.** Cloudflare's free plan covers this comfortably. If the daily free allowance were ever used up, online play would simply stop working until the allowance resets at midnight UTC. You can't be charged unless you upgrade the plan yourself.

## Updating later

- **New version of the game:** on GitHub, use **Add file**, then **Upload files**, and drop in the new `index.html`. A file with the same name replaces the old one. Commit, and the site updates in a minute or two.
- **New version of the relay:** upload the changed files into the `relay` folder the same way. Cloudflare rebuilds and redeploys it automatically.

## If something isn't working

- **Stuck on "Connecting…" or "Reconnecting to the relay…":** check the address in `config.js`. It should start with `https://` and end with `workers.dev`, with nothing else inside the quotes. Visit the address directly to confirm it says the relay is running.
- **Cloudflare build fails mentioning the name:** make sure the Worker is called `retro-rack-relay`, or change `"name"` in `relay/wrangler.jsonc` to match your Worker's name.
- **GitHub Pages shows a 404:** give it a few more minutes, and make sure `index.html` sits at the top level of the repository, not inside another folder.
- **"That room already has two players in it":** someone else is in that room. Create a new one.
