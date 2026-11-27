import { ApiError, readJson } from './http'
import type { ProjectSummary } from './projects'

// Importé depuis ce fichier par le reste de l'application
export { ApiError }

// Types alignés sur les schémas du backend (backend/app/schemas.py)
export type TicketStatus = 'todo' | 'in_progress' | 'done'
export type TicketPriority = 'low' | 'medium' | 'high'

/** Ticket renvoyé par l'API (TicketRead). */
export interface Ticket {
  /** Identifiant interne, utilisé dans les adresses (/tickets/12). */
  id: number
  /** Numéro dans le projet et clé lisible : 12 et PERSO-12. */
  number: number
  key: string
  project: ProjectSummary
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

/** Création : les champs communs, plus le projet (422 s'il n'existe plus). */
export interface TicketCreatePayload extends TicketCreate {
  project_id: number
}

/** Champs à modifier (TicketUpdate) : seuls les champs présents sont changés. */
export type TicketUpdate = Partial<TicketCreate & { status: TicketStatus }>

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
export async function createTicket(payload: TicketCreatePayload): Promise<Ticket> {
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
