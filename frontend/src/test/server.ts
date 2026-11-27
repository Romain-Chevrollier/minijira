import { vi } from 'vitest'

import type { Project } from '../api/projects'
import type { Ticket, TicketCreatePayload, TicketUpdate } from '../api/tickets'
import { PROJECTS } from './fixtures'
import { jsonResponse } from './render'

/**
 * Faux serveur pour les tests : remplace fetch et garde les tickets en mémoire.
 * Répond à GET /api/projects, GET/POST /api/tickets et GET/PATCH/DELETE
 * /api/tickets/:id, comme l'API.
 */
export function mockServer(initialTickets: Ticket[] = [], projects: Project[] = PROJECTS) {
  let tickets = initialTickets.map((ticket) => ({ ...ticket }))

  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input)
    const method = init?.method ?? 'GET'

    if (url === '/api/projects') {
      return jsonResponse(projects)
    }

    if (url === '/api/tickets') {
      if (method === 'POST') {
        const { project_id, ...payload } = JSON.parse(String(init?.body)) as TicketCreatePayload
        const project = projects.find((p) => p.id === project_id)
        if (!project) {
          return jsonResponse({ detail: `Le projet ${project_id} n'existe pas` }, 422)
        }
        const number = tickets.filter((t) => t.project.id === project.id).length + 1
        const ticket: Ticket = {
          ...payload,
          id: Math.max(0, ...tickets.map((t) => t.id)) + 1,
          number,
          key: `${project.key}-${number}`,
          project: { id: project.id, key: project.key, name: project.name },
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
    if (method === 'DELETE') {
      tickets = tickets.filter((t) => t.id !== ticket.id)
      return new Response(null, { status: 204 })
    }
    if (method === 'PATCH') {
      Object.assign(ticket, JSON.parse(String(init?.body)) as TicketUpdate)
    }
    return jsonResponse(ticket)
  })

  vi.stubGlobal('fetch', fetchMock)

  return {
    fetchMock,
    /** Adresses appelées avec cette méthode (DELETE...). */
    urlsCalled: (wanted: string) =>
      fetchMock.mock.calls
        .filter(([, init]) => (init?.method ?? 'GET') === wanted)
        .map(([input]) => String(input)),
    /** Corps JSON des requêtes envoyées avec cette méthode (POST, PATCH...). */
    bodiesSent: (wanted: string) =>
      fetchMock.mock.calls
        .filter(([, init]) => init?.method === wanted)
        .map(([, init]) => JSON.parse(String(init?.body)) as unknown),
  }
}
