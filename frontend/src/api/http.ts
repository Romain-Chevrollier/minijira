/** Erreur renvoyée quand l'API répond avec un code d'échec (4xx, 5xx). */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** Lit la réponse JSON, ou lève une ApiError si l'API a répondu par un échec. */
export async function readJson<T>(response: Response, action: string): Promise<T> {
  if (!response.ok) {
    throw new ApiError(response.status, `Erreur ${response.status} ${action}`)
  }
  return (await response.json()) as T
}
