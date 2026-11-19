// Types alignés sur les schémas du backend (backend/app/schemas.py)
export type TicketStatus = 'todo' | 'in_progress' | 'done'
export type TicketPriority = 'low' | 'medium' | 'high'

/** Ticket renvoyé par l'API (TicketRead). */
export interface Ticket {
  id: number
  title: string
  description: string | null
  priority: TicketPriority
  assignee: string | null
  status: TicketStatus
  created_at: string
}

/** Données envoyées pour créer un ticket (TicketCreate). Le statut est fixé par le serveur. */
export interface TicketCreate {
  title: string
  description: string | null
  priority: TicketPriority
  assignee: string | null
}

/** Champs à modifier (TicketUpdate) : seuls les champs présents sont changés. */
export type TicketUpdate = Partial<TicketCreate & { status: TicketStatus }>

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
async function readJson<T>(response: Response, action: string): Promise<T> {
  if (!response.ok) {
    throw new ApiError(response.status, `Erreur ${response.status} ${action}`)
  }
  return (await response.json()) as T
}

/** Liste des tickets, du plus récent au plus ancien (tri fait par l'API). */
export async function fetchTickets(): Promise<Ticket[]> {
  const response = await fetch('/api/tickets')
  return readJson<Ticket[]>(response, 'au chargement des tickets')
}

/** Un ticket par son identifiant. ApiError 404 s'il n'existe pas. */
export async function fetchTicket(id: number): Promise<Ticket> {
  const response = await fetch(`/api/tickets/${id}`)
  return readJson<Ticket>(response, 'au chargement du ticket')
}

/** Crée un ticket et renvoie le ticket enregistré. */
export async function createTicket(payload: TicketCreate): Promise<Ticket> {
  const response = await fetch('/api/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return readJson<Ticket>(response, 'à la création du ticket')
}

/** Modifie les champs envoyés d'un ticket et renvoie le ticket à jour. */
export async function updateTicket(
  id: number,
  changes: TicketUpdate,
): Promise<Ticket> {
  const response = await fetch(`/api/tickets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  })
  return readJson<Ticket>(response, 'à la modification du ticket')
}

/** Supprime définitivement un ticket. L'API ne renvoie aucun contenu (204). */
export async function deleteTicket(id: number): Promise<void> {
  const response = await fetch(`/api/tickets/${id}`, { method: 'DELETE' })
  if (!response.ok) {
    throw new ApiError(response.status, `Erreur ${response.status} à la suppression du ticket`)
  }
}
