# Connect API (key validation for tools)

Used by Android/tools (e.g. Login.h) to validate license keys.

## Endpoint

- **POST** `/connect/:slug`  
  Example: `POST https://key-management-five.vercel.app/connect/subasit`

## Request

- **Body** (JSON or `application/x-www-form-urlencoded`):
  - `key` (required): license key
  - `uuid` (optional): device UUID (from HWID); used for device binding

- **Headers**: `Content-Type: application/json` or form encoding.

## Response

**Success (200):**

```json
{
  "status": true,
  "success": true,
  "valid": true,
  "data": {
    "token": "<license_key>",
    "rng": <unix_timestamp>,
    "EXP": "<expiry_date_dd/mm/yyyy>"
  }
}
```

**Failure (200):**

```json
{
  "status": false,
  "success": false,
  "valid": false,
  "message": "<error_message>"
}
```

Tools typically check `result["status"] == true` and `result["data"]["rng"] + 30 > time(0)` (30s clock skew).

## Mounting

In your main app (e.g. `app.js` or `api/index.js`):

```js
import connectRouter from './routes/connectRouter.js';
// Ensure body is parsed (express.json() and express.urlencoded())
app.use('/connect', connectRouter);
```

So that `POST /connect/:slug` is handled by this router.
