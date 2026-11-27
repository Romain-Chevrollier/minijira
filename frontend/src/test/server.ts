import { vi } from 'vitest'

import type { Project } from '../api/projects'
import type { Ticket, TicketCreatePayload, TicketUpdate } from '../api/tickets'
import { PROJECTS } from './fixtures'
import { jsonResponse } from './render'

/**
 * Faux serveur pour les tests : remplace fetch et garde projets et tickets en mémoire.
 * Répond comme l'API, avec les mêmes refus, à GET/POST /api/projects,
 * PATCH/DELETE /api/projects/:id, GET/POST /api/tickets et GET/PATCH/DELETE
 * /api/tickets/:id.
 */
export function mockServer(initialTickets: Ticket[] = [], initialProjects: Project[] = PROJECTS) {
  let tickets = initialTickets.map((ticket) => ({ ...ticket }))
  let projects = initialProjects.map((project) => ({ ...project }))

  /** Projets avec leur nombre de tickets du moment, comme GET /api/projects. */
  const projectsWithCounts = () =>
    projects.map((project) => ({
      ...project,
      ticket_count: tickets.filter((t) => t.project.id === project.id).length,
    }))

  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input)
    const method = init?.method ?? 'GET'

    if (url === '/api/projects') {
      if (method === 'POST') {
        const { name, key } = JSON.parse(String(init?.body)) as { name: string; key: string }
        if (projects.some((p) => p.key === key)) {
          return jsonResponse(
            { detail: `La clé ${key} est déjà utilisée par un autre projet` },
            409,
          )
        }
        const project: Project = {
          id: Math.max(0, ...projects.map((p) => p.id)) + 1,
          name,
          key,
          created_at: '2026-11-20T12:00:00Z',
          ticket_count: 0,
        }
        projects = [...projects, project]
        return jsonResponse(project, 201)
      }
      return jsonResponse(projectsWithCounts())
    }

    const projectMatch = /^\/api\/projects\/(\d+)$/.exec(url)
    if (projectMatch) {
      const project = projectsWithCounts().find((p) => p.id === Number(projectMatch[1]))
      if (!project) {
        return jsonResponse({ detail: 'Projet introuvable' }, 404)
      }
      if (method === 'DELETE') {
        if (project.ticket_count > 0) {
          return jsonResponse(
            { detail: `Le projet ${project.key} contient ${project.ticket_count} tickets` },
            409,
          )
        }
        if (projects.length === 1) {
          return jsonResponse({ detail: 'Impossible de supprimer le dernier projet' }, 409)
        }
        projects = projects.filter((p) => p.id !== project.id)
        return new Response(null, { status: 204 })
      }
      // PATCH : seul le nom change, y compris dans les tickets du projet
      const { name } = JSON.parse(String(init?.body)) as { name: string }
      projects = projects.map((p) => (p.id === project.id ? { ...p, name } : p))
      tickets = tickets.map((t) =>
        t.project.id === project.id ? { ...t, project: { ...t.project, name } } : t,
      )
      return jsonResponse({ ...project, name })
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
