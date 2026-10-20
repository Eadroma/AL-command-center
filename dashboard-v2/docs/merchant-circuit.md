# Merchant circuit overview

The Merchant planner combines live intent, smart-move destination, current
transaction and the five latest completed/failed transactions. Stale telemetry
suppresses the circuit. No runtime task is scheduled by this view.

Bank, exchange and upgrade counters are inventory candidates against the current
dashboard profile (including unsaved edits), not an ordered itinerary or exact
remaining operation count. Locked/bound items are excluded. Exchange counts
stacks meeting the configured minimum; upgrade counts pieces below the target.
Recipe requirements, reservations, scrolls, gold and runtime compound eligibility
can reduce actionable work. Missing inventory is unknown rather than empty.

The seven existing runtime lanes remain an inferred configuration overview;
their cadence is approximate and Ready does not guarantee queued work.
