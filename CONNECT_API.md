# Connect API (Android tools: Finisher Tool, PRESIDENT Tool)

This API is used by the **Finisher Tool** and **PRESIDENT Tool** (and any compatible Android app) to validate keys. Both tools use the same contract.

## Endpoint

- **POST** `/connect/:slug`  
  `:slug` = seller slug (from the panel connect link, e.g. `https://your-domain.com/connect/mystore` → slug = `mystore`).

## Request

- **Content-Type:** `application/x-www-form-urlencoded`
- **Body:** `key=<license_key>&uuid=<device_uuid>`
  - `key` – license key (from panel / Telegram).
  - `uuid` – device UUID derived by the app from Android ID + model + brand (same format as PRESIDENT/Finisher).

## Success response (200)

```json
{
  "success": true,
  "data": {
    "token": "1",
    "rng": 1738166400
  }
}
```

- `rng` = server Unix timestamp. The tool checks `rng + 30 > time(0)` to avoid stale responses.
- PRESIDENT Tool also reads `data.EXP` (expiry string) if present; the backend may include it for compatibility.

## Error response (4xx/5xx)

```json
{
  "success": false,
  "error": "Invalid key"
}
```

Common `error` values: `Missing slug`, `Invalid key`, `Invalid link`, `Key expired`, `Under maintenance`, `Seller suspended`, `Device limit reached`, `Use POST with key and uuid`, `Server error`.

## Mounting in the app

1. **Body parser**  
   The Connect route uses `req.body.key` and `req.body.uuid`. Ensure the main app parses URL-encoded bodies **before** the connect router, e.g.:

   ```js
   import express from 'express';
   app.use(express.urlencoded({ extended: true }));
   ```

2. **Connect router**  
   Mount the connect router at `/connect`:

   ```js
   import connectRouter from './src/routes/connectRouter.js';
   app.use('/connect', connectRouter);
   ```

3. **Order**  
   Mount `/connect` so it is not shadowed by other routes (e.g. mount it before a catch-all or `/panel`).

## Finisher Tool URL

The Finisher Tool source uses a hardcoded URL (e.g. `https://teamruthless.ai-new.xyz/connect`). To use your panel:

1. Rebuild the app with the connect URL set to: `https://<your-panel-domain>/connect/<seller_slug>`.
2. Or use a single slug: e.g. `https://<your-panel-domain>/connect/finisher` and create a seller with slug `finisher` in the admin panel.

The seller’s **Connect link** in the seller dashboard is exactly this URL (with that seller’s slug).
