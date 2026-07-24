export type HealthPayload = {
  status: "ok";
  service: "rigstage";
  requestId: string;
};

export function healthResponse(requestId: string): Response {
  return Response.json(
    {
      status: "ok",
      service: "rigstage",
      requestId,
    } satisfies HealthPayload,
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
