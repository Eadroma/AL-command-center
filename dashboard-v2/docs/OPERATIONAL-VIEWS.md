# Operational views

Merchant starts with activity, progress and blockers. The explained queue shows
inventory candidates, not a guaranteed runtime itinerary. It uses the editor
profile, explicitly including unsaved edits; activity comes from live telemetry.
Rule links reveal the relevant nested workspace and expand its persistent panel
without clearing editor drafts. Bank rules navigate to the Bank page.

Compound progression shows unlocked/unbound inventory stock at each level and
the merchant's last observed bank snapshot, with its capture time. Bank contents
are not assumed live or available: bank telemetry does not expose item locks.
Complete carried trios and target-level stock are shown separately.
Attempt counters persist in game storage per character and profile. They begin
with the first deployment of the tracking code. Confirmed true/false responses
count successes/destructions; errors or missing acknowledgements remain
unconfirmed. Cost is acknowledged scroll consumption at catalog replacement
value, excluding equipment value and uncertain actions. Old history is not inferred.

The item inspector is a read-only explanation of explicit production, craft,
sale, exchange, listing and deposit rules. Server eligibility, remote ownership,
commercial goals and equipment handoff protections still require runtime checks.
It never executes an action or writes a profile.

Performance displays observed farming segments per character. Consecutive
five-minute buckets group separately by terrain, server, target and participants.
Gaps exceeding ten minutes split segments. Bucket timestamps cannot order
multiple context changes within a bucket, so segments can share a time window.
Segments under five observed minutes are hidden initially but remain inspectable.
Changing filters recomputes
the groups within that window. Merchants are excluded when a profile is present.
Rates use observed character-time; historical build identity is not recorded.
Gold from loot is separate from wallet changes. Unknown cost coverage remains
unavailable; short sessions and partial measurements are marked explicitly.
