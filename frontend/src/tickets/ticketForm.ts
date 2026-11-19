import type { TicketCreate, TicketPriority } from '../api/tickets'

// Mêmes limites que l'API (backend/app/schemas.py)
export const TITLE_MAX_LENGTH = 200
export const ASSIGNEE_MAX_LENGTH = 100

/** Valeurs saisies dans le formulaire, telles que tapées par l'utilisateur. */
export interface TicketFormValues {
  title: string
  description: string
  priority: TicketPriority
  assignee: string
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

/** Prépare les données pour l'API : espaces retirés, champ facultatif vide -> null. */
export function toTicketCreate(values: TicketFormValues): TicketCreate {
  return {
    title: values.title.trim(),
    description: values.description.trim() || null,
    priority: values.priority,
    assignee: values.assignee.trim() || null,
  }
}
