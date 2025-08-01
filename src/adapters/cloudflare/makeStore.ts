import { Redis } from "@upstash/redis/cloudflare";
import type { ScriptStore } from "../../lib";
import type { CloudflareEnv } from "./worker-cf";

export function makeStore(env: CloudflareEnv): ScriptStore {
    const redis = Redis.fromEnv(
        {...env, UPSTASH_DISABLE_TELEMETRY: '1'}
    );

    return {
        async get(hash: string): Promise<{ csv: string | null, expiresIn: number }> {
            const [csv, ttl] = await Promise.all([
                redis.get<string>(hash),
                redis.ttl(hash)
            ]);
            // https://redis.io/docs/latest/commands/ttl/
            // Starting with Redis 2.8:
            // The command returns -2 if the key does not exist.
            // The command returns -1 if the key exists but has no associated expire.
            //
            // In Redis 2.6 or older the command returns -1 if the key does not exist or if the key exists but has no associated expire.
            //
            // For our use-case; even if expiresIn is a negative value that is okay.
            // We assume the client expects `expiresIn` to be a number, both negative or positive is fair game.
            return { csv, expiresIn: ttl };
        },
        async set(hash: string, csv: string, ttl: number): Promise<void> {
            await redis.set(hash, csv, { ex: ttl });
        }
    };
}