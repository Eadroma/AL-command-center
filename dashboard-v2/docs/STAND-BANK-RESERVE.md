# Bank reserve for stand listings

Each stand listing can set `bankReserve` (default zero), counted per item and exact level. The restock routine scans usable, unlocked, unbound and correctly owned bank stock and retrieves one unit only when stock exceeds a positive reserve. Existing zero-reserve stack listings retain their whole-stack withdrawal behavior. Stack surplus is returned to its original empty bank slot after a verified split; a full stand prevents withdrawal.

Finished upgrades continue to deposit first. A persisted, short-lived reservation identifies the copy withdrawn for the stand and prevents immediate redeposit. Other copies remain bankable. Successful publication releases the reservation; stale reservations expire safely back to the normal bank policy.

Configure the listing under Merchant → Settings → Trading → Player Stand, set Minimum kept in bank, save and deploy. This does not resume a paused production rule or set a sale price automatically. The reserve governs future withdrawals; it does not recall existing listings when bank stock falls below the reserve.

## Expanded stands
Stand capacity mirrors the game's server rule: 16 normally, 24 for merchants at level 70 or with cstand, 30 at level 80. Real buy rules reserve the last eight slots; the remaining slots are available for sales. Telemetry accepts all 30 possible slots. Finished bank-withdrawn listing stock bypasses the new-output deposit gate, while newly produced finished gear still goes to bank first.
