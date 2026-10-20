# Incident context replay

The API buffers accepted telemetry reports for up to two minutes / 60 frames
per deployment session. New death evidence or entry into stalled/blocked
navigation freezes a context capture (up to 20 per session). Repeated death
evidence is deduplicated. Capture frames can include reports up to 20 seconds
after the event when evidence arrives late. Older incidents have no context
rather than unrelated current data.

Frames include reported position, HP/MP, target ID, intent, movement state,
combat diagnostic and its limited recent action history. Captures are stored
with the existing telemetry session and survive local API restarts. They do
not span CODE deployment sessions, record every game tick or synchronize the
entire party. Session retention follows the existing telemetry lifecycle.

Incident Center exposes captures by character and incident kind; the selector
lets operators choose an occurrence and scrub through received reports.
Gaps over ten seconds are flagged. Missing diagnostics on older bundles remain
unavailable. Server report time and game event time can differ if clocks drift.
No recovery or game commands are issued by replay. New captures begin after
the local API runs the updated collector; historical context is not backfilled.
