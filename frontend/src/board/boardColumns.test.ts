import { describe, expect, it } from 'vitest'

import type { Ticket } from '../api/tickets'
import { persoKey } from '../test/fixtures'
import { groupByStatus } from './boardColumns'

function makeTicket(overrides: Partial<Ticket> & Pick<Ticket, 'id'>): Ticket {
  return {
    ...persoKey(overrides.id),
    title: `Ticket ${overrides.id}`,
    description: null,
    priority: 'medium',
    assignee: null,
    status: 'todo',
    created_at: '2026-11-10T12:00:00Z',
    ...overrides,
  }
}

const ids = (tickets: Ticket[]) => tickets.map((ticket) => ticket.id)

describe('groupByStatus', () => {
  it('range chaque ticket dans la colonne de son statut', () => {
    const columns = groupByStatus([
      makeTicket({ id: 1, status: 'done' }),
      makeTicket({ id: 2, status: 'todo' }),
      makeTicket({ id: 3, status: 'in_progress' }),
      makeTicket({ id: 4, status: 'todo' }),
    ])

    expect(ids(columns.todo).sort()).toEqual([2, 4])
    expect(ids(columns.in_progress)).toEqual([3])
    expect(ids(columns.done)).toEqual([1])
  })

  it('renvoie trois colonnes vides quand il n’y a aucun ticket', () => {
    expect(groupByStatus([])).toEqual({ todo: [], in_progress: [], done: [] })
  })

  it('trie par priorité : Haute, puis Moyenne, puis Basse', () => {
    const columns = groupByStatus([
      makeTicket({ id: 1, priority: 'low' }),
      makeTicket({ id: 2, priority: 'high' }),
      makeTicket({ id: 3, priority: 'medium' }),
    ])

    expect(ids(columns.todo)).toEqual([2, 3, 1])
  })

  it('à priorité égale, du plus récent au plus ancien', () => {
    const columns = groupByStatus([
      makeTicket({ id: 1, priority: 'high', created_at: '2026-11-01T12:00:00Z' }),
      makeTicket({ id: 2, priority: 'high', created_at: '2026-11-15T12:00:00Z' }),
      makeTicket({ id: 3, priority: 'low', created_at: '2026-11-20T12:00:00Z' }),
      makeTicket({ id: 4, priority: 'high', created_at: '2026-11-08T12:00:00Z' }),
    ])

    expect(ids(columns.todo)).toEqual([2, 4, 1, 3])
  })

  it('à priorité et date égales, le numéro le plus grand d’abord', () => {
    const columns = groupByStatus([
      makeTicket({ id: 5 }),
      makeTicket({ id: 9 }),
      makeTicket({ id: 7 }),
    ])

    expect(ids(columns.todo)).toEqual([9, 7, 5])
  })

  it('ne modifie pas le tableau reçu', () => {
    const tickets = [makeTicket({ id: 1, priority: 'low' }), makeTicket({ id: 2, priority: 'high' })]

    groupByStatus(tickets)

    expect(ids(tickets)).toEqual([1, 2])
  })
})
