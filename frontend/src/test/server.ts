import { vi } from 'vitest'

import type { Ticket, TicketCreate, TicketUpdate } from '../api/tickets'
import { jsonResponse } from './render'

/**
 * Faux serveur pour les tests : remplace fetch et garde les tickets en mémoire.
 * Répond à GET/POST /api/tickets et GET/PATCH /api/tickets/:id, comme l'API.
 */
export function mockServer(initialTickets: Ticket[] = []) {
  let tickets = initialTickets.map((ticket) => ({ ...ticket }))

  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input)
    const method = init?.method ?? 'GET'

    if (url === '/api/tickets') {
      if (method === 'POST') {
        const payload = JSON.parse(String(init?.body)) as TicketCreate
        const ticket: Ticket = {
          ...payload,
          id: Math.max(0, ...tickets.map((t) => t.id)) + 1,
          status: 'todo',
          created_at: '2026-11-19T12:00:00Z',
        }
        tickets = [ticket, ...tickets]
        return jsonResponse(ticket, 201)
      }
      return jsonResponse(tickets)
    }

    const match = /^\/api\/tickets\/(\d+)$/.exec(url)
    const ticket = match && tickets.find((t) => t.id === Number(match[1]))
    if (!ticket) {
      return jsonResponse({ detail: 'Ticket introuvable' }, 404)
    }
    if (method === 'PATCH') {
      Object.assign(ticket, JSON.parse(String(init?.body)) as TicketUpdate)
    }
    return jsonResponse(ticket)
  })

  vi.stubGlobal('fetch', fetchMock)

  return {
    fetchMock,
    /** Corps JSON des requêtes envoyées avec cette méthode (POST, PATCH...). */
    bodiesSent: (wanted: string) =>
      fetchMock.mock.calls
        .filter(([, init]) => init?.method === wanted)
        .map(([, init]) => JSON.parse(String(init?.body)) as unknown),
  }
}
