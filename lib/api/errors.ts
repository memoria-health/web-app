export class APIError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    public readonly path: string,
  ) {
    super(`[${status}] ${path}: ${body.slice(0, 200)}`);
    this.name = 'APIError';
  }
}

export function isAPIError(e: unknown): e is APIError {
  return e instanceof APIError;
}
