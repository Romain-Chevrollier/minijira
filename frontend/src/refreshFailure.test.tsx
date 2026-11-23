import { focusManager } from '@tanstack/react-query'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useNavigate } from 'react-router'
import type { NavigateFunction } from 'react-router'
import { describe, expect, it } from 'vitest'

import type { Ticket } from './api/tickets'
import App from './App'
import { jsonResponse, renderWithQueryClient } from './test/render'
import { mockServer } from './test/server'

const ticket: Ticket = {
  id: 1,
  title: 'Mon ticket',
  description: null,
  priority: 'low',
  assignee: null,
  status: 'todo',
  created_at: '2026-11-02T12:00:00Z',
}
const otherTicket: Ticket = { ...ticket, id: 2, title: 'Autre ticket' }

const STALE = 'Données peut-être pas à jour.'
const DELETED = "Ce ticket n'existe plus. Copie ton texte avant de fermer."

const badGateway = async () => jsonResponse({}, 502)
const notFound = async () => jsonResponse({}, 404)
const networkError = async (): Promise<Response> => {
  throw new TypeError('Failed to fetch')
}
const serverFailures = [
  ['erreur réseau', networkError],
  ['erreur 500', async () => jsonResponse({}, 500)],
  ['erreur 502', badGateway],
] as const

type Server = ReturnType<typeof mockServer>

/** Fait échouer les lectures (GET) ; la fonction renvoyée rétablit le serveur. */
function failReads(server: Server, respond: () => Promise<Response>) {
  const original = server.fetchMock.getMockImplementation()!
  server.fetchMock.mockImplementation((input, init) =>
    (init?.method ?? 'GET') === 'GET' ? respond() : original(input, init),
  )
  return () => {
    server.fetchMock.mockImplementation(original)
  }
}

/** Laisse les requêtes en cours se terminer et l'écran se mettre à jour. */
function settle() {
  return act(() => new Promise<void>((resolve) => setTimeout(resolve, 50)))
}

/** Revenir sur l'onglet du navigateur déclenche un rechargement. */
async function refocus() {
  act(() => {
    focusManager.setFocused(false)
    focusManager.setFocused(true)
  })
  await settle()
}

function setup(route: string, tickets: Ticket[] = [ticket, otherTicket]) {
  const user = userEvent.setup()
  const server = mockServer(tickets)
  renderWithQueryClient(<App />, { route })
  return { user, server }
}

async function openTicket() {
  const { user, server } = setup('/liste/tickets/1')
  const dialog = await screen.findByRole('dialog', { name: ticket.title })
  await screen.findByRole('table', { hidden: true })
  return { user, server, dialog }
}

async function startEditing() {
  const context = await openTicket()
  const { user, dialog } = context
  await user.click(within(dialog).getByRole('button', { name: 'Modifier' }))
  await user.type(within(dialog).getByLabelText(/Titre/), ' modifié')
  return context
}

function typedText() {
  return screen.queryByDisplayValue('Mon ticket modifié')
}

describe('Rechargement en échec pendant une modification', () => {
  it.each(serverFailures)('%s : la saisie reste, avec le bandeau', async (_name, respond) => {
    const { server, dialog } = await startEditing()
    failReads(server, respond)

    await refocus()

    expect(typedText()).toBeInTheDocument()
    expect(within(dialog).getByText(STALE)).toBeInTheDocument()
  })

  it('404 : la saisie reste, et un message dit que le ticket n’existe plus', async () => {
    const { server, dialog } = await startEditing()
    failReads(server, notFound)

    await refocus()

    expect(typedText()).toBeInTheDocument()
    expect(within(dialog).getByRole('alert')).toHaveTextContent(DELETED)
    // Réessayer ne servirait à rien : pas de bandeau
    expect(within(dialog).queryByText(STALE)).not.toBeInTheDocument()
  })

  it('404 puis Annuler : « Ticket introuvable »', async () => {
    const { user, server, dialog } = await startEditing()
    failReads(server, notFound)
    await refocus()

    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }))

    expect(dialog).toHaveAccessibleName('Ticket introuvable')
  })

  it('un enregistrement réussi ne cache pas un rechargement encore en échec', async () => {
    const { user, server, dialog } = await startEditing()
    failReads(server, badGateway)

    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
    await settle()

    expect(dialog).toHaveAccessibleName('Mon ticket modifié')
    expect(within(dialog).getByText(STALE)).toBeInTheDocument()
  })
})

describe('Rechargement réussi pendant une modification', () => {
  it('garde la saisie et n’envoie que les champs changés par l’utilisateur', async () => {
    const { user, server, dialog } = await startEditing()
    // Un autre onglet termine le ticket pendant la saisie
    await fetch('/api/tickets/1', { method: 'PATCH', body: JSON.stringify({ status: 'done' }) })
    await refocus()
    expect(typedText()).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
    await settle()

    expect(server.bodiesSent('PATCH').at(-1)).toEqual({ title: 'Mon ticket modifié' })
    expect(within(dialog).getByText('Terminé')).toBeInTheDocument()
  })

  it('sans saisie, Enregistrer n’annule pas le changement fait ailleurs', async () => {
    const { user, server, dialog } = await openTicket()
    await user.click(within(dialog).getByRole('button', { name: 'Modifier' }))
    await fetch('/api/tickets/1', { method: 'PATCH', body: JSON.stringify({ status: 'done' }) })
    await refocus()

    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
    await settle()

    // Un seul PATCH : celui de l'autre onglet
    expect(server.bodiesSent('PATCH')).toEqual([{ status: 'done' }])
  })

  it('changer de ticket ne reporte pas la saisie sur un autre ticket', async () => {
    let navigate: NavigateFunction = () => {}
    function Navigator() {
      navigate = useNavigate()
      return null
    }
    const user = userEvent.setup()
    mockServer([ticket, otherTicket])
    renderWithQueryClient(
      <>
        <App />
        <Navigator />
      </>,
      { route: '/liste/tickets/2' },
    )
    // Le ticket 2 est déjà en cache quand on y revient
    await screen.findByRole('dialog', { name: otherTicket.title })
    await act(async () => navigate('/liste/tickets/1'))
    const dialog = await screen.findByRole('dialog', { name: ticket.title })
    await user.click(within(dialog).getByRole('button', { name: 'Modifier' }))
    await user.type(within(dialog).getByLabelText(/Titre/), ' modifié')

    await act(async () => navigate('/liste/tickets/2'))

    expect(typedText()).not.toBeInTheDocument()
    expect(dialog).toHaveAccessibleName(otherTicket.title)
  })
})

describe('Rechargement en échec en consultation', () => {
  it.each(serverFailures)('%s : la popup garde le dernier ticket connu', async (_name, respond) => {
    const { server, dialog } = await openTicket()
    failReads(server, respond)

    await refocus()

    expect(dialog).toHaveAccessibleName(ticket.title)
    expect(within(dialog).getByText(STALE)).toBeInTheDocument()
  })

  it('404 : « Ticket introuvable », même si le serveur tombe en panne ensuite', async () => {
    const { server, dialog } = await openTicket()
    const restore = failReads(server, notFound)
    await refocus()
    expect(dialog).toHaveAccessibleName('Ticket introuvable')

    restore()
    failReads(server, badGateway)
    await refocus()

    expect(dialog).toHaveAccessibleName('Ticket introuvable')
  })

  it('Réessayer recharge la popup et la vue derrière elle', async () => {
    const { user, server, dialog } = await openTicket()
    const restore = failReads(server, badGateway)
    await refocus()
    expect(screen.getAllByText(STALE)).toHaveLength(2)

    restore()
    await user.click(within(dialog).getByRole('button', { name: 'Réessayer' }))
    await settle()

    expect(screen.queryByText(STALE)).not.toBeInTheDocument()
  })
})

describe('Rechargement en échec de la liste et du board', () => {
  it.each(serverFailures)('%s : la liste garde son tableau', async (_name, respond) => {
    const { server } = setup('/liste')
    await screen.findByRole('table')
    failReads(server, respond)

    await refocus()

    expect(screen.getByRole('link', { name: ticket.title })).toBeInTheDocument()
    expect(screen.getByText(STALE)).toBeInTheDocument()
  })

  it.each(serverFailures)('%s : le board garde ses cartes', async (_name, respond) => {
    const { server } = setup('/')
    await screen.findByRole('link', { name: /Mon ticket/ })
    failReads(server, respond)

    await refocus()

    expect(screen.getByRole('link', { name: /Mon ticket/ })).toBeInTheDocument()
    expect(screen.getByText(STALE)).toBeInTheDocument()
  })

  it('une liste vide reste affichée, avec le bandeau', async () => {
    const { server } = setup('/liste', [])
    await screen.findByText("Aucun ticket pour l'instant.")
    failReads(server, badGateway)

    await refocus()

    expect(screen.getByText("Aucun ticket pour l'instant.")).toBeInTheDocument()
    expect(screen.getByText(STALE)).toBeInTheDocument()
  })

  it.each(['/', '/liste'])(
    '%s : le bandeau reste si Réessayer échoue, part si ça marche',
    async (route) => {
      const { user, server } = setup(route)
      await screen.findByRole('link', { name: /Mon ticket/ })
      const restore = failReads(server, badGateway)
      await refocus()

      await user.click(screen.getByRole('button', { name: 'Réessayer' }))
      await settle()
      expect(screen.getByText(STALE)).toBeInTheDocument()

      restore()
      await user.click(screen.getByRole('button', { name: 'Réessayer' }))
      await settle()
      expect(screen.queryByText(STALE)).not.toBeInTheDocument()
    },
  )

  it('le bandeau part aussi après un rechargement automatique réussi', async () => {
    const { server } = setup('/liste')
    await screen.findByRole('table')
    const restore = failReads(server, badGateway)
    await refocus()
    expect(screen.getByText(STALE)).toBeInTheDocument()

    restore()
    await refocus()

    expect(screen.queryByText(STALE)).not.toBeInTheDocument()
  })
})

describe('Tout premier chargement en échec', () => {
  it.each([
    ['/', 'Impossible de charger les tickets.'],
    ['/liste', 'Impossible de charger les tickets.'],
    ['/liste/tickets/1', 'Impossible de charger le ticket.'],
  ])('%s : écran d’erreur, sans bandeau', async (route, message) => {
    const server = mockServer([ticket])
    // En panne avant même le premier affichage
    failReads(server, badGateway)
    renderWithQueryClient(<App />, { route })

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.queryByText(STALE)).not.toBeInTheDocument()
  })
})
