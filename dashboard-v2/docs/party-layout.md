# Party overview layout

Party separates three tasks: monitor live status, prepare a deployment, and inspect live positions. Diagnostics and logs are available in a keyboard-accessible disclosure below the map.

`PartyPage.module.scss` owns these page sections. Do not put the roster, controls and diagnostics back into a single auto-placement grid: its row height is determined by the tallest panel, leaving empty space beneath short panels.

The roster uses independent character cards with two columns at desktop widths and one on small screens. Opening an inventory expands its card without making its neighbour stretch. Script selectors and status actions wrap inside the card. The setup area uses three columns, then two below 1000px and one below 650px. Save/deploy behaviour and profile state remain owned by the existing panels.

Operational signals use a compact responsive grid. Keep important status visible; reserve disclosures for detailed investigation rather than save errors or primary actions.
