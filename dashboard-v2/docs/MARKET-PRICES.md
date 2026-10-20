# Bank stock and indicative stand prices

Merchant → Trading → Player Stand → Choose stock from bank uses the newest persisted bank snapshot. Select fills item, exact level and editable price in the listing form. Adding and saving remain explicit; selecting never withdraws or lists an item.

The local GET /api/market-prices reads https://aldata.earthiverse.ca/merchants without credentials or uploading bank data. ALData collects observed trade slots, not completed transactions. Its source limits merchants to the past week. We exclude buy orders, invalid prices and old observations, group by exact item/level, deduplicate identical prices from the same merchant, and calculate unweighted arithmetic mean, median, minimum and maximum. Quantities do not weight prices. Servers are combined. Rare outliers or stale listings can make estimates misleading.

Cache: five minutes, one shared request, ten-second timeout. On upstream failure a prior cache is labelled stale; without cache the picker still works with manual pricing. Items without offers have no estimated price, not a zero-gold valuation. Bank snapshots do not prove current availability, locks or reservations; the runtime rechecks them before withdrawal.

Source: https://github.com/earthiverse/ALData/blob/main/source/merchants.ts
