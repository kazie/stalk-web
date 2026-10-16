# Deployment

The app is maintained as two branches that are built and deployed separately:

| Branch   | App                                    | Example host      |
| -------- | -------------------------------------- | ----------------- |
| `master` | Current app (WebGL map)                | `example.com`     |
| `legacy` | Classic app (Leaflet, maintenance only) | `old.example.com` |

Both are static builds that talk to the same backend. Replace `example.com`, `old.example.com`, the
folders and the backend address below with your own.

Nothing here is automated; it is a checklist for whoever runs the server.

## 1. Build

Each branch is built on its own checkout, with its own dependencies.

```bash
# Current app
git switch master
pnpm install --frozen-lockfile
VITE_API_ENDPOINT=/api/coords \
VITE_FALLBACK_URL=https://old.example.com \
pnpm build

# Classic app
git switch legacy
pnpm install --frozen-lockfile
VITE_API_ENDPOINT=/api/coords \
VITE_MODERN_URL=https://example.com \
pnpm build
```

| Variable            | Branch   | Purpose                                                              |
| ------------------- | -------- | -------------------------------------------------------------------- |
| `VITE_API_ENDPOINT` | both     | Coordinates endpoint, same-origin so nginx can proxy it.             |
| `VITE_FALLBACK_URL` | `master` | Optional. Offered to browsers without WebGL. Omit to show only a notice. |
| `VITE_MODERN_URL`   | `legacy` | Optional. Shows a "New version" link in the toolbar.                 |

Variables are baked in at build time, so rebuild after changing them.

## 2. Copy the builds

Copy each `dist/` to its own folder, for example:

```bash
rsync -a --delete dist/ server:/var/www/stalk/       # from master
rsync -a --delete dist/ server:/var/www/stalk-old/   # from legacy
```

## 3. DNS and certificates

- Point both hostnames at the server.
- Get a certificate that covers both, for example `certbot --nginx -d example.com -d old.example.com`
  (add `--expand` when extending an existing certificate).

## 4. nginx

Shared backend proxying, for example `/etc/nginx/snippets/stalk-api.conf`:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /ws/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 1h;
}

# Hashed build assets never change; index.html must always be revalidated.
location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

location / {
    try_files $uri $uri/ /index.html;
    add_header Cache-Control "no-cache";
}
```

One server block per app:

```nginx
server {
    listen 443 ssl;
    server_name example.com;
    root /var/www/stalk;
    include snippets/stalk-api.conf;
    # ssl_certificate ... (managed by certbot)
}

server {
    listen 443 ssl;
    server_name old.example.com;
    root /var/www/stalk-old;
    include snippets/stalk-api.conf;
    # ssl_certificate ... (managed by certbot)
}
```

`try_files ... /index.html` makes deep links such as `/someone` work on reload.

If the backend checks the `Origin` header or CORS, allow both hostnames.

Test and reload: `nginx -t && systemctl reload nginx`.

## 5. Smoke test

- [ ] Both hosts load and show the map.
- [ ] Reloading a deep link (`/<name>`) works on both.
- [ ] Live mode connects (WebSocket `/ws/...` in the browser network tab) on both.
- [ ] With WebGL disabled (Firefox: `about:config` → `webgl.disabled = true`), the current app shows
      the notice and the link to the classic version.
- [ ] The classic app's "New version" link points to the current app.
