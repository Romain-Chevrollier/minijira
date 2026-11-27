import { onlineManager } from '@tanstack/react-query'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

import type { Ticket } from './api/tickets'
import { persoKey } from './test/fixtures'
import App from './App'
import { renderWithQueryClient } from './test/render'
import { mockServer } from './test/server'

const ticket: Ticket = {
  id: 1,
  ...persoKey(1),
  title: 'Mon ticket',
  description: null,
  priority: 'low',
  assignee: null,
  status: 'todo',
  created_at: '2026-11-02T12:00:00Z',
}

/** Le navigateur annonce qu'il a perdu la connexion (Wi-Fi coupé). */
function goOffline() {
  act(() => {
    window.dispatchEvent(new Event('offline'))
  })
}

/** L'API ne répond plus du tout (backend arrêté) : fetch échoue sans réponse. */
function stopBackend(server: ReturnType<typeof mockServer>) {
  server.fetchMock.mockImplementation(async () => {
    throw new TypeError('Failed to fetch')
  })
}

afterEach(() => {
  // L'état « en ligne » de TanStack Query est partagé : chaque test repart en ligne
  act(() => onlineManager.setOnline(true))
})

describe('Navigateur hors ligne : MiniJira parle quand même à l’API locale', () => {
  it('affiche les tickets', async () => {
    mockServer([ticket])
    renderWithQueryClient(<App />, { route: '/liste' })
    goOffline()

    // Ouvrir un ticket demande une nouvelle lecture à l'API
    await userEvent.click(await screen.findByRole('link', { name: ticket.title }))

    const dialog = await screen.findByRole('dialog', { name: ticket.title })
    expect(await within(dialog).findByRole('button', { name: 'Modifier' })).toBeInTheDocument()
  })

  it('enregistre une modification', async () => {
    const user = userEvent.setup()
    const server = mockServer([ticket])
    renderWithQueryClient(<App />, { route: '/liste/tickets/1' })
    const dialog = await screen.findByRole('dialog', { name: ticket.title })
    await user.click(await within(dialog).findByRole('button', { name: 'Modifier' }))
    await user.type(within(dialog).getByLabelText(/Titre/), ' modifié')
    goOffline()

    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    expect(await within(dialog).findByRole('heading', { name: 'Mon ticket modifié' })).toBeInTheDocument()
    expect(server.bodiesSent('PATCH')).toEqual([{ title: 'Mon ticket modifié' }])
  })

  it('backend arrêté : la liste affiche l’erreur habituelle', async () => {
    const server = mockServer([ticket])
    stopBackend(server)
    act(() => onlineManager.setOnline(false))

    renderWithQueryClient(<App />, { route: '/liste' })

    expect(await screen.findByText('Impossible de charger les tickets.')).toBeInTheDocument()
  })

  it('backend arrêté : l’enregistrement affiche l’erreur habituelle', async () => {
    const user = userEvent.setup()
    const server = mockServer([ticket])
    renderWithQueryClient(<App />, { route: '/liste/tickets/1' })
    const dialog = await screen.findByRole('dialog', { name: ticket.title })
    await user.click(await within(dialog).findByRole('button', { name: 'Modifier' }))
    await user.type(within(dialog).getByLabelText(/Titre/), ' modifié')
    goOffline()
    stopBackend(server)

    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      "Le ticket n'a pas pu être modifié.",
    )
    expect(within(dialog).getByRole('button', { name: 'Enregistrer' })).toBeEnabled()
  })
})
