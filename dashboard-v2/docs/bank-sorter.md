# Bank sorter

The explicit sort command pauses merchant production, stand and supply trips.
It waits for an existing chore to finish before acquiring its travel lock.
An occupied bank slot passed to `bank_store` swaps items; stack merges therefore
use automatic placement in the destination pack and verify that no new slot
was consumed. Only stacks with identical metadata can merge.

Each floor is sorted by category, catalogue gold value, item name and descending
level. Full item metadata, including stack quantity and stat modifiers, identifies
copies during swaps. One empty inventory slot is needed. Carried items are
tracked as a multiset because bank operations can compact inventory indices.
Retrieval and placement must be observed in live inventory/bank data before
progress is counted. An unconfirmed operation produces a failure, not success.
Any item remaining in the buffer on failure is retained in the merchant's bag.
The worker retains a final bank snapshot with its original capture timestamp,
so a sort completing between telemetry pulses still reaches the dashboard.
An already ordered bank explicitly reports that no moves were needed.

Regression coverage simulates occupied-slot swaps, automatic merges, inventory
compaction, all three floors, different modifiers and unconfirmed placements.
