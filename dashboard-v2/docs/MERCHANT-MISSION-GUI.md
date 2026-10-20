# In-game merchant mission HUD

The merchant bundle includes code/merchant-mission-gui.js after the expedition coordinator. A collapsible, read-only overlay appears at the upper right in the game page. It shows mission phase, reason, duration, worker readiness/return status, report freshness, deaths and observed boss hits/damage, plus five recent state-change notifications. Complete is labelled expedition closed, not proof of a boss kill. Offline workers remain explicit; reports older than 15 seconds are marked stale.

Worker readiness reasons require updated worker bundles: dead, travelling, health below 70%, mana below 20%, or fewer than 20 HP/MP potions. Older reports still show ready/waiting without inventing the missing reason. This HUD never changes priorities, starts/stops characters or sends browser notifications. Text uses textContent, and absence of a browser DOM does not interrupt merchant actions. A reload replaces the overlay. Notifications are local to this script session.

## Operations panels

Three additional collapsed panels are installed: merchant queue (transaction, next eligible task and held work), production (upgrade lots, recorded cost and remaining budget; current craft batch; compound outcomes), and merchant session (wallet delta, observed loot gold/items, confirmed NPC sale receipts, deaths and sampled movement time). All panels use the draggable mission header helper and independent local-storage positions per character/panel. Clicking still toggles collapse; arrow keys move a focused header. Positions are clamped to the viewport.

Session values start when the HUD loads and reset when CODE restarts; they are merchant-only, not team aggregates. Transfers are not counted as loot. Movement samples cap large gaps, so suspended tabs are not invented activity. Craft remaining counts only the current batch; compound costs are confirmed scroll replacement value, not a production budget. Queue candidates are guidance and do not imply an action is scheduled. Headless clients have no panels.
