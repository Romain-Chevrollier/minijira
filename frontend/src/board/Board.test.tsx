import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Ticket } from '../api/tickets'
import App from '../App'
import { jsonResponse, renderWithQueryClient } from '../test/render'
import { mockServer } from '../test/server'

const tickets: Ticket[] = [
  {
    id: 1,
    title: 'Installer le projet',
    description: null,
    priority: 'low',
    assignee: null,
    status: 'todo',
    created_at: '2026-11-02T12:00:00Z',
  },
  {
    id: 2,
    title: 'Préparer la démo',
    description: null,
    priority: 'high',
    assignee: 'Élodie',
    status: 'todo',
    created_at: '2026-11-01T12:00:00Z',
  },
  {
    id: 3,
    title: 'Écrire la doc',
    description: null,
    priority: 'medium',
    assignee: null,
    status: 'in_progress',
    created_at: '2026-11-05T12:00:00Z',
  },
]

afterEach(() => {
  vi.unstubAllGlobals()
})

function column(name: 'À faire' | 'En cours' | 'Terminé') {
  return screen.getByRole('region', { name })
}

/** Titres des cartes d'une colonne, de haut en bas. */
function cardTitles(name: 'À faire' | 'En cours' | 'Terminé') {
  return Array.from(column(name).querySelectorAll('.ticket-card-title')).map(
    (title) => title.textContent,
  )
}

function countOf(name: 'À faire' | 'En cours' | 'Terminé') {
  return column(name).querySelector('.board-column-count')
}

async function setup(initialTickets = tickets) {
  const user = userEvent.setup()
  const server = mockServer(initialTickets)
  renderWithQueryClient(<App />)
  await screen.findByRole('region', { name: 'À faire' })
  return { user, server }
}

describe('Board', () => {
  it('affiche 3 colonnes avec leurs tickets, triés par priorité puis date', async () => {
    await setup()

    // Haute avant Basse, même si « Installer le projet » est plus récent
    expect(cardTitles('À faire')).toEqual(['Préparer la démo', 'Installer le projet'])
    expect(cardTitles('En cours')).toEqual(['Écrire la doc'])
    expect(cardTitles('Terminé')).toEqual([])
  })

  it('affiche le nombre de tickets de chaque colonne', async () => {
    await setup()

    expect(countOf('À faire')).toHaveTextContent('2 tickets')
    expect(countOf('En cours')).toHaveTextContent('1 ticket')
    expect(countOf('Terminé')).toHaveTextContent('0 ticket')
  })

  it('une colonne vide affiche « Aucun ticket »', async () => {
    await setup()

    expect(within(column('Terminé')).getByText('Aucun ticket')).toBeInTheDocument()
    expect(within(column('À faire')).queryByText('Aucun ticket')).not.toBeInTheDocument()
  })

  it("une carte affiche le titre, la priorité et l'assigné s'il y en a un", async () => {
    await setup()

    const withAssignee = screen.getByRole('link', { name: /Préparer la démo/ })
    expect(within(withAssignee).getByText('Haute')).toBeInTheDocument()
    expect(within(withAssignee).getByText('Élodie')).toBeInTheDocument()

    const withoutAssignee = screen.getByRole('link', { name: /Installer le projet/ })
    expect(withoutAssignee).toHaveTextContent(/^Installer le projetBasse$/)
  })

  it('un clic sur une carte ouvre sa popup par-dessus le board', async () => {
    const { user } = await setup()

    await user.click(screen.getByRole('link', { name: /Préparer la démo/ }))

    const dialog = await screen.findByRole('dialog', { name: 'Préparer la démo' })
    expect(within(dialog).getByText('Élodie')).toBeInTheDocument()
    expect(column('À faire')).toBeInTheDocument()
  })

  it('Entrée sur une carte ouvre sa popup, et la fermer ramène au board', async () => {
    const { user } = await setup()
    screen.getByRole('link', { name: /Écrire la doc/ }).focus()

    await user.keyboard('{Enter}')

    const dialog = await screen.findByRole('dialog', { name: 'Écrire la doc' })
    await user.click(within(dialog).getByRole('button', { name: 'Fermer' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(column('En cours')).toBeInTheDocument()
  })

  it('un changement de statut dans la popup déplace la carte', async () => {
    const { user } = await setup()
    await user.click(screen.getByRole('link', { name: /Écrire la doc/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Écrire la doc' })

    await user.click(within(dialog).getByRole('button', { name: 'Modifier' }))
    await user.selectOptions(within(dialog).getByLabelText('Statut'), 'Terminé')
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(cardTitles('Terminé')).toEqual(['Écrire la doc']))
    expect(cardTitles('En cours')).toEqual([])
  })

  it('un ticket créé depuis le board apparaît dans « À faire »', async () => {
    const { user } = await setup()

    await user.click(screen.getByRole('button', { name: 'Nouveau ticket' }))
    const form = screen.getByRole('form', { name: 'Nouveau ticket' })
    await user.type(within(form).getByLabelText(/Titre/), 'Ranger le bureau')
    await user.click(within(form).getByRole('button', { name: 'Créer' }))

    // Priorité Moyenne par défaut : entre Haute et Basse
    await waitFor(() =>
      expect(cardTitles('À faire')).toEqual([
        'Préparer la démo',
        'Ranger le bureau',
        'Installer le projet',
      ]),
    )
  })

  it('une suppression retire la carte du board', async () => {
    const { user } = await setup()
    await user.click(screen.getByRole('link', { name: /Écrire la doc/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Écrire la doc' })

    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }))
    await user.click(within(dialog).getByRole('button', { name: 'Oui, supprimer' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(cardTitles('En cours')).toEqual([])
  })
})

describe('Board : chargement et erreur', () => {
  it('affiche un message pendant le chargement', () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(() => new Promise(() => {})))

    renderWithQueryClient(<App />)

    expect(screen.getByRole('status')).toHaveTextContent('Chargement des tickets…')
  })

  it('affiche une erreur, et « Réessayer » recharge les tickets', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ detail: 'Erreur' }, 500))
      .mockResolvedValueOnce(jsonResponse(tickets))
    vi.stubGlobal('fetch', fetchMock)
    renderWithQueryClient(<App />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Impossible de charger les tickets.')

    await user.click(within(alert).getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByRole('region', { name: 'À faire' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
