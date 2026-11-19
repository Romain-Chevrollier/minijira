import { describe, expect, it } from 'vitest'

import type { Ticket } from '../api/tickets'
import {
  EMPTY_TICKET_FORM,
  ticketToEditValues,
  toTicketCreate,
  toTicketUpdate,
  validateTicketForm,
} from './ticketForm'

const ticket: Ticket = {
  id: 3,
  title: 'Préparer la démo',
  description: null,
  priority: 'medium',
  assignee: 'Élodie',
  status: 'todo',
  created_at: '2026-11-18T12:00:00Z',
}

describe('ticketToEditValues', () => {
  it('pré-remplit le formulaire, les champs vides devenant des textes vides', () => {
    expect(ticketToEditValues(ticket)).toEqual({
      title: 'Préparer la démo',
      description: '',
      priority: 'medium',
      assignee: 'Élodie',
      status: 'todo',
    })
  })
})

describe('toTicketUpdate', () => {
  it('ne renvoie rien si aucun champ ne change', () => {
    expect(toTicketUpdate(ticket, ticketToEditValues(ticket))).toEqual({})
  })

  it('ignore les espaces ajoutés autour du texte', () => {
    const values = { ...ticketToEditValues(ticket), title: '  Préparer la démo  ' }
    expect(toTicketUpdate(ticket, values)).toEqual({})
  })

  it('ne renvoie que les champs modifiés, nettoyés', () => {
    const values = {
      ...ticketToEditValues(ticket),
      title: ' Démo prête ',
      description: 'Avec des slides',
      assignee: '   ',
      status: 'done' as const,
    }
    expect(toTicketUpdate(ticket, values)).toEqual({
      title: 'Démo prête',
      description: 'Avec des slides',
      assignee: null,
      status: 'done',
    })
  })
})

describe('validateTicketForm', () => {
  it('accepte un formulaire avec un titre', () => {
    expect(validateTicketForm({ ...EMPTY_TICKET_FORM, title: 'Un titre' })).toEqual({})
  })

  it.each(['', '   '])('refuse un titre vide ou fait d’espaces (%j)', (title) => {
    expect(validateTicketForm({ ...EMPTY_TICKET_FORM, title })).toEqual({
      title: 'Le titre est obligatoire.',
    })
  })

  it('refuse un titre de plus de 200 caractères', () => {
    const errors = validateTicketForm({ ...EMPTY_TICKET_FORM, title: 'a'.repeat(201) })
    expect(errors.title).toBe('Le titre ne doit pas dépasser 200 caractères.')
  })

  it('accepte un titre de 200 caractères, espaces autour non comptés', () => {
    const title = `  ${'a'.repeat(200)}  `
    expect(validateTicketForm({ ...EMPTY_TICKET_FORM, title })).toEqual({})
  })

  it('refuse un assigné de plus de 100 caractères', () => {
    const errors = validateTicketForm({
      ...EMPTY_TICKET_FORM,
      title: 'Un titre',
      assignee: 'a'.repeat(101),
    })
    expect(errors.assignee).toBe("L'assigné ne doit pas dépasser 100 caractères.")
  })
})

describe('toTicketCreate', () => {
  it('retire les espaces autour des textes', () => {
    expect(
      toTicketCreate({
        title: '  Préparer la démo  ',
        description: '  Avec des slides ',
        priority: 'high',
        assignee: ' Romain ',
      }),
    ).toEqual({
      title: 'Préparer la démo',
      description: 'Avec des slides',
      priority: 'high',
      assignee: 'Romain',
    })
  })

  it('envoie null pour les champs facultatifs vides', () => {
    expect(
      toTicketCreate({ ...EMPTY_TICKET_FORM, title: 'Un titre', description: '  ' }),
    ).toEqual({
      title: 'Un titre',
      description: null,
      priority: 'medium',
      assignee: null,
    })
  })
})
