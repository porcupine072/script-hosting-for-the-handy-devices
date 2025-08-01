// Computes a deterministic SHA-256 hash for a string.
// Expected use-case is passing in a CSV string.
export async function deriveHash(inputString: string): Promise<string> {
    const bytes = new TextEncoder().encode(inputString);
    const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}