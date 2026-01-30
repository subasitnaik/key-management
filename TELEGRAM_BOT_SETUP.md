# Telegram bot – exact setup steps

Follow these steps so the bot works end-to-end: payment requests, seller approval, key delivery, and (optional) auto-approve join requests.

---

## 1. Create the bot and get the token

1. Open Telegram and search for **@BotFather**.
2. Start a chat and send: `/newbot`.
3. When asked, enter a **name** for the bot (e.g. “My Channel Bot”). This is the display name.
4. Then enter a **username** that must end with `bot` (e.g. `mychannel_paid_bot`). This is the bot’s handle.
5. BotFather will reply with a **token** like:
   ```
   7123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
6. **Copy and save this token.** You will paste it in the admin panel in step 4.

---

## 2. Ensure backend and env are correct

1. **Backend is deployed** (e.g. on Vercel) and live at a public HTTPS URL (e.g. `https://key-management-five.vercel.app`).
2. In your hosting (e.g. **Vercel → Project → Settings → Environment Variables**), set:
   - **`PANEL_URL`** = your **exact** panel URL **with no trailing slash**, e.g.  
     `https://key-management-five.vercel.app`  
   This is used to build the webhook URL Telegram will call.
3. **Supabase** (and any other env vars the app needs) are already set. The `telegram_sessions` table must exist (it’s in `src/db/schema.pg.sql` – run that in Supabase if you haven’t).

---

## 3. Create or edit a seller and add bot + Telegram details

1. Log in as **Master Admin** → **Sellers**.
2. Either **create a new seller** or open an **existing seller** (Edit).
3. Fill in at least:
   - **Username** and **Password** (for the seller panel).
   - **Slug** (used in the connect URL, e.g. `myseller` → `/connect/myseller`).
   - **Telegram bot token**  
     Paste the token from step 1 (e.g. `7123456789:AAHxxxxxxxx...`).
   - **Telegram username**  
     The **seller’s** Telegram @username (the person who will approve payments and get DMs from the bot).  
     Example: `@seller_john`.  
     The bot will send payment notifications and Accept/Reject/Block buttons to this user.
4. Optional but recommended:
   - **Private group link**  
     Invite link for the paid users’ private group. After payment is accepted, the user gets their key **and** this link in a message from the bot.
   - **Query group link**  
     Used if you use query-channel features (optional).
5. **Save** the seller.

After save, the backend automatically calls Telegram’s `setWebhook` so that updates for this bot are sent to:

`https://<PANEL_URL>/api/telegram/webhook/<seller_id>`

No manual webhook call is needed if `PANEL_URL` is set and the seller has a bot token.

---

## 4. Seller: start the bot once (required for payment notifications)

1. In Telegram, the **seller** (the account whose @username is set in the panel) must search for **your bot** and tap **Start** (or send `/start`).
2. The bot will show: *"You're the seller. Send a photo to set or change the payment QR code."* — it does **not** show plans to the seller.
3. The seller can send a **photo** (payment QR image) at any time; the bot saves it and uses it when **other users** choose a plan.
4. The bot stores the seller’s chat ID when they `/start`, so payment requests are sent **reliably** to that chat (Accept/Reject/Block buttons). Without the seller starting the bot, payment screenshots from users would not reach the seller.

---

## 5. User flow (how the bot is used)

- **Seller** (Telegram username set in panel): `/start` → sees “Send a photo to set or change payment QR” → can send a photo to set/change the QR. No plans shown.
- **Other users**: `/start` → see plans → choose plan → see payment QR (if seller set one) and instructions → send payment screenshot with UTR → seller gets the request in their bot chat with Accept/Reject/Block.

1. **User** finds your bot (e.g. from your channel or link).
2. User sends **`/start`** to the bot.
3. Bot shows **plans** (from the seller’s plans in the panel). User picks a plan.
4. Bot asks for a **payment screenshot with UTR number** (e.g. in the caption).
5. User sends a **photo** (screenshot) and optionally adds UTR in the caption.
6. Bot creates a **payment request** and:
   - Sends a message **to the seller’s Telegram** (the `telegram_username` you set) with:
     - User, plan, UTR, attempts
     - Buttons: **Accept** | **Reject** | **Block**
7. **Seller** (in Telegram) taps **Accept** (or Reject/Block).
8. On **Accept**:
   - Backend creates a **subscription** and a **key** for that user.
   - Bot sends the user a message with:
     - **Key** and **expiry**
     - **Private group link** (if you set “Private group link” for the seller).
9. User can then use the key in your Android/other tool with the **Connect** URL (e.g. `https://<PANEL_URL>/connect/<slug>`).

---

## 6. (Optional) Auto-approve join requests for the private group

If you use a **private group** where users must request to join:

1. Create a **Telegram group** and set it to **restrict who can add users** (join by request).
2. Add **your bot** to the group as an **administrator**.
3. Give the bot the right: **“Approve invite requests”** (or equivalent in your client).
4. Put the group’s **invite link** in the seller’s **Private group link** in the admin panel (step 3).
5. When a user with an **active subscription** (key not expired) requests to join that group, the bot will **automatically approve** their join request.

No extra config is needed in the panel beyond the bot token, seller’s Telegram username, and private group link.

---

## 7. Checklist

- [ ] Bot created with @BotFather; token copied.
- [ ] `PANEL_URL` set in Vercel (or your host) to the exact HTTPS URL, no trailing slash.
- [ ] Seller created/edited with **Telegram bot token** and **Telegram username** (seller’s @username).
- [ ] **Seller** has **started the bot** in Telegram (so the bot can send payment requests to them and seller can set payment QR).
- [ ] Seller has **at least one plan** (Plans in seller panel) so `/start` shows plans.
- [ ] (Optional) Private group created; bot added as admin with “Approve invite requests”; link set in **Private group link**.

---

## 8. Troubleshooting

| Problem | What to check |
|--------|----------------|
| Bot doesn’t reply to `/start` | Webhook: `PANEL_URL` correct? Seller has bot token? Redeploy and/or re-save seller to re-run `setWebhook`. Check Vercel logs for errors on `POST /api/telegram/webhook/:sellerId`. |
| Seller doesn’t get payment notifications | Seller’s **Telegram username** set correctly (with or without `@`). Seller has **started the bot** once. |
| Accept/Reject/Block doesn’t work | Seller must tap the button in the **message from the bot** (the one sent to their Telegram). Same bot, same chat. |
| User doesn’t get key after Accept | Check seller has **credits** (Master Admin → Sellers → Adjust credits). Check Vercel/server logs for errors. |
| Join request not auto-approved | Bot is **admin** of the group with “Approve invite requests”. User has an **active subscription** for that seller. Private group link in panel matches the group where the bot is admin. |

---

## 9. Webhook details (for debugging)

- Webhook URL format: `https://<PANEL_URL>/api/telegram/webhook/<seller_id>`  
  Example: `https://key-management-five.vercel.app/api/telegram/webhook/1`
- It is set automatically when you create or update a seller with a **Telegram bot token**.
- Updates received: `message`, `callback_query`, `chat_join_request` (so /start, photos, button clicks, and join requests are handled).

If you need to re-set the webhook (e.g. after changing domain), edit the seller, change the token or re-paste the same token, and save again.
