import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { Ticket } from '../api/tickets'
import App from '../App'
import { persoKey, PROJECTS } from '../test/fixtures'
import { jsonResponse, renderWithQueryClient } from '../test/render'
import { mockServer } from '../test/server'

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

/** Écran Projets avec PERSO (1 ticket) et MAISON (vide), une fois le tableau chargé. */
async function setup({ projects = PROJECTS, tickets = [ticket] } = {}) {
  const user = userEvent.setup()
  const server = mockServer(tickets, projects)
  renderWithQueryClient(<App />, { route: '/projets' })
  const table = await screen.findByRole('table', { name: 'Projets' })
  return { user, server, table }
}

/** Ligne du tableau d'un projet, d'après son nom. */
function row(name: string) {
  const cell = screen.getByText(name, { selector: '.project-name' })
  return cell.closest('tr') as HTMLElement
}

function cellTexts(name: string) {
  return within(row(name))
    .getAllByRole('cell')
    .map((cell) => cell.textContent)
}

/** Choix proposés par le champ Projet de « Nouveau ticket ». */
async function ticketFormProjectChoices(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Nouveau ticket' }))
  const form = screen.getByRole('form', { name: 'Nouveau ticket' })
  const field = within(form).getByLabelText(/Projet/)
  await waitFor(() => expect(field).toBeEnabled())
  return within(field)
    .getAllByRole('option')
    .map((option) => option.textContent)
}

describe('Écran Projets', () => {
  it("a sa propre adresse et son onglet, et liste nom, clé et nombre de tickets", async () => {
    await setup()

    const tabs = screen.getByRole('navigation', { name: 'Vues' })
    expect(within(tabs).getByRole('link', { name: 'Projets' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('heading', { name: 'Projets' })).toBeInTheDocument()
    expect(cellTexts('Personnel').slice(1, 3)).toEqual(['PERSO', '1'])
    expect(cellTexts('Maison').slice(1, 3)).toEqual(['MAISON', '0'])
  })

  it("l'onglet Projets mène à l'écran depuis le board", async () => {
    const user = userEvent.setup()
    mockServer([ticket])
    renderWithQueryClient(<App />)

    await user.click(screen.getByRole('link', { name: 'Projets' }))

    expect(await screen.findByRole('table', { name: 'Projets' })).toBeInTheDocument()
  })

  it('affiche un indicateur pendant le chargement', () => {
    const server = mockServer([ticket])
    server.fetchMock.mockImplementation(() => new Promise(() => {}))
    renderWithQueryClient(<App />, { route: '/projets' })

    expect(screen.getByRole('status')).toHaveTextContent('Chargement des projets…')
  })

  it('si les projets ne se chargent pas, Réessayer relance le chargement', async () => {
    const user = userEvent.setup()
    const server = mockServer([ticket])
    server.fetchMock.mockImplementationOnce(async () => jsonResponse({}, 500))
    renderWithQueryClient(<App />, { route: '/projets' })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Impossible de charger les projets.')
    await user.click(within(alert).getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByRole('table', { name: 'Projets' })).toBeInTheDocument()
  })
})

describe('Créer un projet', () => {
  it("propose la clé d'après le nom, puis ajoute le projet au tableau", async () => {
    const { user, server } = await setup()

    await user.click(screen.getByRole('button', { name: 'Nouveau projet' }))
    await user.type(screen.getByLabelText(/Nom/), 'Côté jardin')

    const keyField = screen.getByLabelText(/Clé/)
    expect(keyField).toHaveValue('COTEJARDIN')
    expect(keyField).toHaveAccessibleDescription(
      'La clé ne pourra plus être modifiée. Elle préfixe les tickets : COTEJARDIN-1, COTEJARDIN-2…',
    )

    await user.click(screen.getByRole('button', { name: 'Créer le projet' }))

    expect(await screen.findByText('Côté jardin', { selector: '.project-name' })).toBeInTheDocument()
    expect(cellTexts('Côté jardin').slice(1, 3)).toEqual(['COTEJARDIN', '0'])
    expect(server.bodiesSent('POST')).toEqual([{ name: 'Côté jardin', key: 'COTEJARDIN' }])
    expect(screen.queryByRole('form', { name: 'Nouveau projet' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nouveau projet' })).toHaveFocus()
  })

  it('une clé corrigée à la main passe en majuscules et ne suit plus le nom', async () => {
    const { user, server } = await setup()
    await user.click(screen.getByRole('button', { name: 'Nouveau projet' }))
    const nameField = screen.getByLabelText(/Nom/)
    const keyField = screen.getByLabelText(/Clé/)

    await user.type(nameField, 'Jardin')
    await user.clear(keyField)
    await user.type(keyField, 'potager')
    expect(keyField).toHaveValue('POTAGER')

    await user.type(nameField, ' et verger')
    expect(keyField).toHaveValue('POTAGER')

    await user.click(screen.getByRole('button', { name: 'Créer le projet' }))
    await waitFor(() =>
      expect(server.bodiesSent('POST')).toEqual([{ name: 'Jardin et verger', key: 'POTAGER' }]),
    )
  })

  it.each([
    ['1AB', 'La clé doit commencer par une lettre.'],
    ['A', 'La clé doit faire au moins 2 caractères.'],
    ['MAISON', 'La clé MAISON est déjà utilisée par un autre projet.'],
  ])('refuse la clé « %s » sans appeler l’API', async (key, message) => {
    const { user, server } = await setup()
    await user.click(screen.getByRole('button', { name: 'Nouveau projet' }))
    await user.type(screen.getByLabelText(/Nom/), 'Autre')
    const keyField = screen.getByLabelText(/Clé/)
    await user.clear(keyField)
    await user.type(keyField, key)

    await user.click(screen.getByRole('button', { name: 'Créer le projet' }))

    expect(screen.getByText(message)).toBeInTheDocument()
    expect(keyField).toHaveAttribute('aria-invalid', 'true')
    expect(server.bodiesSent('POST')).toEqual([])
  })

  it('refuse un nom vide', async () => {
    const { user, server } = await setup()
    await user.click(screen.getByRole('button', { name: 'Nouveau projet' }))

    await user.click(screen.getByRole('button', { name: 'Créer le projet' }))

    expect(screen.getByText('Le nom est obligatoire.')).toBeInTheDocument()
    expect(server.bodiesSent('POST')).toEqual([])
  })

  it("clé prise entre-temps : le message de l'API s'affiche sous la clé, qui reprend le focus", async () => {
    const { user, server } = await setup()
    server.fetchMock.mockImplementationOnce(async () =>
      jsonResponse({ detail: 'La clé JARDIN est déjà utilisée par un autre projet' }, 409),
    )
    await user.click(screen.getByRole('button', { name: 'Nouveau projet' }))
    await user.type(screen.getByLabelText(/Nom/), 'Jardin')

    await user.click(screen.getByRole('button', { name: 'Créer le projet' }))

    const keyField = screen.getByLabelText(/Clé/)
    expect(
      await screen.findByText('La clé JARDIN est déjà utilisée par un autre projet'),
    ).toBeInTheDocument()
    expect(keyField).toHaveFocus()
    expect(keyField).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(/Nom/)).toHaveValue('Jardin')
  })

  it('le nouveau projet est proposé dans « Nouveau ticket »', async () => {
    const { user } = await setup()
    await user.click(screen.getByRole('button', { name: 'Nouveau projet' }))
    await user.type(screen.getByLabelText(/Nom/), 'Jardin')
    await user.click(screen.getByRole('button', { name: 'Créer le projet' }))
    await screen.findByText('Jardin', { selector: '.project-name' })

    expect(await ticketFormProjectChoices(user)).toContain('Jardin (JARDIN)')
  })
})

describe('Renommer un projet', () => {
  it('au clavier : Entrée ouvre, Entrée enregistre, et le focus revient sur le bouton', async () => {
    const { user, server } = await setup()
    screen.getByRole('button', { name: 'Renommer Maison' }).focus()

    await user.keyboard('{Enter}')
    const input = screen.getByLabelText('Nouveau nom')
    expect(input).toHaveValue('Maison')
    expect(input).toHaveFocus()
    // La clé reste affichée, sans champ pour la modifier
    expect(within(input.closest('tr') as HTMLElement).queryByLabelText(/Clé/)).toBeNull()

    await user.clear(input)
    await user.type(input, 'Chez moi{Enter}')

    expect(await screen.findByText('Chez moi', { selector: '.project-name' })).toBeInTheDocument()
    expect(cellTexts('Chez moi')[1]).toBe('MAISON')
    expect(server.bodiesSent('PATCH')).toEqual([{ name: 'Chez moi' }])
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Renommer Chez moi' })).toHaveFocus(),
    )
  })

  it('Échap annule sans rien envoyer', async () => {
    const { user, server } = await setup()
    await user.click(screen.getByRole('button', { name: 'Renommer Maison' }))
    await user.type(screen.getByLabelText('Nouveau nom'), ' bis')

    await user.keyboard('{Escape}')

    expect(screen.queryByLabelText('Nouveau nom')).not.toBeInTheDocument()
    expect(screen.getByText('Maison', { selector: '.project-name' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Renommer Maison' })).toHaveFocus()
    expect(server.bodiesSent('PATCH')).toEqual([])
  })

  it("un nom vide est refusé, un nom inchangé n'appelle pas l'API", async () => {
    const { user, server } = await setup()
    await user.click(screen.getByRole('button', { name: 'Renommer Maison' }))
    const input = screen.getByLabelText('Nouveau nom')

    await user.clear(input)
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(screen.getByText('Le nom est obligatoire.')).toBeInTheDocument()

    await user.type(input, 'Maison')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(screen.queryByLabelText('Nouveau nom')).not.toBeInTheDocument()
    expect(server.bodiesSent('PATCH')).toEqual([])
  })

  it('affiche un message si le serveur ne répond pas, et garde la saisie', async () => {
    const { user, server } = await setup()
    server.fetchMock.mockImplementationOnce(() => Promise.reject(new TypeError('Failed to fetch')))
    await user.click(screen.getByRole('button', { name: 'Renommer Maison' }))
    const input = screen.getByLabelText('Nouveau nom')
    await user.clear(input)
    await user.type(input, 'Chez moi{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Le projet n'a pas pu être renommé. Le serveur ne répond pas.",
    )
    expect(input).toHaveValue('Chez moi')
  })

  it('le nouveau nom apparaît dans « Nouveau ticket » et dans la popup des tickets', async () => {
    const { user } = await setup()
    await user.click(screen.getByRole('button', { name: 'Renommer Personnel' }))
    const input = screen.getByLabelText('Nouveau nom')
    await user.clear(input)
    await user.type(input, 'Perso{Enter}')
    await screen.findByText('Perso', { selector: '.project-name' })

    expect(await ticketFormProjectChoices(user)).toContain('Perso (PERSO)')

    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    await user.click(screen.getByRole('link', { name: 'Liste' }))
    await user.click(await screen.findByRole('link', { name: 'Installer le projet' }))
    const dialog = await screen.findByRole('dialog', { name: 'Installer le projet' })
    expect(within(dialog).getByText('Perso')).toBeInTheDocument()
  })
})

describe('Supprimer un projet', () => {
  it('un projet vide : confirmation (focus sur Annuler), puis il disparaît partout', async () => {
    const { user, server } = await setup()

    await user.click(screen.getByRole('button', { name: 'Supprimer Maison' }))
    const confirm = screen.getByRole('group', { name: 'Confirmer la suppression de Maison' })
    expect(confirm).toHaveTextContent('Supprimer le projet « Maison » ?')
    expect(within(confirm).getByRole('button', { name: 'Annuler' })).toHaveFocus()

    await user.click(within(confirm).getByRole('button', { name: 'Oui, supprimer' }))

    await waitFor(() =>
      expect(screen.queryByText('Maison', { selector: '.project-name' })).not.toBeInTheDocument(),
    )
    expect(server.urlsCalled('DELETE')).toEqual(['/api/projects/2'])
    expect(screen.getByRole('heading', { name: 'Projets' })).toHaveFocus()
    expect(await ticketFormProjectChoices(user)).toEqual(['Personnel (PERSO)'])
  })

  it('Annuler garde le projet et rend le focus au bouton', async () => {
    const { user, server } = await setup()
    await user.click(screen.getByRole('button', { name: 'Supprimer Maison' }))

    await user.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(screen.queryByRole('group')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Supprimer Maison' })).toHaveFocus()
    expect(server.urlsCalled('DELETE')).toEqual([])
  })

  it('un projet qui contient des tickets ne peut pas être supprimé, et la raison est affichée', async () => {
    const { user, server } = await setup()
    const button = screen.getByRole('button', { name: 'Supprimer Personnel' })

    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAccessibleDescription('Contient 1 ticket : suppression impossible.')
    expect(within(row('Personnel')).getByText('Contient 1 ticket : suppression impossible.')).toBeVisible()

    await user.click(button)
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
    expect(server.urlsCalled('DELETE')).toEqual([])
  })

  it('le dernier projet ne peut pas être supprimé, et la raison est affichée', async () => {
    const { user, server } = await setup({ projects: [PROJECTS[0]], tickets: [] })
    const button = screen.getByRole('button', { name: 'Supprimer Personnel' })

    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).toHaveAccessibleDescription(
      "C'est le dernier projet : suppression impossible.",
    )

    await user.click(button)
    expect(server.urlsCalled('DELETE')).toEqual([])
  })

  it("refus de l'API (tickets ajoutés entre-temps) : son message s'affiche", async () => {
    const { user, server } = await setup()
    await user.click(screen.getByRole('button', { name: 'Supprimer Maison' }))
    server.fetchMock.mockImplementationOnce(async () =>
      jsonResponse({ detail: 'Le projet MAISON contient 2 tickets' }, 409),
    )

    await user.click(screen.getByRole('button', { name: 'Oui, supprimer' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le projet MAISON contient 2 tickets',
    )
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
    expect(screen.getByText('Maison', { selector: '.project-name' })).toBeInTheDocument()
  })

  it('affiche un message si le serveur ne répond pas', async () => {
    const { user, server } = await setup()
    await user.click(screen.getByRole('button', { name: 'Supprimer Maison' }))
    server.fetchMock.mockImplementationOnce(() => Promise.reject(new TypeError('Failed to fetch')))

    await user.click(screen.getByRole('button', { name: 'Oui, supprimer' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Le projet n'a pas pu être supprimé. Le serveur ne répond pas.",
    )
  })
})
