# Free Source Panel vs Our Panel – Feature Comparison

**Connect API & Telegram bot:** Not changed (working; left as-is).

---

## Free Source Panel (Reference)

### Connect API (POST)
- **Input:** `game`, `user_key`, `serial` (Finisher format)
- **Maintenance:** When `onoff.status=on`, returns `status:true` + `reason:myinput` (custom message)
- **Success response:** `status`, `reason`, `data` with: `real`, `token` (MD5), `modname`, `mod_status`, `credit`, `ESP`, `Item`, `AIM`, `SilentAim`, `BulletTrack`, `Floating`, `Memory`, `Setting`, `EXP`, `exdate`, `device`, `rng`
- **Key lookup:** `keys_code` by `user_key` + `game`
- **Device logic:** Comma-separated `devices`, `max_devices` (same as ours)
- **Key status:** `status` 0=blocked, 1=active

### Panel Features
| Feature | Free Source | Our Panel |
|---------|-------------|-----------|
| Maintenance toggle | ✅ onoff table | ✅ sellers.maintenance_mode |
| Maintenance custom message | ✅ onoff.myinput | ❌ Missing |
| Mod name | ✅ modname table | ❌ Missing |
| Mod status text | ✅ _ftext | ❌ Missing |
| Feature toggles (ESP, Item, etc.) | ✅ Feature table | ❌ Missing |
| Key generate | ✅ username-duration-random | ✅ daysDx format + custom |
| Key list | ✅ | ✅ |
| Key edit (max_devices, status, expired) | ✅ | ❌ Delete only |
| Device reset per key | ✅ api_key_reset | ❌ Missing |
| Delete key | ✅ | ✅ |
| Delete expired keys | ✅ | ❌ Missing |
| Delete unused keys | ✅ | ❌ Missing |
| Download all keys | ✅ | ❌ Missing |
| Users / Resellers | ✅ level, saldo | ❌ Different model (sellers) |
| Referral codes | ✅ | ❌ Missing |
| History log | ✅ | ❌ Missing |
| LIB upload | ✅ | ❌ Missing |

---

## Implemented in Our Panel (Aligned with Free Source)

1. **Maintenance message** – Custom message when maintenance is on (sellers.maintenance_message)
2. **Device reset per key** – Clear device list so key can be used on new devices
3. **Key edit** – Edit max_devices, expires_at, status (block/unblock)
4. **Delete expired keys** – Bulk delete expired subscriptions
5. **Mod name** – Display name for the mod (sellers.mod_name)

---

## Migration (run in Supabase SQL Editor)

```sql
-- Add Free Source–compatible panel fields
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS maintenance_message TEXT DEFAULT '';
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS mod_name TEXT DEFAULT '';
```

---

## Not Implemented (Different Architecture)

- **Feature toggles (ESP, Item, etc.)** – Free Source returns these in connect; our tools use token/rng/EXP only. Can add later if tools need them.
- **Users/Resellers/Saldo** – Our model uses sellers + Telegram users; no saldo/credits.
- **Referral codes** – Not in current scope.
- **History log** – Can add later.
- **LIB upload** – Server file upload; different deployment model.
