# Script Hosting For The Handy Devices

Disclaimer: **This is an open-source project and is not affiliated with, endorsed by, or supported by Sweet Tech AS or The Handy.**

This project exists for storing and serving scripts to The Handy devices.

It was created to support the [FunPlayer app](https://funplayer.app) instead of relying on a third-party host with unknown uptime and reliability.

Designed for serverless environments, using [Hono](https://hono.dev/) as the web framework and currently has a [Cloudflare Workers](https://developers.cloudflare.com/workers/) + [Upstash Redis](https://upstash.com/) adapter.

It should be trivial to create adapters for any major provider. See [ARCHITECTURE.MD](ARCHITECTURE.md) file for a birds-eye overview.

---

## How does it work?

- Upload a script file (`.json`/`.funscript`) and receive a unique, temporary URL.
- The URL can be given to a Handy device for direct download when using the [HSSP](https://www.handyfeeling.com/api/handy/v2/docs/#/HSSP/setup) (Handy Script Sync Protocol) endpoint.
- Scripts are returned as CSV as required by the device.
- SHA-256 hash derived from the script's actions is also returned. The Handy device can skip download if SHA256 hash is supplied and it matches with the device (for FW3).

> **Note:** The Handy device (FW3) can only process scripts up to **524,288 bytes** (512 KiB) in CSV format. Keep in mind that larger uploads to the device will return an error.

---

## API

### `POST /scripts`

Requests must include the header: `X-API-SECRET: <your-secret>`

`multipart/form-data` with a `file` field (`.json` / `.funscript`).

**Response (201):**
```json
{
  "success": true,
  "hash": "0706052782b4d179...3420a",
  "size": 1234,
  "expires_in": 18000
}
```

### `GET /scripts/:hash`

Returns the CSV or 404 if missing/expired.

#### Headers:

```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="<hash>.csv"
```

--

#### Error Codes

Every error returns:

```{ "success": false, "error": { "code": "E_..." } }```

Codes:
E_UNAUTHORIZED, E_FILE_MISSING, E_TOO_LARGE, E_INVALID_JSON, E_NO_ACTIONS, E_EMPTY_ACTIONS, E_BAD_ACTION, E_BAD_HASH, E_NOT_FOUND, E_INTERNAL  
See: `types.ts` file as the source-of-truth in-case this README was not updated.

---

## Example: Handy Device Setup

When configuring your Handy device for HSSP, provide the download URL from above as the script source, e.g.:
```json
{
  "url": "https://your-domain/scripts/0706052782b4d179....3420a"
}
```

- See [Handy HSSP Setup](https://www.handyfeeling.com/api/handy/v2/docs/#/HSSP/setup) for device-side details.
- If the device has the script (by hash), it skips download.

---
# Deploying on Cloudflare Workers + Upstash Redis

---

## 1. Clone & install

    git clone <this-repo-url>
    cd <the cloned directory>
    npm install
    wrangler types <-- required, worker types not commited into git

---

## 2. Local dev environment variables

> Optional: Only if you want to test locally. Skip to step 3 for production deployment.
> 
> ! BE CAREFUL: Do not commit .dev.vars It is purely for storing secrets in development.

Create `.dev.vars` (copy from `.dev.vars.example`) for developing locally:

    UPSTASH_REDIS_REST_URL="https://..."
    UPSTASH_REDIS_REST_TOKEN="..."
    API_SECRET="replace-me"

These should load when running `wrangler dev`. You may need to run `wrangler types`. Check `package.json` for relevant run scripts.

---

## 3. Production secrets

Use Wrangler secrets for a prod deploy (these are not stored in git):

    npx wrangler secret put API_SECRET
    npx wrangler secret put UPSTASH_REDIS_REST_URL
    npx wrangler secret put UPSTASH_REDIS_REST_TOKEN

---

## 4. Configure Wrangler

**wrangler.jsonc**:  

1. Create `.wrangler.jsonc` (copy from `.wrangler.jsonc.example`).
2. Adjust `SCRIPT_TTL_SECONDS` and `FILE_UPLOAD_MAX_BYTES` as needed.

---

## 5. Run locally
If you setup your dev environment (followed step 2) and followed step 4, you should be able to run locally.
```
    npx wrangler dev                      <-- starts local instance
    
    curl -H "X-API-SECRET: <API-SECRET-YOU-SET>" \
         -F "file=@sample.funscript" \
         http://localhost:8787/scripts    <--- send a sample request.
                                               here we are sending a real file called sample.funscript that exists in the current directory.
```

---

## 6. Deploy
```
npx wrangler deploy
```

---

## 7. Smoke test

Repeat the curl above with your production deployed URL and verify:

- POST `/scripts` returns 201 and the expected JSON.
- GET `/scripts/:hash` returns the CSV.
- Key expires after TTL (returns 404).

---

## 8. That's it!

> **Note:**  
> Setting up custom domains and routes is optional.  
> For full instructions, see [Cloudflare Workers: Custom Domains & Routing](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).  
> You should be instructed to make changes to your `wrangler.jsonc` file and any other places Cloudflare requests.
>
> If you do setup a custom domain route, "preview_urls" can be set to false. Your preference.

---

# Notes & Gotchas

- **Body limits:** We enforce `FILE_UPLOAD_MAX_BYTES` to make sure we don't accept insanely large files compared to what we expect for a funscript. Also, Cloudflare Workers [have a body size limit](https://developers.cloudflare.com/workers/platform/limits/#request-limits).
- **POST auth:** Current code requires `X-API-SECRET` on POST `/script` route. Retrieving a script has no auth, otherwise The Handy wouldn't be able to retrieve the script.
- **TTL behavior:** If the key already exists we reuse it and return its remaining TTL (may be negative if Redis reports an error—client should handle any number).
- **Hash determinism:** **A hash is derived from the `actions` array**. Changing any other metadata in the script won't matter. As long as actions array is the exact same, a consistent hash is expected. The `actions` array is converted into a CSV string with a `\n` trailing line break (see function `actionsToCsv` and `deriveHash`).
- **CORS:** If you upload from browsers across origins, feel free to add appropriate `Access-Control-Allow-*` headers.
- **Latency:** Pick what suites you; eg Workers global or regional and storage global or regional. Just keep in mind consistency between read and writes for the storage layer.

> **Consistency note**: At the time of writing this, we run Upstash Redis in a single region to reduce chances of stale reads. Multi-region can happen as long as Casual Consistency measure such as Read Your Writes is used or some retry policies in cases where you are sure the script should exist.

---

# Contributing

- PRs welcome.
- Please do not commit secrets or `.dev.vars`.

---

# License

See LICENSE.md.

---

**This is an open-source project and is not affiliated with, endorsed by, or supported by Sweet Tech AS or The Handy**
