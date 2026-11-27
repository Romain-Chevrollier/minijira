import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { Ticket } from '../api/tickets'
import App from '../App'
import { maisonKey, persoKey } from '../test/fixtures'
import { renderWithQueryClient } from '../test/render'
import { mockServer } from '../test/server'

const base = {
  description: null,
  priority: 'medium',
  assignee: null,
  created_at: '2026-11-02T12:00:00Z',
} as const

const TICKETS: Ticket[] = [
  { ...base, id: 1, ...persoKey(1), title: 'Installer le projet', status: 'todo' },
  { ...base, id: 2, ...maisonKey(1), title: 'Tondre la pelouse', status: 'in_progress' },
  { ...base, id: 3, ...maisonKey(2), title: 'Réparer le robinet', status: 'todo' },
]

function setup(route: string, tickets: Ticket[] = TICKETS) {
  const user = userEvent.setup()
  mockServer(tickets)
  const { router } = renderWithQueryClient(<App />, { route })
  /** Adresse complète du moment : /liste?projet=MAISON. */
  const address = () => router.state.location.pathname + router.state.location.search
  return { user, router, address }
}

const filterMenu = () => screen.getByLabelText('Filtrer par projet')

/** Attend que le menu affiche le filtre voulu, une fois les projets chargés. */
async function expectFilter(value: '' | 'PERSO' | 'MAISON') {
  await waitFor(() => {
    // Les projets sont chargés : le menu propose chacun d'eux
    expect(within(filterMenu()).getByRole('option', { name: 'Maison' })).toBeInTheDocument()
    expect(filterMenu()).toHaveValue(value)
  })
}

/** Titres des cartes d'une colonne du board. */
function cardTitles(column: 'À faire' | 'En cours') {
  const region = screen.getByRole('region', { name: column })
  return Array.from(region.querySelectorAll('.ticket-card-title')).map((t) => t.textContent)
}

function columnCount(column: 'À faire' | 'En cours') {
  const region = screen.getByRole('region', { name: column })
  return region.querySelector('.board-column-count')?.textContent
}

/** Titres des tickets de la liste ; vide tant qu'elle n'est pas affichée. */
function listTitles() {
  const table = screen.queryByRole('table', { name: 'Tickets' })
  return table ? within(table).getAllByRole('link').map((link) => link.textContent) : []
}

/**
 * Après un changement d'adresse (filtre, onglet, Précédent), React Router termine la
 * navigation puis React met l'écran à jour un peu plus tard : on attend le résultat
 * au lieu de le vérifier tout de suite (voir #67).
 */
const eventually = (check: () => void) => waitFor(check)

describe('Filtre par projet', () => {
  it('propose « Tous les projets » (par défaut) et chaque projet', async () => {
    setup('/')
    await expectFilter('')

    const options = within(filterMenu()).getAllByRole('option')
    expect(options.map((option) => option.textContent)).toEqual([
      'Tous les projets',
      'Personnel',
      'Maison',
    ])
    expect(cardTitles('À faire')).toEqual(['Réparer le robinet', 'Installer le projet'])
  })

  it("filtre le board, compteurs compris, et l'inscrit dans l'adresse", async () => {
    const { user, address } = setup('/')
    await expectFilter('')

    await user.selectOptions(filterMenu(), 'Maison')

    await eventually(() => expect(cardTitles('À faire')).toEqual(['Réparer le robinet']))
    expect(address()).toBe('/?projet=MAISON')
    expect(cardTitles('En cours')).toEqual(['Tondre la pelouse'])
    expect(columnCount('À faire')).toBe('1 ticket')
  })

  it('filtre la liste, ouverte directement par son adresse (comme après un rafraîchissement)', async () => {
    setup('/liste?projet=MAISON')

    await eventually(() =>
      expect(listTitles()).toEqual(['Tondre la pelouse', 'Réparer le robinet']),
    )
    await expectFilter('MAISON')
  })

  it("« Tous les projets » retire le filtre de l'adresse", async () => {
    const { user, address } = setup('/liste?projet=PERSO')
    await eventually(() => expect(listTitles()).toEqual(['Installer le projet']))

    await user.selectOptions(filterMenu(), 'Tous les projets')

    await eventually(() => expect(listTitles()).toHaveLength(3))
    expect(address()).toBe('/liste')
  })

  it("est conservé en passant du board à la liste et retour, mais pas sur l'écran Projets", async () => {
    const { user, address } = setup('/?projet=MAISON')
    await expectFilter('MAISON')
    const tabs = screen.getByRole('navigation', { name: 'Vues' })

    await user.click(within(tabs).getByRole('link', { name: 'Liste' }))
    await eventually(() =>
      expect(listTitles()).toEqual(['Tondre la pelouse', 'Réparer le robinet']),
    )
    expect(address()).toBe('/liste?projet=MAISON')

    await user.click(within(tabs).getByRole('link', { name: 'Board' }))
    await eventually(() => expect(cardTitles('À faire')).toEqual(['Réparer le robinet']))
    expect(address()).toBe('/?projet=MAISON')

    await user.click(within(tabs).getByRole('link', { name: 'Projets' }))
    await eventually(() =>
      expect(screen.queryByLabelText('Filtrer par projet')).not.toBeInTheDocument(),
    )
    expect(address()).toBe('/projets')
  })

  it("est conservé à l'ouverture et à la fermeture d'une popup", async () => {
    const { user, address } = setup('/?projet=MAISON')
    await expectFilter('MAISON')

    await user.click(screen.getByRole('link', { name: /Tondre la pelouse/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Tondre la pelouse' })
    expect(address()).toBe('/tickets/2?projet=MAISON')
    expect(filterMenu()).toHaveValue('MAISON')

    await user.click(within(dialog).getByRole('button', { name: 'Fermer' }))

    await eventually(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(address()).toBe('/?projet=MAISON')
    expect(cardTitles('À faire')).toEqual(['Réparer le robinet'])
  })

  it('une popup ouverte par son adresse se ferme sur la vue filtrée', async () => {
    const { user, address } = setup('/liste/tickets/2?projet=MAISON')
    const dialog = await screen.findByRole('dialog', { name: 'Tondre la pelouse' })

    await user.click(within(dialog).getByRole('button', { name: 'Fermer' }))

    await eventually(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(address()).toBe('/liste?projet=MAISON')
    await eventually(() =>
      expect(listTitles()).toEqual(['Tondre la pelouse', 'Réparer le robinet']),
    )
  })

  it('suit le bouton Précédent', async () => {
    const { user, router, address } = setup('/')
    await expectFilter('')
    await user.selectOptions(filterMenu(), 'Maison')
    await eventually(() => expect(filterMenu()).toHaveValue('MAISON'))
    await user.selectOptions(filterMenu(), 'Personnel')
    await eventually(() => expect(cardTitles('À faire')).toEqual(['Installer le projet']))

    await act(async () => router.navigate(-1))
    await eventually(() => expect(cardTitles('À faire')).toEqual(['Réparer le robinet']))
    expect(address()).toBe('/?projet=MAISON')
    expect(filterMenu()).toHaveValue('MAISON')

    await act(async () => router.navigate(-1))
    await eventually(() => expect(filterMenu()).toHaveValue(''))
    expect(address()).toBe('/')
  })

  it('un projet inconnu dans l’adresse ramène à « Tous les projets »', async () => {
    const { router, address } = setup('/?projet=INCONNU')

    await waitFor(() => expect(address()).toBe('/'))
    await expectFilter('')
    await eventually(() =>
      expect(cardTitles('À faire')).toEqual(['Réparer le robinet', 'Installer le projet']),
    )
    // L'adresse est corrigée sans étape de plus : Précédent ne ramène pas à INCONNU
    expect(router.state.historyAction).toBe('REPLACE')
  })

  it('« Nouveau ticket » présélectionne le projet filtré', async () => {
    const { user } = setup('/?projet=MAISON')
    await expectFilter('MAISON')

    await user.click(screen.getByRole('button', { name: 'Nouveau ticket' }))
    const form = screen.getByRole('form', { name: 'Nouveau ticket' })

    await waitFor(() => expect(within(form).getByLabelText(/Projet/)).toHaveValue('2'))
  })

  it('un projet sans ticket affiche un état vide clair, sur le board et dans la liste', async () => {
    const { user } = setup('/?projet=MAISON', [TICKETS[0]])

    expect(
      await screen.findByText("Aucun ticket dans le projet « Maison » pour l'instant."),
    ).toBeInTheDocument()
    expect(cardTitles('À faire')).toEqual([])

    await user.click(screen.getByRole('link', { name: 'Liste' }))
    // Attendre que le board soit parti : son propre message ne doit pas compter
    await eventually(() =>
      expect(screen.queryByRole('region', { name: 'Board' })).not.toBeInTheDocument(),
    )
    expect(
      screen.getByText("Aucun ticket dans le projet « Maison » pour l'instant."),
    ).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Tickets' })).not.toBeInTheDocument()
  })
})
