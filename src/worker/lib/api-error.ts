export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function apiErrorResponse(error: ApiError, requestId: string): Response {
  const headers = new Headers({ "cache-control": "no-store" });
  if (error.status === 429) {
    headers.set("retry-after", "60");
  }

  return Response.json(
    {
      error: {
        code: error.code,
        message: error.message,
        requestId,
      },
    },
    {
      status: error.status,
      headers,
    },
  );
}
