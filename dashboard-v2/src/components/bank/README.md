# Bank components

`BankItemCard` renders one occupied bank slot. It resolves the display name and
sprite through the bootstrap catalog while retaining the raw item ID, pack and
slot for troubleshooting. Filtering and snapshot selection stay in pure models
or the page component; cards never mutate game or server state.
