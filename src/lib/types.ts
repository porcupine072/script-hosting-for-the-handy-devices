export type SuccessResponse = {
    success: true;
    hash: string;
    size: number;         // bytes of stored CSV
    expires_in: number;   // seconds until script expires
};

export type ErrorResponse = {
    success: false;
    error: { code: string };
};

export class StatusError extends Error {
    constructor(
        public status: 400 | 401 | 404 | 413 | 500,
        public code: ErrorCode
    ) { super(code); }
}

export function errorJson(err: StatusError): ErrorResponse {
    return { success: false, error: { code: err.code } };
}

export const ERROR_CODES = [
    "E_UNAUTHORIZED",   // secret key is missing from request
    "E_FILE_MISSING",   // multipart field 'file' required
    "E_TOO_LARGE",      // file exceeds `FILE_UPLOAD_MAX_BYTES` MiB limit
    "E_INVALID_JSON",   // file is not valid JSON
    "E_NO_ACTIONS",     // missing actions[] array
    "E_EMPTY_ACTIONS",  // actions[] is empty
    "E_BAD_ACTION",     // invalid at/pos values
    "E_BAD_HASH",       // hash must be 64-char hex
    "E_NOT_FOUND",      // script expired or never existed
    "E_INTERNAL",       // internal server error
] as const;

export type ErrorCode = typeof ERROR_CODES[number];