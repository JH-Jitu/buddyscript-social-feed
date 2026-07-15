# Postman — BuddyScript API

## Import

1. Postman → **Import** → pick `BuddyScript-API.postman_collection.json`
2. Confirm collection variable `baseUrl` = `http://localhost:3000/api`
3. Start the backend (`npm run start:dev` in `backend/`)

## Auth model

The API stores the JWT in an **httpOnly cookie** named `bs_token`.
Postman's cookie jar picks it up from `Set-Cookie` on register/login.
Do not add a Bearer token header.

If a guarded request returns 401 unexpectedly: Postman → Cookies → delete
`localhost` cookies → run **Login Alice again**.

## Suggested run order

1. **01 Auth** — creates Alice + Bob, proves validation and logout
2. **02 Posts** — text / private / image / feed cursor / likes
3. **03 Comments** — comment, reply, reject reply-to-reply, likes
4. **04 Privacy** — Bob cannot see or touch Alice's private post (404)
5. **05 Optional** — only after `npm run seed`

## Image upload

Open **Create post with image** → Body → form-data → `image` → select
`sample-image.png` from this folder (Postman often drops relative file
paths after import).

## Regenerating

```bash
node _generate-collection.mjs
```
