# Measured session comparison

Performance history exposes explicit A/B captures of filtered farmer buckets.
Select a lookback, character, terrain and server, give the experiment a label,
capture A, change the filters and capture B. Captures hold aggregate values and
do not change when telemetry refreshes. They are local to this mounted page.
Merchant rows are excluded when the profile is available.

These are comparison snapshots of historical periods, not CODE session records.
Bucket timestamps describe the displayed range; observed character-minutes are
the rate denominator. Multiple characters produce a time-weighted per-character
rate, not team revenue. Labels cannot establish historical build identity.

Net gold and consumable rates use matched economy intervals, exclude wallet
transfers and preserve negative net. Unknown replacement prices suppress net
and cost rates. Partial coverage and samples under five minutes are flagged.
XP retains the history collector's positive-delta/level-transition limitations.
Moving and combat counters can overlap; their percentages need not sum to 100.
Differences are B minus A, with percentage-point differences for time ratios.

Captures are disabled while the selected lookback is fetching or errored, so
previous query data cannot be labelled with the new period. Economic numerators
and denominators both exclude rows without a positive matched interval.
