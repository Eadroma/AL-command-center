# Merchant inspection tools

## Equipment protections
Inventory → Equipment protection inspector shows each farmer bag slot, the transfer eligibility reported by its own `is_dumpable_slot` or ranger `is_protected_item` function and the running policy reason. Saved profile loadout matches are shown separately because saved and deployed configurations can differ. Old bundles have no decision field: deploy the desired saved profile to enable the new diagnostics. Stale samples remain explicitly labeled. This inspector never transfers items or modifies protections.

## Margin calculator
Merchant → Merchant margin calculator compares resale, catalog crafting and one compound step (+0 to +1). Enter the acquisition or replacement price of each material, operation fee, net output sale proceeds and compound success probability. Configured stand asking prices can prefill the output price. Missing prices and probabilities do not silently become zero. Expected compound cost is `(three input values + scroll/offerings) / success probability`, assuming independent attempts and destruction of all inputs on failure. This is an estimate, not a spending guarantee. Market liquidity, time, travel and multi-level production are excluded.

## Stand coordinates
Merchant → Trading → Stand position edits `seller.standSpot`. Click the town-square crop, use X/Y fields or choose Spawn / Default plaza. Coordinates use the existing main-map world bounds, not full-map pixel proportions. Values are clamped and rounded. Save the profile and deploy the merchant to apply; no automatic movement or deployment occurs while editing. The event duo also uses this spot as its assembly destination. The image does not validate game collisions.

The town crop is reused from Command Center; copyright Adventure Land, AdventureLandOnlyUse. See the existing game map assets attribution/license.

## Global search
Use the Search button, Ctrl+K or Cmd+K. Search pages, characters, catalog items, configured loadouts and merchant tools. Arrow keys select, Enter opens, Escape dismisses. The modal traps focus and restores it on dismissal. Item results open Inventory with its locator filter; merchant tool results reveal the nested workspace and collapsible card. Character/loadout results open their associated page. Search performs no deployment, purchase or transaction.

## Shared item drawer
Click an item sprite in inventories, equipped gear, bank cards or rule cards to open its shared details. Keyboard users can focus the sprite and press Enter or Space. Sprites inside item selection buttons retain their selection behavior. Character sprites remain decorative.

The right-side modal shows exact-ID matches across observed owned locations (excluding wishlist quantities), saved loadout reservations, enabled and disabled commercial rules, craft ingredient requirements, and recorded commerce / upgrade events. Commercial rule buttons close the drawer and reveal the existing rule editor. Opening details never changes settings or runs an action.

Commerce history covers the last seven days; upgrade entries come from retained deployment telemetry. No timeline is inferred from free-text bank transactions or compound aggregate counters. Bank snapshot dates and missing offline inventories remain explicit. Escape or Close restores focus to the opener.
