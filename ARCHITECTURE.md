## Architecture

This project is **compartmentalized**. It separates core logic from provider-specific infrastructure.

It should be trivial to adapt to **different serverless platforms** and **storage backends** by writing lightweight adapters.

---

## Structure

      +-------------------------------+
      |   Core Logic                  |   <---  All business logic, request validation,
      |  (src/app/, src/lib/)         |          error handling, data transforms, etc.
      +---------+---------------------+
                |
                v
      +-------------------------------+
      |    Adapter Layer              |   <---  E.g. src/adapters/cloudflare/
      |  (makeStore.ts, worker-*.ts)  |         Binds core to specific serverless
      +---------+---------------------+         and storage implementations.
                |
                v
      +-------------------------------+
      |    Storage Backend            |   <---  E.g. Upstash Redis, or any other
      |  (Redis, DynamoDB, etc.)      |         persistent store.
      +-------------------------------+

---

## Key Folders

- **src/app/**  
  Contains all core API logic, request handling, and validation.

- **src/adapters/**  
  Contains environment-specific code (e.g., for Cloudflare Workers, Upstash Redis).

---

## Adding a New Provider

To support a new platform or storage, you only need to:
1. **Implement a new adapter** (following `makeStore` and `worker-xxx.ts` pattern).
2. **Reuse the core app logic** as-is.
3. **Tree Shaking**: there's no point deploying with eg `@upstash/redis` if using a different storage backend, this is an optimization that we haven't looked into at the time of writing this, but a good consideration to keep in mind.

----