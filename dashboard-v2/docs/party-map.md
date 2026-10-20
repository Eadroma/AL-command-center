# Interactive party map

## Tactical navigation

Selecting a live character displays its reported destination as a crosshair.
A dashed segment shows direction when origin and destination share a terrain;
it is not a calculated traversable path. The active movement watchdog route
takes precedence over generic intent. Navigation recovery uses amber styling,
attempt count and reported time without progress. Destination terrain can be
opened from the sidebar, which also reuses the Party decision explanation.
Offline/disabled characters do not expose stale routes as live navigation.

Party displays one terrain in a large camera view, with an always-visible roster.
Select a live character to center and follow it; following changes terrain when
the character moves to another map. Dragging or choosing a terrain stops follow.
Camera controls provide zoom (1–8×) and fit-to-terrain. Zoom and camera position
survive normal telemetry refreshes. The expanded view closes with Escape.

Terrain images and bounds come from the local game catalogue. Maps without
assets use the coordinate fallback. Offline/disabled characters remain in the
roster but never receive a live marker. Small dots identify exact coordinates;
portrait offsets keep nearby characters selectable. Portraits retain a constant
screen size at every zoom level.

Optional ten-minute trails fade with age. They never connect different maps,
different servers, or samples separated by 20 seconds or more. The sidebar shows
current intent, HP, target and coordinates for a selected live character.
The display refreshes at the existing telemetry cadence, not game-frame speed.
All interactions are read-only and never move or restart game characters.

Desktop uses a map/sidebar layout; mobile places the roster below the map.
Both Guild and Retro retain their existing palette tokens.
