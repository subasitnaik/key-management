# Backend – /connect Compatibility Layer

Server-side compatibility layer for the ALP (AndLua) tool. Handles auth requests in the exact format expected by the legacy tool.

## Base URL Model

- **Seller configures:** One base URL, e.g. `https://abctool.com/connect/`
- **Tool sends:** POST directly to that URL (no `login.php` append)
- **Request body:** `username`, `password` (key), `uuid` (device ID)
- **Response format:** Same as legacy panels (plain text)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/connect` or `/connect/` | Tool auth (plain-text response) |
| GET | `/health` | Health check (JSON) |

## Response Format (plain text)

- **Success:** `loginisdone\n【username】{username}【username】\n;{expire};`
- **Errors:** `expired` \| `notregistered` \| `notinlist`

See `legacy panel/ALP_AUTH_CONTRACT.md` for full contract.

## Run

```bash
npm install
npm start
```

## Test

```bash
# Valid key
curl -X POST http://localhost:3000/connect/ \
  -d "username=user1&password=testkey123&uuid=device-123"

# Invalid key
curl -X POST http://localhost:3000/connect/ \
  -d "password=wrong&uuid=device-123"
```

## Integration

Replace `keyValidator.js` with your real backend logic (DB, credits, maintenance mode). The validator must return:

- `{ status: 'success', username, expire }` on success
- `{ status: 'expired'|'notregistered'|'notinlist' }` on failure
