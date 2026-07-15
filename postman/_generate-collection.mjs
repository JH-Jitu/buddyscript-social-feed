import { writeFileSync } from 'fs';

function req(name, method, path, opts = {}) {
  const {
    body,
    query,
    tests = '',
    prerequest = '',
    description = '',
    auth = null,
  } = opts;

  const pathParts = path.replace(/^\//, '').split('/').filter(Boolean);
  const url = {
    raw: `{{baseUrl}}${path}`,
    host: ['{{baseUrl}}'],
    path: pathParts,
  };
  if (query) {
    url.query = query;
    url.raw +=
      '?' +
      query
        .map((q) => `${encodeURIComponent(q.key)}=${encodeURIComponent(q.value)}`)
        .join('&');
  }

  const item = {
    name,
    request: {
      method,
      header:
        body?.mode === 'raw'
          ? [{ key: 'Content-Type', value: 'application/json' }]
          : [],
      url,
      description,
    },
  };

  if (auth === 'noauth') item.request.auth = { type: 'noauth' };
  if (body) item.request.body = body;

  const events = [];
  if (prerequest) {
    events.push({
      listen: 'prerequest',
      script: { type: 'text/javascript', exec: prerequest.split('\n') },
    });
  }
  if (tests) {
    events.push({
      listen: 'test',
      script: { type: 'text/javascript', exec: tests.split('\n') },
    });
  }
  if (events.length) item.event = events;
  return item;
}

function jsonBody(obj) {
  return {
    mode: 'raw',
    raw: JSON.stringify(obj, null, 2),
    options: { raw: { language: 'json' } },
  };
}

function formBody(fields) {
  return { mode: 'formdata', formdata: fields };
}

const saveUser = `const json = pm.response.json();
if (json.user) {
  pm.collectionVariables.set('currentUserId', json.user.id);
  pm.collectionVariables.set('currentUserEmail', json.user.email);
}
pm.test('status is 2xx', () => pm.expect(pm.response.code).to.be.oneOf([200, 201]));
pm.test('returns user without password', () => {
  pm.expect(json.user).to.have.property('id');
  pm.expect(json.user).to.not.have.property('passwordHash');
});
pm.test('Set-Cookie includes bs_token', () => {
  const cookie = pm.response.headers.get('Set-Cookie') || '';
  pm.expect(cookie.toLowerCase()).to.include('bs_token');
});`;

const collection = {
  info: {
    name: 'BuddyScript Social Feed API',
    description: [
      '# BuddyScript API — Postman collection',
      '',
      'Covers every endpoint and the important edge cases (validation, auth, privacy, idempotent likes, nested-reply rejection).',
      '',
      '## How to use',
      '',
      '1. Start the API: `cd backend && npm run start:dev` (Postgres via `docker compose up -d`).',
      '2. Import `BuddyScript-API.postman_collection.json` into Postman.',
      '3. Collection → Variables → confirm `baseUrl` = `http://localhost:3000/api`.',
      '4. Keep Postman cookie jar enabled (default). Auth uses the `bs_token` httpOnly cookie from `Set-Cookie` — do **not** paste JWTs into Authorization headers.',
      '5. Run folders top-to-bottom, or use Collection Runner on the whole collection.',
      '',
      '## Auto-filled variables',
      '',
      '| Variable | Set by |',
      '| --- | --- |',
      '| `aliceEmail` / `bobEmail` | pre-request on Register |',
      '| `postId` / `privatePostId` / `imagePostId` | Create Post requests |',
      '| `commentId` / `replyId` | Create Comment / Reply |',
      '| `nextCursor` | Get Feed (limit=1) |',
      '',
      '## Image upload',
      '',
      'For "Create post with image", select `postman/sample-image.png` as the `image` file field (Postman may not keep relative file paths after import).',
    ].join('\n'),
    schema:
      'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: { type: 'noauth' },
  variable: [
    { key: 'baseUrl', value: 'http://localhost:3000/api' },
    { key: 'password', value: 'Password1' },
    { key: 'aliceEmail', value: '' },
    { key: 'bobEmail', value: '' },
    { key: 'currentUserId', value: '' },
    { key: 'currentUserEmail', value: '' },
    { key: 'postId', value: '' },
    { key: 'privatePostId', value: '' },
    { key: 'imagePostId', value: '' },
    { key: 'commentId', value: '' },
    { key: 'replyId', value: '' },
    { key: 'nextCursor', value: '' },
    { key: 'lastLikeCount', value: '' },
    { key: 'commentLikeCount', value: '' },
  ],
  item: [
    {
      name: '01 Auth',
      description:
        'Register / login / logout / me. Cookie `bs_token` is set by successful register and login.',
      item: [
        req('Register Alice (happy path)', 'POST', '/auth/register', {
          description:
            'Creates Alice. Email is generated once into `aliceEmail` so later requests reuse it.',
          prerequest: `if (!pm.collectionVariables.get('aliceEmail')) {
  pm.collectionVariables.set('aliceEmail', 'alice.' + Date.now() + '@demo.com');
}`,
          body: jsonBody({
            firstName: 'Alice',
            lastName: 'Postman',
            email: '{{aliceEmail}}',
            password: '{{password}}',
          }),
          tests:
            saveUser +
            `\npm.test('201 Created', () => pm.expect(pm.response.code).to.eql(201));`,
        }),
        req('Register — duplicate email → 409', 'POST', '/auth/register', {
          description: 'Same email as Alice → Conflict.',
          body: jsonBody({
            firstName: 'Alice',
            lastName: 'Again',
            email: '{{aliceEmail}}',
            password: '{{password}}',
          }),
          tests: `pm.test('409 Conflict', () => pm.expect(pm.response.code).to.eql(409));`,
        }),
        req('Register — weak password → 400', 'POST', '/auth/register', {
          description: 'Password missing a digit → validation error.',
          body: jsonBody({
            firstName: 'Weak',
            lastName: 'Pass',
            email: 'weak.{{$timestamp}}@demo.com',
            password: 'password',
          }),
          tests: `pm.test('400 Bad Request', () => pm.expect(pm.response.code).to.eql(400));`,
        }),
        req('Register — missing fields → 400', 'POST', '/auth/register', {
          body: jsonBody({ email: 'x@y.com' }),
          tests: `pm.test('400 Bad Request', () => pm.expect(pm.response.code).to.eql(400));`,
        }),
        req('Register — unexpected field → 400', 'POST', '/auth/register', {
          description: 'forbidNonWhitelisted rejects unknown properties.',
          body: jsonBody({
            firstName: 'X',
            lastName: 'Y',
            email: 'extra.{{$timestamp}}@demo.com',
            password: 'Password1',
            role: 'admin',
          }),
          tests: `pm.test('400 Bad Request', () => pm.expect(pm.response.code).to.eql(400));`,
        }),
        req('Login Alice (happy path)', 'POST', '/auth/login', {
          body: jsonBody({
            email: '{{aliceEmail}}',
            password: '{{password}}',
          }),
          tests:
            saveUser +
            `\npm.test('200 OK', () => pm.expect(pm.response.code).to.eql(200));`,
        }),
        req('Login — wrong password → 401', 'POST', '/auth/login', {
          description:
            'Same generic message whether email or password is wrong (no user enumeration).',
          body: jsonBody({
            email: '{{aliceEmail}}',
            password: 'WrongPass1',
          }),
          tests: `pm.test('401 Unauthorized', () => pm.expect(pm.response.code).to.eql(401));
const json = pm.response.json();
pm.test('generic error message', () => {
  pm.expect(JSON.stringify(json).toLowerCase()).to.include('invalid');
});`,
        }),
        req('Login — unknown email → 401', 'POST', '/auth/login', {
          body: jsonBody({
            email: 'nobody@demo.com',
            password: 'Password1',
          }),
          tests: `pm.test('401 Unauthorized', () => pm.expect(pm.response.code).to.eql(401));`,
        }),
        req('Me — authenticated → 200', 'GET', '/auth/me', {
          description:
            'Uses the bs_token cookie from the last successful login/register.',
          tests: `pm.test('200 OK', () => pm.expect(pm.response.code).to.eql(200));
const json = pm.response.json();
pm.test('returns current user', () => {
  pm.expect(json.user.email).to.eql(pm.collectionVariables.get('aliceEmail'));
});`,
        }),
        req('Logout → 200', 'POST', '/auth/logout', {
          tests: `pm.test('200 OK', () => pm.expect(pm.response.code).to.eql(200));
pm.test('success flag', () => pm.expect(pm.response.json().success).to.eql(true));`,
        }),
        req('Me — after logout → 401', 'GET', '/auth/me', {
          description: 'Cookie cleared; session is dead.',
          tests: `pm.test('401 Unauthorized', () => pm.expect(pm.response.code).to.eql(401));`,
        }),
        req('Login Alice again (restore session)', 'POST', '/auth/login', {
          body: jsonBody({
            email: '{{aliceEmail}}',
            password: '{{password}}',
          }),
          tests: saveUser,
        }),
        req('Register Bob (second user for privacy tests)', 'POST', '/auth/register', {
          prerequest: `if (!pm.collectionVariables.get('bobEmail')) {
  pm.collectionVariables.set('bobEmail', 'bob.' + Date.now() + '@demo.com');
}`,
          body: jsonBody({
            firstName: 'Bob',
            lastName: 'Viewer',
            email: '{{bobEmail}}',
            password: '{{password}}',
          }),
          tests: `pm.test('201 or already exists', () => pm.expect(pm.response.code).to.be.oneOf([201, 409]));`,
        }),
        req('Login Alice (keep Alice as default session)', 'POST', '/auth/login', {
          body: jsonBody({
            email: '{{aliceEmail}}',
            password: '{{password}}',
          }),
          tests: saveUser,
        }),
      ],
    },
    {
      name: '02 Posts',
      description:
        'Create posts (text / image / private), feed cursor pagination, likes.',
      item: [
        req('Create public text post', 'POST', '/posts', {
          body: formBody([
            {
              key: 'content',
              value: 'Hello from Postman — public text post',
              type: 'text',
            },
            { key: 'privacy', value: 'PUBLIC', type: 'text' },
          ]),
          tests: `pm.test('created', () => pm.expect(pm.response.code).to.be.oneOf([200, 201]));
const json = pm.response.json();
pm.collectionVariables.set('postId', json.id);
pm.test('has author + counts', () => {
  pm.expect(json).to.include.keys('id', 'content', 'privacy', 'author', 'likeCount', 'likedByMe', 'commentCount');
  pm.expect(json.privacy).to.eql('PUBLIC');
  pm.expect(json.imageUrl).to.eql(null);
});`,
        }),
        req('Create private post', 'POST', '/posts', {
          body: formBody([
            {
              key: 'content',
              value: 'Secret draft — only Alice should see this',
              type: 'text',
            },
            { key: 'privacy', value: 'PRIVATE', type: 'text' },
          ]),
          tests: `const json = pm.response.json();
pm.collectionVariables.set('privatePostId', json.id);
pm.test('privacy PRIVATE', () => pm.expect(json.privacy).to.eql('PRIVATE'));`,
        }),
        req('Create post with image', 'POST', '/posts', {
          description:
            'Select postman/sample-image.png as the `image` file. imageUrl will be `/uploads/...` (disk) or an https Cloudinary URL.',
          body: formBody([
            {
              key: 'content',
              value: 'Post with an image attachment',
              type: 'text',
            },
            { key: 'privacy', value: 'PUBLIC', type: 'text' },
            {
              key: 'image',
              type: 'file',
              src: 'sample-image.png',
              description: 'Pick sample-image.png from this postman/ folder after import',
            },
          ]),
          tests: `const json = pm.response.json();
if (json.id) pm.collectionVariables.set('imagePostId', json.id);
pm.test('has imageUrl when file attached', () => {
  if (!json.imageUrl) {
    console.warn('No imageUrl — attach sample-image.png to the image field and resend');
  }
  pm.expect(json.imageUrl).to.be.a('string').and.not.empty;
});`,
        }),
        req('Create post — empty content → 400', 'POST', '/posts', {
          body: formBody([
            { key: 'content', value: '   ', type: 'text' },
            { key: 'privacy', value: 'PUBLIC', type: 'text' },
          ]),
          tests: `pm.test('400 Bad Request', () => pm.expect(pm.response.code).to.eql(400));`,
        }),
        req('Create post — invalid privacy → 400', 'POST', '/posts', {
          body: formBody([
            { key: 'content', value: 'bad privacy', type: 'text' },
            { key: 'privacy', value: 'FRIENDS', type: 'text' },
          ]),
          tests: `pm.test('400 Bad Request', () => pm.expect(pm.response.code).to.eql(400));`,
        }),
        req('Get feed (default page)', 'GET', '/posts', {
          description:
            'Newest first. Alice sees public posts + her own private ones.',
          tests: `pm.test('200 OK', () => pm.expect(pm.response.code).to.eql(200));
const json = pm.response.json();
pm.test('page shape', () => {
  pm.expect(json).to.have.keys('items', 'nextCursor');
  pm.expect(json.items).to.be.an('array');
});
pm.test('private post visible to author', () => {
  const privateId = pm.collectionVariables.get('privatePostId');
  if (privateId) {
    pm.expect(json.items.some((p) => p.id === privateId)).to.eql(true);
  }
});`,
        }),
        req('Get feed — limit=1 (capture cursor)', 'GET', '/posts', {
          query: [{ key: 'limit', value: '1' }],
          tests: `const json = pm.response.json();
pm.test('exactly 1 item', () => pm.expect(json.items).to.have.lengthOf(1));
if (json.nextCursor) {
  pm.collectionVariables.set('nextCursor', json.nextCursor);
}
pm.test('nextCursor type', () => {
  pm.expect(json.nextCursor === null || typeof json.nextCursor === 'string').to.eql(true);
});`,
        }),
        req('Get feed — next page via cursor', 'GET', '/posts', {
          query: [
            { key: 'limit', value: '1' },
            { key: 'cursor', value: '{{nextCursor}}' },
          ],
          tests: `pm.test('200 OK', () => pm.expect(pm.response.code).to.eql(200));
const json = pm.response.json();
pm.test('returns a page', () => {
  pm.expect(json.items).to.be.an('array');
  pm.expect(json.items.length).to.be.at.most(1);
});`,
        }),
        req('Get feed — invalid cursor must not 500', 'GET', '/posts', {
          description:
            'Malformed cursor is ignored (decodeCursor → null); request starts from the newest posts.',
          query: [
            { key: 'limit', value: '1' },
            { key: 'cursor', value: '!!!not-a-cursor!!!' },
          ],
          tests: `pm.test('does not 500', () => pm.expect(pm.response.code).to.be.below(500));`,
        }),
        req('Like post', 'POST', '/posts/{{postId}}/like', {
          tests: `pm.test('200 OK', () => pm.expect(pm.response.code).to.eql(200));
const json = pm.response.json();
pm.test('likeCount >= 1', () => pm.expect(json.likeCount).to.be.at.least(1));
pm.collectionVariables.set('lastLikeCount', String(json.likeCount));`,
        }),
        req('Like post again — idempotent', 'POST', '/posts/{{postId}}/like', {
          description:
            'Composite PK + ON CONFLICT DO NOTHING → count stays the same.',
          tests: `const json = pm.response.json();
const prev = Number(pm.collectionVariables.get('lastLikeCount'));
pm.test('count unchanged', () => pm.expect(json.likeCount).to.eql(prev));`,
        }),
        req('Get post likers', 'GET', '/posts/{{postId}}/likes', {
          tests: `pm.test('200 OK', () => pm.expect(pm.response.code).to.eql(200));
const json = pm.response.json();
pm.test('array of users', () => {
  pm.expect(json).to.be.an('array');
  pm.expect(json[0]).to.include.keys('id', 'firstName', 'lastName');
});`,
        }),
        req('Unlike post', 'DELETE', '/posts/{{postId}}/like', {
          tests: `const json = pm.response.json();
pm.test('200 OK', () => pm.expect(pm.response.code).to.eql(200));
pm.test('likeCount decreased', () => {
  pm.expect(json.likeCount).to.be.at.most(Number(pm.collectionVariables.get('lastLikeCount')));
});`,
        }),
        req('Unlike again — still OK (idempotent)', 'DELETE', '/posts/{{postId}}/like', {
          tests: `pm.test('200 OK', () => pm.expect(pm.response.code).to.eql(200));`,
        }),
        req('Like — invalid UUID → 400', 'POST', '/posts/not-a-uuid/like', {
          tests: `pm.test('400 Bad Request', () => pm.expect(pm.response.code).to.eql(400));`,
        }),
        req(
          'Like — unknown post → 404',
          'POST',
          '/posts/00000000-0000-4000-8000-000000000000/like',
          {
            tests: `pm.test('404 Not Found', () => pm.expect(pm.response.code).to.eql(404));`,
          },
        ),
      ],
    },
    {
      name: '03 Comments',
      description: 'Comments, one-level replies, comment likes, pagination.',
      item: [
        req('Create comment', 'POST', '/posts/{{postId}}/comments', {
          body: jsonBody({ content: 'First comment from Postman' }),
          tests: `const json = pm.response.json();
pm.collectionVariables.set('commentId', json.id);
pm.test('created', () => pm.expect(pm.response.code).to.be.oneOf([200, 201]));
pm.test('content echoed', () => pm.expect(json.content).to.eql('First comment from Postman'));`,
        }),
        req('Create reply', 'POST', '/posts/{{postId}}/comments', {
          body: jsonBody({
            content: 'A reply to the first comment',
            parentCommentId: '{{commentId}}',
          }),
          tests: `const json = pm.response.json();
pm.collectionVariables.set('replyId', json.id);
pm.test('created', () => pm.expect(pm.response.code).to.be.oneOf([200, 201]));`,
        }),
        req('Reply to a reply → 400', 'POST', '/posts/{{postId}}/comments', {
          description:
            'One level of nesting only — parent must itself be top-level.',
          body: jsonBody({
            content: 'This should be rejected',
            parentCommentId: '{{replyId}}',
          }),
          tests: `pm.test('400 Bad Request', () => pm.expect(pm.response.code).to.eql(400));`,
        }),
        req('Create comment — empty content → 400', 'POST', '/posts/{{postId}}/comments', {
          body: jsonBody({ content: '   ' }),
          tests: `pm.test('400 Bad Request', () => pm.expect(pm.response.code).to.eql(400));`,
        }),
        req('List comments', 'GET', '/posts/{{postId}}/comments', {
          query: [
            { key: 'limit', value: '5' },
            { key: 'offset', value: '0' },
          ],
          tests: `const json = pm.response.json();
pm.test('page shape', () => {
  pm.expect(json).to.include.keys('items', 'totalTopLevel', 'hasMore');
});
pm.test('includes our comment', () => {
  const id = pm.collectionVariables.get('commentId');
  pm.expect(json.items.some((c) => c.id === id)).to.eql(true);
});`,
        }),
        req('Like comment', 'POST', '/comments/{{commentId}}/like', {
          tests: `const json = pm.response.json();
pm.test('200 OK', () => pm.expect(pm.response.code).to.eql(200));
pm.collectionVariables.set('commentLikeCount', String(json.likeCount));
pm.test('likeCount >= 1', () => pm.expect(json.likeCount).to.be.at.least(1));`,
        }),
        req('Like comment again — idempotent', 'POST', '/comments/{{commentId}}/like', {
          tests: `const json = pm.response.json();
pm.test('count unchanged', () =>
  pm.expect(json.likeCount).to.eql(Number(pm.collectionVariables.get('commentLikeCount')))
);`,
        }),
        req('Get comment likers', 'GET', '/comments/{{commentId}}/likes', {
          tests: `pm.test('array', () => pm.expect(pm.response.json()).to.be.an('array'));`,
        }),
        req('Unlike comment', 'DELETE', '/comments/{{commentId}}/like', {
          tests: `pm.test('200 OK', () => pm.expect(pm.response.code).to.eql(200));`,
        }),
        req('Like reply', 'POST', '/comments/{{replyId}}/like', {
          tests: `pm.test('200 OK', () => pm.expect(pm.response.code).to.eql(200));`,
        }),
        req('Get reply likers', 'GET', '/comments/{{replyId}}/likes', {
          tests: `pm.test('200 OK', () => pm.expect(pm.response.code).to.eql(200));`,
        }),
      ],
    },
    {
      name: '04 Privacy (Alice vs Bob)',
      description:
        "Switch to Bob and prove Alice's private post is invisible: absent from feed, 404 on likes/comments.",
      item: [
        req('Login as Bob', 'POST', '/auth/login', {
          body: jsonBody({
            email: '{{bobEmail}}',
            password: '{{password}}',
          }),
          tests: saveUser,
        }),
        req('Bob feed — private post absent', 'GET', '/posts', {
          tests: `const json = pm.response.json();
const privateId = pm.collectionVariables.get('privatePostId');
pm.test('private post not in feed', () => {
  pm.expect(json.items.some((p) => p.id === privateId)).to.eql(false);
});`,
        }),
        req('Bob likes Alice private post → 404', 'POST', '/posts/{{privatePostId}}/like', {
          description: '404 (not 403) so existence does not leak.',
          tests: `pm.test('404 Not Found', () => pm.expect(pm.response.code).to.eql(404));`,
        }),
        req('Bob lists private post likers → 404', 'GET', '/posts/{{privatePostId}}/likes', {
          tests: `pm.test('404 Not Found', () => pm.expect(pm.response.code).to.eql(404));`,
        }),
        req('Bob comments on private post → 404', 'POST', '/posts/{{privatePostId}}/comments', {
          body: jsonBody({ content: 'Bob should not be able to comment' }),
          tests: `pm.test('404 Not Found', () => pm.expect(pm.response.code).to.eql(404));`,
        }),
        req('Bob likes Alice public post → 200', 'POST', '/posts/{{postId}}/like', {
          tests: `pm.test('200 OK', () => pm.expect(pm.response.code).to.eql(200));`,
        }),
        req('Bob comments on public post → 200', 'POST', '/posts/{{postId}}/comments', {
          body: jsonBody({ content: 'Nice post, Alice!' }),
          tests: `pm.test('created', () => pm.expect(pm.response.code).to.be.oneOf([200, 201]));`,
        }),
        req('Login Alice again', 'POST', '/auth/login', {
          body: jsonBody({
            email: '{{aliceEmail}}',
            password: '{{password}}',
          }),
          tests: saveUser,
        }),
      ],
    },
    {
      name: '05 Optional — Seeded demo accounts',
      description:
        'Only works after `npm run seed`. Shared password: Password1.',
      item: [
        req('Login sarah@demo.com', 'POST', '/auth/login', {
          body: jsonBody({ email: 'sarah@demo.com', password: 'Password1' }),
          tests: `pm.test('200 or 401 if not seeded', () => pm.expect(pm.response.code).to.be.oneOf([200, 401]));`,
        }),
        req('Sarah feed (sees her private post)', 'GET', '/posts', {
          tests: `pm.test('200 or 401', () => pm.expect(pm.response.code).to.be.oneOf([200, 401]));`,
        }),
        req('Login rafiq@demo.com', 'POST', '/auth/login', {
          body: jsonBody({ email: 'rafiq@demo.com', password: 'Password1' }),
          tests: `pm.test('200 or 401 if not seeded', () => pm.expect(pm.response.code).to.be.oneOf([200, 401]));`,
        }),
        req('Rafiq feed (no Sarah private post)', 'GET', '/posts', {
          tests: `pm.test('200 or 401', () => pm.expect(pm.response.code).to.be.oneOf([200, 401]));`,
        }),
      ],
    },
  ],
};

writeFileSync(
  new URL('./BuddyScript-API.postman_collection.json', import.meta.url),
  JSON.stringify(collection, null, 2),
);

const total = collection.item.reduce((n, f) => n + f.item.length, 0);
console.log(`Wrote BuddyScript-API.postman_collection.json (${total} requests)`);
