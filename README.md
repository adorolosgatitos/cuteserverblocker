# cute server blocker ♡

| | |
| --- | --- |
| **a cutesy portable server selector for overwatch 2** | `(=^･ω･^=)⊃━☆・*.` |

block the servers you **don't** want to play on — with a kitty paw. open the app, tap a switch, that region is swatted. your matchmaking stops visiting laggy places until you say otherwise.

> inspired by the amazing [**dropship**](https://github.com/stowmyy/dropship) by stowmyy ♡ — same idea, smaller, softer, more cat.

![tech](https://img.shields.io/badge/platform-Windows-ff9fc4) ![node](https://img.shields.io/badge/runtime-Node%2018%2B-c9b6ff) ![deps-zero-7fdcbc)

## how it works

the app does **not** touch the game files. it adds one outbound **windows firewall rule per region** (the same windows filtering platform an ad blocker uses), so your client simply can't reach the blocked data centers.

- rules **persist** after you close the app (default), or only exist while the app is open (there's a switch for that ♡)
- config lives in `%appdata%\cuteserverblocker\state.json`
- the ip lists are factual ranges: static blizzard blocks + google cloud region prefixes (refreshed live from `gstatic.com/ipranges/cloud.json` on every launch)

## how to use

### easy mode (windows zip)

1. grab **`cuteserverblocker-win-x64.zip`** from [Releases](../../releases) (built by CI — includes portable node, nothing to install)
2. unzip it anywhere
3. double-click **`cuteserverblocker.bat`** and accept the uac prompt (we need admin to edit the firewall)
   - if windows says "Windows protected your computer" → *more info → run anyway* (unsigned bat, sorry ♡)
4. the ui opens in your browser, block what you don't want, done!

> no releases yet? open the **Actions** tab → *windows release* → *Run workflow* → download the zip from the run's artifacts. pushing a tag like `v0.1.0` also publishes a release automatically.

### from source (needs [node](https://nodejs.org) 18+)

```bat
npm start
```

the ui opens at `http://127.0.0.1:7331` — **run your terminal as administrator** so windows lets us edit the firewall (the app can also re-launch itself elevated with the *restart as admin* button)

then:

1. block the regions you don't want
2. done! you can close the app now ♡

## warnings

⚠ please read, nya~

- when queuing **with other people**, the matchmaker may put you on servers you've avoided unless **everyone in the party** blocks them too
- **practice range** doesn't use the matchmaker — test with a custom game
- if you are failing to connect to a match, **unblock everything quickly** (the *let them all go* button) to avoid a competitive ban
- blocking a google cloud region blocks *all* google cloud traffic in that region (same tradeoff as dropship)

## faq

| question | answer |
| --- | --- |
| does it modify the game? | nope. it only adds ip filters to windows, like a very fluffy ad blocker |
| do i need to keep it open? | no — blocks persist. unless you switch on *only while i'm open* |
| how do i uninstall? | click *let them all go*, then delete the folder |
| where is my config? | `%appdata%\cuteserverblocker\state.json` |
| it doesn't work :( | make sure you ran it **as administrator**, then open an issue |
| can i develop on mac/linux? | yes: `npm run dev` runs in dry-run mode (nothing is really blocked) |
| i killed the terminal / crashed it | with *only while i'm open* on, rules may linger until the next launch — start and close the app cleanly to re-sync |

## development

```sh
npm run dev     # dry-run + simulated pings, no browser auto-open
npm start       # the real thing (windows + admin)
npm run dist    # build dist/cuteserverblocker (add --with-node on windows)
```

flags: `--port 7331` · `--dry-run` (never touch the firewall) · `--no-open` · `--demo-pings` (simulated latencies — handy in containers where icmp is blocked, or for screenshots)

no dependencies, no build step — plain `node:http` on the backend and hand-written html/css/js on the front.

```
server/
  index.js          http server + api + lifecycle
  state.js          config persistence (%appdata%)
  ping.js           latency check (system ping, tcp fallback)
  gcp.js            google cloud ip ranges (live → cache → snapshot)
  firewall/
    index.js        adapter picker + sync
    win.js          netsh outbound block rules
    dryrun.js       dev/demo adapter
  data/
    regions.js      overwatch 2 regions, tokens, ping targets
public/             the kawaii ui
```

## credits

- [stowmyy/dropship](https://github.com/stowmyy/dropship) — the original portable server selector, go star it
- ip range data: blizzard + [google cloud ip ranges](https://www.gstatic.com/ipranges/cloud.json)

## license

MIT ♡
