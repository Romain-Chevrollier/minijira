import { fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Ticket } from '../api/tickets'
import { jsonResponse, renderWithQueryClient } from '../test/render'
import { TicketList } from './TicketList'

const tickets: Ticket[] = [
  {
    id: 2,
    title: 'Préparer la démo',
    description: null,
    priority: 'high',
    assignee: null,
    status: 'in_progress',
    created_at: '2026-11-18T12:00:00Z',
  },
  {
    id: 1,
    title: 'Installer le projet',
    description: 'Cloner et lancer',
    priority: 'low',
    assignee: 'Romain',
    status: 'done',
    created_at: '2026-11-02T12:00:00Z',
  },
]

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

describe('TicketList', () => {
  it("affiche les tickets dans l'ordre de l'API, avec des libellés lisibles", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(tickets))

    renderWithQueryClient(<TicketList />)

    const table = await screen.findByRole('table', { name: 'Tickets' })
    const [, firstRow, secondRow] = within(table).getAllByRole('row')

    expect(fetchMock).toHaveBeenCalledWith('/api/tickets')
    expect(within(firstRow).getByText('Préparer la démo')).toBeInTheDocument()
    expect(within(firstRow).getByText('En cours')).toBeInTheDocument()
    expect(within(firstRow).getByText('Haute')).toBeInTheDocument()
    expect(within(firstRow).getByText('18/11/2026')).toBeInTheDocument()
    expect(within(secondRow).getByText('Installer le projet')).toBeInTheDocument()
    expect(within(secondRow).getByText('Terminé')).toBeInTheDocument()
    expect(within(secondRow).getByText('Basse')).toBeInTheDocument()
    expect(within(secondRow).getByText('02/11/2026')).toBeInTheDocument()
  })

  it("indique qu'il n'y a aucun ticket quand la liste est vide", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]))

    renderWithQueryClient(<TicketList />)

    expect(
      await screen.findByText("Aucun ticket pour l'instant."),
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('affiche un indicateur pendant le chargement', () => {
    // Réponse qui n'arrive jamais : le composant reste en chargement
    fetchMock.mockReturnValueOnce(new Promise(() => {}))

    renderWithQueryClient(<TicketList />)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Chargement des tickets…',
    )
  })

  it("affiche une erreur si l'API ne répond pas, et Réessayer relance le chargement", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ detail: 'Erreur' }, 500))
      .mockResolvedValueOnce(jsonResponse(tickets))

    renderWithQueryClient(<TicketList />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Impossible de charger les tickets.')

    fireEvent.click(within(alert).getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByText('Préparer la démo')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
