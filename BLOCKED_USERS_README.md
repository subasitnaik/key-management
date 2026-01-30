# Blocked users (seller panel)

To enable the **Blocked users** page in the seller panel, mount the blocked router in your seller panel router.

In **sellerPanel.js** (or wherever you define the `/panel/seller` routes), add:

```js
import sellerBlockedRouter from './sellerBlocked.js';
// ...
router.use(sellerBlockedRouter);
```

Also add **Blocked** to the seller nav in your seller views (dashboard, keys, plans, payments) so sellers can open `/panel/seller/blocked`. The blocked page view already includes a nav with Blocked.

Paths:

- `GET /panel/seller/blocked` — list blocked users, Unblock all button, Unblock per user
- `POST /panel/seller/blocked/unblock/:userId` — unblock one (with confirmation)
- `POST /panel/seller/blocked/unblock-all` — unblock all (with confirmation)
