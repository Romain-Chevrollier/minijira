import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Ticket, TicketCreate } from './api/tickets'
import App from './App'
import { jsonResponse, renderWithQueryClient } from './test/render'

const fetchMock = vi.fn<typeof fetch>()

/** Faux serveur : garde les tickets en mémoire, répond à GET et POST /api/tickets. */
function mockServer(initialTickets: Ticket[] = []) {
  let tickets = [...initialTickets]
  fetchMock.mockImplementation(async (_url, init) => {
    if (init?.method === 'POST') {
      const payload = JSON.parse(String(init.body)) as TicketCreate
      const ticket: Ticket = {
        ...payload,
        id: tickets.length + 1,
        status: 'todo',
        created_at: '2026-11-19T12:00:00Z',
      }
      tickets = [ticket, ...tickets]
      return jsonResponse(ticket, 201)
    }
    return jsonResponse(tickets)
  })
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('affiche le titre MiniJira et la liste des tickets', async () => {
    mockServer()

    renderWithQueryClient(<App />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'MiniJira' }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText("Aucun ticket pour l'instant."),
    ).toBeInTheDocument()
  })

  it('crée un ticket : il apparaît en tête de liste, en « À faire », et le formulaire se ferme', async () => {
    const user = userEvent.setup()
    mockServer()
    renderWithQueryClient(<App />)
    await screen.findByText("Aucun ticket pour l'instant.")

    await user.click(screen.getByRole('button', { name: 'Nouveau ticket' }))
    const form = screen.getByRole('form', { name: 'Nouveau ticket' })
    await user.type(within(form).getByLabelText(/Titre/), 'Préparer la démo')
    await user.click(within(form).getByRole('button', { name: 'Créer' }))

    const table = await screen.findByRole('table', { name: 'Tickets' })
    const [, firstRow] = within(table).getAllByRole('row')
    expect(within(firstRow).getByText('Préparer la démo')).toBeInTheDocument()
    expect(within(firstRow).getByText('À faire')).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Nouveau ticket' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nouveau ticket' })).toBeInTheDocument()
  })

  it('Annuler referme le formulaire', async () => {
    const user = userEvent.setup()
    mockServer()
    renderWithQueryClient(<App />)

    await user.click(screen.getByRole('button', { name: 'Nouveau ticket' }))
    await user.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(screen.queryByRole('form', { name: 'Nouveau ticket' })).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith('/api/tickets', expect.objectContaining({ method: 'POST' }))
  })
})
