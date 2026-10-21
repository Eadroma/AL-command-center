# Halloween events and the merchant route

Reviewed the [Witching Season release](https://github.com/kaansoral/adventureland_mongodb/commit/daa2c250b9a6a849d6316a75aec836a1f7d91c33) and all 26 subsequent commits through [43b2c8f](https://github.com/kaansoral/adventureland_mongodb/commit/43b2c8fcf039b880e2a78eda8e5f4d48aa53dbf7), the upstream head checked on 21 October 2026. Later commits supersede several original release mechanics.

## Bosses

- **Headless Horseman**: event and monster ID `horseman`, join with `join('horseman')`, live status `server.status.horseman`. Its Jack-o Walkers appear at 75% and 25% health. The current boss has 30,000,000 HP and 1,600 attack.
- **Graveyard Rising / Gargoyle**: event ID `graveyard`, join with `join('graveyard')`; monster IDs `zombie`, `ghoul`, then `gargoyle`. The final boss has 6,000,000 HP and 1,200 attack. The join point was moved below the graveyard stairs in a later commit.

Both fights are listed in **Events & bosses** and the expedition selector. They are not recurring camp checks: their monsters have no normal respawn timer. The Farming boss panel links to the event settings. The local catalogue includes their actual stats, drop rows and sprites, plus Jack-o Walkers, Zombies and Ghouls. `sources.json` records the pinned upstream commit for this targeted import.

Enable the desired event, choose its combat build and character participation, then save, preview and deploy the participating farmers. Existing allowlists are preserved. Graveyard targeting uses the actual monster IDs and excludes unrelated Mummies on the same map. Expedition Gargoyle damage is attributed to `gargoyle`, rather than the event ID `graveyard`.

## Trick or Treat

In **Events & bosses → Trick or Treat · merchant**, enable **Visit Halloween doors daily**. Save the profile, preview it and deploy the merchant v2 script. This is a separate merchant chore; it does not require enabling combat events. New and existing profiles default to disabled.

The route reads `G.events.trickortreat.doors` and `character.trickortreat`, walks within knock range, then calls `knock(index)`. Current rules allow seven doors per character per UTC day and fourteen knocks across the entire account. The merchant never launches another character to consume the remaining quota.

Confirmed door visits and account-limit responses are journaled per UTC day in character CODE storage, so delayed telemetry and script reloads do not repeat knocks. The next UTC day resets this local journal; server progress remains authoritative. The route stops outside Halloween or when the game's season-end timestamp is reached, respects the account's `doors_left`, and returns to the configured stand. It does not consume a local wall-clock estimate of the event's season.

Navigation holds the merchant chore lock for the entire door circuit, including waits between knocks, then returns to the stand once. Stand maintenance, resupply and Cipher brewing cannot interrupt between doors. Bank sorting/reviews, active production transactions and expedition assembly/return take precedence. At least three free slots and 70% HP are required. A Ghost trick alone does not interrupt the circuit; actual aggro or low HP triggers a retreat and a two-minute pause. Other request failures back off for one minute. No costume is purchased or equipped automatically.

Current rewards: 70% treat chance, or 85% with one of the game's supported pumpkin helmets. Treats include candy, Witch ingredients or a Witch's Parcel. Every tenth account stamp awards a Parcel, and the fortieth also awards the Sinister Laugh emote jar. The server grants these rewards; the script never tries to claim them separately.

## Other upstream changes reviewed

The follow-up commits revise Witch item stats and recipes, cooperative/home-server drops, fight guides and achievements, event schedule presentation, and several server-side combat, inventory, trading, mail and CODE regressions. They do not require copying game server patches into this dashboard.

## Automated Witch's Cipher

Enable **Brew Witch’s Cipher from available ingredients** in the merchant seasonal panel, then save and deploy the merchant. The latest rules use ordinary ingredient loot during gathering, no join step, five ingredient slots, and a shared clue board counting ingredients in the correct position. It runs twice daily during Halloween and rotates among daily events afterwards, so brewing is not restricted to the Halloween season switch.

The merchant enumerates the 1,024 possible five-slot recipes over the four current ingredients. It picks an untried recipe that fits every live clue and can be made from unlocked ingredients in its bag. Each fitting new mix pays a Parcel; the first exact crack of the UTC day adds four bonus Parcels. A cracked recipe resets the shared board, which the merchant reads again before its next mix.

The routine reconciles quota through `witch_cipher_info()` before spending and allows at most five local attempts per UTC day, respecting the account-wide five-mix limit and realm restriction. It journals attempts before submitting `brew()` so a timeout or reload cannot replay the same uncertain spend. It brews from the stand when Computer access is available; otherwise it reads the Witch's position from `G.quests.witch` and travels there under the same merchant navigation lock. It returns to the stand when finished or out of usable ingredients. No ingredients are bought, pulled from the bank, or automatically farmed by this routine; existing loot deliveries can supply the merchant. If the bag cannot make a clue-compatible recipe, it waits for ingredients or a new clue board.

The merchant route uses synthetic tests for successful knocks, reloads, UTC reset, account limits, transient failures, Ghost tricks, inventory/health limits and competing navigation. Real rewards and seasonal availability can only be confirmed against the running game.
