# Optional NPC base purchases for upgrades

Each upgrade rule has an optional `buyNpc` checkbox, off on existing rules. The
selector catalogue derives NPC availability from game data; runtime independently
checks a static merchant in G.maps/G.npcs selling a gold-purchased upgradeable item.
Coat/Pants are available from Gabriel (`basics`). Cash-only items are excluded.
Catalogue refresh keeps this metadata alongside item sprites.

The merchant buys one +0 working copy only when no copy is in its inventory,
the target is above zero, two bag slots are free, a base upgrade scroll is ready,
and the listed base price leaves the configured upgrade gold reserve intact.
Any copy, including a completed/locked one, suppresses further base purchases.
After a failed upgrade destroys the working copy, a replacement can be bought.
If finished pieces leave the bag, the rule can start another cycle; this is a
recurring production rule bounded by available gold, not a total spending budget.

Production-trip scheduling includes purchases, so normal stand/service loops do
not interrupt them. Purchase intent is persisted before sending buy. Receipt is
confirmed through inventory; ambiguous timeouts retain a hold across CODE
restarts on the same browser. Explicit gold/space/distance failures back off for
60 seconds. An observed copy clears pending state. Review the transaction journal
for unconfirmed requests; acquire a copy manually to reconcile one if necessary.

Save and deploy the merchant after changing rules. No existing checkbox is enabled
automatically, and this change does not restart the merchant on its own.

Upgrades and compounds now run at the configured stand spot, while stationary, after NPC sales, exchanges, crafting and bank work. They do not close the stand or travel to the blacksmith. Missing base items are purchased remotely from the stand without closing it or walking to the NPC. This behavior requires redeploying the merchant bundle.

NPC sales also run remotely without closing or moving the stand. Eligible stacks drain before exchanges and stationary upgrades; sales alone no longer prevent stand reopening.

Xyn batches retain travel ownership while the server exchange timer is active and while eligible exchanges remain. New bankable or NPC-sale rewards do not release the batch; remote sales can run on site. A full bag, disabled exchanges, death or an explicit bank-sort request releases the batch. Remainders below the game's recipe batch size are not retried.

After a successful explicit Sort bank command, the merchant PUTs the completed bank snapshot to ALData using character.owner and the configured integration key. Game logs include the HTTP status (200 confirms the update). Network failures/timeouts and non-200 responses do not invalidate a successful sort. No periodic upload is performed.

Carried actionable compounds and upgrades run before any base-item purchase. Once an unlocked, unbound upgradeable equipment item reaches or exceeds its positive configured target, it is queued for bank deposit instead of NPC sale or stand listing. This explicit output rule applies independently of the recurrent bank allowlist, including when that list is empty. Other items retain the allowlist-only deposit policy.
