# BuddyScript — Social Feed

A full-stack social feed built from the provided BuddyScript design. Users can
register, log in, and share text or image posts on a common feed. Posts support
public/private visibility, likes with a "who liked this" list, comments,
one-level replies, and likes on comments and replies.

**Stack:** React 19 (Vite + TypeScript) · NestJS 11 · PostgreSQL 16 (TypeORM) · JWT in httpOnly cookies

## Features

- **Authentication** — register (first name, last name, email, password) and
  log in. The JWT is stored in an httpOnly cookie, so it is never readable by
  JavaScript. Passwords are hashed with bcrypt.
- **Protected feed** — only logged-in users can reach `/`; everyone else is
  redirected to the login page.
- **Posts** — text with an optional image (JPG/PNG/WEBP/GIF up to 5 MB),
  public or private. Private posts are visible only to their author. Images
  are stored in Cloudinary when configured, or on local disk otherwise.
- **Feed** — newest first, loaded with cursor-based pagination and infinite
  scroll.
- **Likes** — like/unlike a post, see the count, and click it to see exactly
  who liked it.
- **Comments and replies** — comment on posts, reply to comments (one level
  deep), like/unlike comments and replies, and see who liked each one.

## Repository layout

```
buddyscript-social-feed/
├── docker-compose.yml     # local PostgreSQL
├── postman/               # Postman collection + sample image
├── backend/               # NestJS API (TypeORM, migrations, seed)
│   ├── src/
│   │   ├── auth/          # register/login/logout/me, JWT cookie guard
│   │   ├── users/         # user entity
│   │   ├── posts/         # posts, likes, feed pagination, image storage
│   │   ├── comments/      # comments, replies, comment likes
│   │   ├── common/        # cursor encoding for pagination
│   │   └── database/      # data source, migrations, seed script
│   └── uploads/           # post images in disk mode (gitignored)
└── frontend/              # React SPA (Vite)
    ├── public/assets/     # CSS/images from the provided design
    └── src/
        ├── auth/          # auth context + protected route
        ├── components/    # header, create post, post card, comments, modal
        ├── lib/           # fetch wrapper, time formatting
        └── pages/         # login, register, feed
```

## Getting started

Prerequisites: Node.js 20+, Docker Desktop (or any PostgreSQL 16), npm.

```bash
# 1. Start PostgreSQL (listens on host port 5433)
docker compose up -d

# 2. Backend — install, configure, migrate, seed, run
cd backend
npm install
copy .env.example .env        # cp on macOS/Linux
npm run migration:run
npm run seed                  # optional demo data
npm run start:dev             # API on http://localhost:3000

# 3. Frontend — in a second terminal
cd frontend
npm install
npm run dev                   # app on http://localhost:5173
```

Open http://localhost:5173 and log in with a demo account, or register your
own.

### Postman collection

Import `postman/BuddyScript-API.postman_collection.json` into Postman to
exercise every API path — happy paths, validation errors, auth failures,
idempotent likes, one-level reply rejection, and privacy across two users.
Auth rides the `bs_token` cookie (keep Postman's cookie jar on). Run folders
top to bottom, or use Collection Runner. A tiny `sample-image.png` is
included for the image-upload request.

| Demo account   | Password  | Notes                |
| -------------- | --------- | -------------------- |
| sarah@demo.com | Password1 | has one private post |
| rafiq@demo.com | Password1 |                      |
| nadia@demo.com | Password1 |                      |

In development the Vite dev server proxies `/api` and `/uploads` to the
backend (see `frontend/vite.config.ts`), so both apps share one origin and
the auth cookie just works.

### Image storage (optional Cloudinary)

Out of the box, uploaded images land in `backend/uploads/` and are served
from `/uploads` — no external account needed. For deployments on hosts with
ephemeral filesystems (Render, Railway...), set `CLOUDINARY_URL` in
`backend/.env` and images are stored in Cloudinary instead:

```bash
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
```

The mode is picked once at startup by `ImageStorageService`; the rest of the
app only ever sees a URL string.

### Production build (single server)

The backend serves the built frontend, so one process serves everything:

```bash
cd frontend && npm run build     # writes frontend/dist
cd ../backend && npm run build   # writes backend/dist
set NODE_ENV=production          # export on macOS/Linux
npm run start:prod               # everything on http://localhost:3000
```

`AppModule` detects `frontend/dist` and serves it at `/`, with unknown paths
falling back to `index.html` so client-side routes survive a hard refresh.
`/api/*` and `/uploads/*` are excluded from that fallback.

## API overview

All routes are prefixed with `/api`. Authenticated routes read the JWT from
the `bs_token` httpOnly cookie.

| Method | Path                                   | Description                                                   |
| ------ | -------------------------------------- | ------------------------------------------------------------- |
| POST   | `/auth/register`                       | create account, sets auth cookie                              |
| POST   | `/auth/login`                          | log in, sets auth cookie                                      |
| POST   | `/auth/logout`                         | clears the cookie                                             |
| GET    | `/auth/me`                             | current user (session check)                                  |
| GET    | `/posts?limit&cursor`                  | feed page, newest first, keyset cursor                        |
| POST   | `/posts`                               | create post (`multipart/form-data`: content, privacy, image?) |
| POST   | `/posts/:id/like`                      | like (idempotent)                                             |
| DELETE | `/posts/:id/like`                      | unlike                                                        |
| GET    | `/posts/:id/likes`                     | who liked the post                                            |
| GET    | `/posts/:postId/comments?limit&offset` | comments with replies                                         |
| POST   | `/posts/:postId/comments`              | add comment (or reply via `parentCommentId`)                  |
| POST   | `/comments/:id/like`                   | like a comment/reply (idempotent)                             |
| DELETE | `/comments/:id/like`                   | unlike                                                        |
| GET    | `/comments/:id/likes`                  | who liked the comment/reply                                   |

## Database schema

Five tables, all UUID keys, created through TypeORM migrations
(`backend/src/database/migrations`).

```
users          id, first_name, last_name, email (unique), password_hash, created_at
posts          id, author_id → users, content, image_url?, privacy, created_at
post_likes     (post_id, user_id) composite PK, created_at
comments       id, post_id → posts, author_id → users, parent_comment_id? → comments,
               content, created_at
comment_likes  (comment_id, user_id) composite PK, created_at
```

Notable choices:

- **Likes use composite primary keys** `(post_id, user_id)`. A duplicate like
  is impossible at the database level, and like/unlike stays idempotent even
  under concurrent requests (`INSERT ... ON CONFLICT DO NOTHING`).
- **Comments and replies share one table** (adjacency list via
  `parent_comment_id`). The product limits nesting to one level, but the
  schema would support deeper threads without a migration.
- **`posts (created_at, id)` composite index** backs both the feed's
  `ORDER BY` and the cursor condition, so pagination never scans skipped rows.

## Design decisions

**JWT in an httpOnly cookie rather than localStorage.** A token in
localStorage is readable by any injected script, so an XSS bug becomes an
account takeover. The httpOnly cookie is invisible to JavaScript;
`SameSite=Lax` blocks cross-site POSTs, and the cookie is `Secure` in
production. The trade-off (the browser sends it automatically) is what the
SameSite attribute is for.

**Cursor (keyset) pagination instead of OFFSET.** The task says to design for
millions of posts. `OFFSET 100000` still walks 100 000 rows before returning
any; a keyset condition `(created_at, id) < (cursor)` jumps straight to the
right place in the index, so page 1 and page 10 000 cost the same. The cursor
is an opaque base64url token, and the `id` tiebreaker keeps ordering stable
when two posts share a timestamp.

**Privacy enforced in one place.** Every per-post action (view, like, comment,
list likers) funnels through the same guard that checks
`privacy = 'PUBLIC' OR author_id = viewer`. Private posts return 404 rather
than 403, so the API never confirms that a hidden post exists.

**Aggregates are batched, not N+1.** The feed loads a page of posts, then
fetches like counts, my-like flags, and comment counts in three grouped
queries and merges them in memory. Twenty posts cost four queries total, not
sixty-one.

**Optimistic UI for likes.** The button flips instantly and the server's
authoritative count reconciles afterwards; on failure the UI rolls back. Post
creation is pessimistic (the created post comes back from the server and is
prepended), which avoids fake temporary IDs.

**Image storage is pluggable, decided by configuration.** Files are validated
by MIME type (JPG/PNG/WEBP/GIF) and capped at 5 MB before any storage work
happens. `ImageStorageService` then stores the image in **Cloudinary** when
`CLOUDINARY_URL` is set (durable across redeploys, CDN-served — the right
choice for hosts with ephemeral filesystems), and on **local disk** otherwise
(zero external dependencies, so the project runs out of the box). In disk
mode the file is renamed to a UUID — the client's filename is never trusted —
and served from a static `/uploads` route. The database stores only the URL
string, so adding S3 later would touch one file.

**Security middleware.** `helmet` for security headers, global rate limiting
(100 req/min, 10 req/min on auth endpoints against brute force), DTO
validation with `whitelist: true` and `forbidNonWhitelisted: true` so
unexpected fields are rejected, and generic auth errors that don't reveal
whether the email or the password was wrong.

## Scripts

Backend (`backend/`):

| Script                                       | Purpose                                                          |
| -------------------------------------------- | ---------------------------------------------------------------- |
| `npm run start:dev`                          | API with file watching                                           |
| `npm run build` / `npm run start:prod`       | compile and run production build                                 |
| `npm run migration:run` / `migration:revert` | apply / roll back migrations                                     |
| `npm run seed`                               | insert demo users, posts, likes, comments (skips if data exists) |
| `npm run lint` / `npm run test`              | ESLint / Jest                                                    |

Frontend (`frontend/`):

| Script            | Purpose                                 |
| ----------------- | --------------------------------------- |
| `npm run dev`     | Vite dev server with API proxy          |
| `npm run build`   | type-check and build to `frontend/dist` |
| `npm run preview` | serve the production build locally      |
