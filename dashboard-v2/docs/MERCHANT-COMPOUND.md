# Merchant compound production

Open **Merchant → Production → Compound**. Enable compound, select compoundable
items, and set a target level for each item. Save the profile, preview the build,
then deploy the merchant. New and migrated profiles leave compound disabled.

The runtime combines three unlocked, unbound copies of the same item and level.
It rechecks the trio after Mass Production, chooses the appropriate compound
scroll, and buys one missing scroll when the shared upgrade gold reserve permits.
Compound runs as stationary idle work, independently of the upgrade switch.
The stand remains open during production. Success is not guaranteed by the game.

Configured components are protected from NPC sales and ordinary bank deposits.
Intermediate copies (+1 and above) also enter the normal bank deposit queue,
even when they are absent from the recurring bank list. Complete trios below the
target stay together for the next compound, so retrieved stock is not immediately
deposited again. Base copies remain available for production. Copies reaching or
exceeding the target are always queued. Locked, bound, and
foreign-owned copies remain excluded from production and output handling.

**Check bank stock after each deposit trip** is optional. After confirmed deposits,
the merchant inspects loaded bank packs and completes at most one equal-level
trio per configured item. It visits the required bank floors, rechecks each source
slot and verifies the inventory increased after withdrawal. It keeps one free
inventory slot for scrolls. Incomplete trios stay in the bank. This option does not
schedule extra bank trips when the merchant has nothing to deposit.

Implementation: `code/compound-production.js` owns target eligibility and bank
stock retrieval. `eadrosell-merchant-v2.js` owns production, scroll purchasing,
and the existing verified bank deposit queue. The builder rejects non-compoundable
targets using the imported game catalog. The UI uses the same catalog filter.
