/** Erreur renvoyée quand l'API répond avec un code d'échec (4xx, 5xx). */
export class ApiError extends Error {
  readonly status: number
  /** Explication donnée par l'API, quand c'est une phrase (« La clé MAISON est déjà… »). */
  readonly detail: string | null

  constructor(status: number, message: string, detail: string | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

/** Lit le champ `detail` d'une réponse d'erreur, s'il contient une phrase. */
async function readDetail(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { detail?: unknown }
    // Les erreurs de validation (422) donnent une liste : seule une phrase est gardée
    return typeof body.detail === 'string' ? body.detail : null
  } catch {
    return null
  }
}

/** Lève une ApiError si l'API a répondu par un échec. */
export async function checkResponse(response: Response, action: string): Promise<void> {
  if (!response.ok) {
    throw new ApiError(
      response.status,
      `Erreur ${response.status} ${action}`,
      await readDetail(response),
    )
  }
}

/** Lit la réponse JSON, ou lève une ApiError si l'API a répondu par un échec. */
export async function readJson<T>(response: Response, action: string): Promise<T> {
  await checkResponse(response, action)
  return (await response.json()) as T
}
