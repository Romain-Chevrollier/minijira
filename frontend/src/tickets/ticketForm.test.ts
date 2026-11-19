import { describe, expect, it } from 'vitest'

import { EMPTY_TICKET_FORM, toTicketCreate, validateTicketForm } from './ticketForm'

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
