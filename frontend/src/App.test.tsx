import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { Ticket } from './api/tickets'
import { persoKey } from './test/fixtures'
import App from './App'
import { renderWithQueryClient } from './test/render'
import { mockServer } from './test/server'

const ticket: Ticket = {
  id: 1,
  ...persoKey(1),
  title: 'Installer le projet',
  description: null,
  priority: 'low',
  assignee: null,
  status: 'todo',
  created_at: '2026-11-02T12:00:00Z',
}

/** Les onglets Board / Liste, en haut de page. */
function tab(name: 'Board' | 'Liste') {
  const tabs = screen.getByRole('navigation', { name: 'Vues' })
  return within(tabs).getByRole('link', { name })
}

function expectActiveTab(name: 'Board' | 'Liste') {
  const other = name === 'Board' ? 'Liste' : 'Board'
  expect(tab(name)).toHaveAttribute('aria-current', 'page')
  expect(tab(other)).not.toHaveAttribute('aria-current')
}

function expectBoardView() {
  expect(screen.getByRole('region', { name: 'Board' })).toBeInTheDocument()
  expect(screen.queryByRole('table', { name: 'Tickets' })).not.toBeInTheDocument()
  expectActiveTab('Board')
}

async function expectListView() {
  expect(await screen.findByRole('table', { name: 'Tickets' })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Board' })).not.toBeInTheDocument()
  expectActiveTab('Liste')
}

describe('Navigation entre les vues', () => {
  it("le board est la page d'accueil", () => {
    mockServer([ticket])

    renderWithQueryClient(<App />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'MiniJira' }),
    ).toBeInTheDocument()
    expectBoardView()
  })

  it('les onglets basculent entre le board et la liste', async () => {
    const user = userEvent.setup()
    mockServer([ticket])
    renderWithQueryClient(<App />)

    await user.click(tab('Liste'))
    await expectListView()

    await user.click(tab('Board'))
    expectBoardView()
  })

  it.each(['/', '/liste'])('le bouton « Nouveau ticket » est disponible sur %s', async (route) => {
    const user = userEvent.setup()
    mockServer([ticket])
    renderWithQueryClient(<App />, { route })

    await user.click(screen.getByRole('button', { name: 'Nouveau ticket' }))

    expect(screen.getByRole('form', { name: 'Nouveau ticket' })).toBeInTheDocument()
  })

  it('renvoie vers le board pour une adresse inconnue', () => {
    mockServer([ticket])

    renderWithQueryClient(<App />, { route: '/nimporte/quoi' })

    expectBoardView()
  })
})

describe('Popup selon la vue', () => {
  it('sur le board : /tickets/1 affiche le board derrière, et la fermeture ramène au board', async () => {
    const user = userEvent.setup()
    mockServer([ticket])
    renderWithQueryClient(<App />, { route: '/tickets/1' })

    const dialog = await screen.findByRole('dialog', { name: 'Installer le projet' })
    expectBoardView()

    await user.click(within(dialog).getByRole('button', { name: 'Fermer' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expectBoardView()
  })

  it('sur la liste : un clic sur un titre ouvre la popup, et la fermeture ramène à la liste', async () => {
    const user = userEvent.setup()
    mockServer([ticket])
    renderWithQueryClient(<App />, { route: '/liste' })

    await user.click(await screen.findByRole('link', { name: 'Installer le projet' }))
    const dialog = await screen.findByRole('dialog', { name: 'Installer le projet' })
    await expectListView()

    await user.click(within(dialog).getByRole('button', { name: 'Fermer' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await expectListView()
  })

  it('sur la liste : /liste/tickets/1 affiche la liste derrière, et la fermeture ramène à la liste', async () => {
    const user = userEvent.setup()
    mockServer([ticket])
    renderWithQueryClient(<App />, { route: '/liste/tickets/1' })

    const dialog = await screen.findByRole('dialog', { name: 'Installer le projet' })
    await expectListView()

    await user.click(within(dialog).getByRole('button', { name: 'Fermer' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await expectListView()
  })
})

describe('Création', () => {
  it('crée un ticket : il apparaît en tête de liste, en « À faire », et le formulaire se ferme', async () => {
    const user = userEvent.setup()
    mockServer()
    renderWithQueryClient(<App />, { route: '/liste' })
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

  it('créer un ticket depuis le board reste sur le board', async () => {
    const user = userEvent.setup()
    const server = mockServer()
    renderWithQueryClient(<App />)

    await user.click(screen.getByRole('button', { name: 'Nouveau ticket' }))
    const form = screen.getByRole('form', { name: 'Nouveau ticket' })
    await user.type(within(form).getByLabelText(/Titre/), 'Préparer la démo')
    await user.click(within(form).getByRole('button', { name: 'Créer' }))

    await screen.findByRole('button', { name: 'Nouveau ticket' })
    expect(server.bodiesSent('POST')).toHaveLength(1)
    expectBoardView()
  })

  it('un ticket créé dans un autre projet porte la clé de ce projet sur le board', async () => {
    const user = userEvent.setup()
    mockServer()
    renderWithQueryClient(<App />)

    await user.click(screen.getByRole('button', { name: 'Nouveau ticket' }))
    const form = screen.getByRole('form', { name: 'Nouveau ticket' })
    const projectField = within(form).getByLabelText(/Projet/)
    await waitFor(() => expect(projectField).toBeEnabled())
    await user.selectOptions(projectField, 'Maison (MAISON)')
    await user.type(within(form).getByLabelText(/Titre/), 'Tondre la pelouse')
    await user.click(within(form).getByRole('button', { name: 'Créer' }))

    const card = await screen.findByRole('link', { name: /Tondre la pelouse/ })
    expect(card).toHaveTextContent(/^MAISON-1Tondre la pelouse/)
  })

  it('Annuler referme le formulaire', async () => {
    const user = userEvent.setup()
    const server = mockServer()
    renderWithQueryClient(<App />)

    await user.click(screen.getByRole('button', { name: 'Nouveau ticket' }))
    await user.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(screen.queryByRole('form', { name: 'Nouveau ticket' })).not.toBeInTheDocument()
    expect(server.bodiesSent('POST')).toEqual([])
  })
})
