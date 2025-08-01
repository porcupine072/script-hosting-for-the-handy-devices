import { makeApp } from "../../app";
import { makeStore } from "./makeStore";
import type { RuntimeEnv } from "../../app";

export type CloudflareEnv = RuntimeEnv & {
    UPSTASH_REDIS_REST_URL: string;
    UPSTASH_REDIS_REST_TOKEN: string;
};

const app = makeApp<CloudflareEnv>(
    c => makeStore(c.env),
    c => c.env
);

export default app;