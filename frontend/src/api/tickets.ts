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

/** Erreur renvoyée quand l'API répond avec un code d'échec (4xx, 5xx). */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** Liste des tickets, du plus récent au plus ancien (tri fait par l'API). */
export async function fetchTickets(): Promise<Ticket[]> {
  const response = await fetch('/api/tickets')
  if (!response.ok) {
    throw new ApiError(
      response.status,
      `Erreur ${response.status} au chargement des tickets`,
    )
  }
  return (await response.json()) as Ticket[]
}

/** Crée un ticket et renvoie le ticket enregistré. */
export async function createTicket(payload: TicketCreate): Promise<Ticket> {
  const response = await fetch('/api/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw new ApiError(
      response.status,
      `Erreur ${response.status} à la création du ticket`,
    )
  }
  return (await response.json()) as Ticket
}
