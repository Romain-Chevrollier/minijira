import type {
  Ticket,
  TicketCreate,
  TicketPriority,
  TicketStatus,
  TicketUpdate,
} from '../api/tickets'

// Mêmes limites que l'API (backend/app/schemas.py)
export const TITLE_MAX_LENGTH = 200
export const ASSIGNEE_MAX_LENGTH = 100

/** Valeurs saisies dans le formulaire de création, telles que tapées par l'utilisateur. */
export interface TicketFormValues {
  title: string
  description: string
  priority: TicketPriority
  assignee: string
}

/** Valeurs du formulaire de modification : les mêmes, plus le statut. */
export interface TicketEditValues extends TicketFormValues {
  status: TicketStatus
}

export type TicketFormErrors = Partial<Record<'title' | 'assignee', string>>

export const EMPTY_TICKET_FORM: TicketFormValues = {
  title: '',
  description: '',
  priority: 'medium',
  assignee: '',
}

/** Vérifie la saisie avec les mêmes règles que l'API. Renvoie {} si tout est bon. */
export function validateTicketForm(values: TicketFormValues): TicketFormErrors {
  const errors: TicketFormErrors = {}
  const title = values.title.trim()
  const assignee = values.assignee.trim()

  if (title === '') {
    errors.title = 'Le titre est obligatoire.'
  } else if (title.length > TITLE_MAX_LENGTH) {
    errors.title = `Le titre ne doit pas dépasser ${TITLE_MAX_LENGTH} caractères.`
  }
  if (assignee.length > ASSIGNEE_MAX_LENGTH) {
    errors.assignee = `L'assigné ne doit pas dépasser ${ASSIGNEE_MAX_LENGTH} caractères.`
  }
  return errors
}

export function hasErrors(errors: TicketFormErrors): boolean {
  return Object.values(errors).some(Boolean)
}

/** Prépare les données pour l'API : espaces retirés, champ facultatif vide -> null. */
export function toTicketCreate(values: TicketFormValues): TicketCreate {
  return {
    title: values.title.trim(),
    description: values.description.trim() || null,
    priority: values.priority,
    assignee: values.assignee.trim() || null,
  }
}

/** Pré-remplit le formulaire de modification avec un ticket existant. */
export function ticketToEditValues(ticket: Ticket): TicketEditValues {
  return {
    title: ticket.title,
    description: ticket.description ?? '',
    priority: ticket.priority,
    assignee: ticket.assignee ?? '',
    status: ticket.status,
  }
}

/** Ne garde que les champs réellement modifiés, nettoyés comme à la création. */
export function toTicketUpdate(ticket: Ticket, values: TicketEditValues): TicketUpdate {
  const next = { ...toTicketCreate(values), status: values.status }
  const changes: TicketUpdate = {}

  if (next.title !== ticket.title) changes.title = next.title
  if (next.description !== ticket.description) changes.description = next.description
  if (next.priority !== ticket.priority) changes.priority = next.priority
  if (next.assignee !== ticket.assignee) changes.assignee = next.assignee
  if (next.status !== ticket.status) changes.status = next.status
  return changes
}
