import { Context, Hono, MiddlewareHandler } from "hono";
import { RuntimeEnv } from "./runtimeEnv";
import { actionsToCsv, deriveHash, errorJson, StatusError } from "../lib";
import type { Action, ScriptStore, SuccessResponse } from "../lib";

export function makeApp<E extends RuntimeEnv>(
    getStore: (c: Context<{ Bindings: E }>) => ScriptStore,
    getEnv:   (c: Context<{ Bindings: E }>) => E
) {
    const app = new Hono<{ Bindings: E; }>();

    // Light-weight API secret: helps block generic bots. For POST /scripts only. Retrieval must be open for The Handy device to retrieve.
    const requireSecret: MiddlewareHandler = async (c, next) => {
        const gotSecret = c.req.header('X-API-SECRET');
        const expectedSecret = getEnv(c).API_SECRET;
        if (!gotSecret || gotSecret !== expectedSecret) throw new StatusError(401, 'E_UNAUTHORIZED');
        await next();
    };

    // POST /scripts (for uploading a script)
    app.post('/scripts', requireSecret) // register middleware on this route
    app.post("/scripts", async context => {
        const store = getStore(context);
        const form: FormData = await context.req.formData();
        const file: File | string | null = form.get("file");

        // start file validation

        if (!(file instanceof File))
            throw new StatusError(400, "E_FILE_MISSING");

        const { SCRIPT_TTL_SECONDS, FILE_UPLOAD_MAX_BYTES } = getEnv(context);

        if (file.size > Number(FILE_UPLOAD_MAX_BYTES))
            throw new StatusError(413, "E_TOO_LARGE");

        let json: unknown;
        try { json = JSON.parse(await file.text()); }
        catch { throw new StatusError(400, "E_INVALID_JSON"); }

        if (!json || typeof json !== "object" || !("actions" in json))
            throw new StatusError(400, "E_NO_ACTIONS");

        const actions = (json as { actions: Action[] }).actions;
        if (!Array.isArray(actions) || actions.length === 0)
            throw new StatusError(400, "E_EMPTY_ACTIONS");

        for (const action of actions) {
            if (typeof action.at !== "number" || typeof action.pos !== "number") {
                throw new StatusError(400, "E_BAD_ACTION");
            }
        }

        // end file validation

        let csv = actionsToCsv(actions);
        const hash = await deriveHash(csv);

        // @dev note: `expiresIn` may be a negative number, some stores such as Redis will return a negative for the TTL command if the key does not exist.
        // For our use-case, that's fine. Albeit, the consuming client should expect to handle a negative `expiresIn` value, no matter how unlikely.
        let { csv: storedCsv, expiresIn } = await store.get(hash)

        if (!storedCsv) {
            const ttl: number = Number(SCRIPT_TTL_SECONDS) || 18000; // 18000 == 5 h
            await store.set(hash, csv, ttl);
            storedCsv = csv
            expiresIn = ttl;
        }

        const res: SuccessResponse = {
            success: true,
            hash: hash,
            size: storedCsv.length, // csv characters we use are strictly ASCII: so it is ok to assume length === bytes. non-ASCII would change this assumption.
            expires_in: expiresIn,
        };
        return context.json(res, 201);
    });

    // GET /scripts/:hash (CSV download)
    app.get("/scripts/:hash", async context => {
        const store = getStore(context);

        const { hash } = context.req.param();
        if (!/^[0-9a-f]{64}$/.test(hash))
            throw new StatusError(400, "E_BAD_HASH");

        const { csv } = await store.get(hash);
        if (!csv)
            throw new StatusError(404, "E_NOT_FOUND");

        return context.newResponse(csv, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="${hash}.csv"`,
            },
        });
    });

    // Any other path --> Not found 404
    app.all('*', (c) => c.text('Not found', 404))

    // Global error handler
    app.onError((err, context) => {
        if (err instanceof StatusError) return context.json(errorJson(err), err.status);
        console.error("Unhandled error:", err);
        return context.json(errorJson(new StatusError(500, "E_INTERNAL")), 500);
    });

    return app;
}