export interface ScriptStore {
    get(hash: string): Promise<{ csv: string | null, expiresIn: number }>;
    set(hash: string, csv: string, ttlSeconds: number): Promise<void>;
}