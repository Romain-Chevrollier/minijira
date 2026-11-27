import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { Ticket } from '../api/tickets'
import { persoKey } from '../test/fixtures'
import App from '../App'
import { jsonResponse, renderWithQueryClient } from '../test/render'
import { mockServer } from '../test/server'

const fullTicket: Ticket = {
  id: 2,
  ...persoKey(2),
  title: 'Préparer la démo',
  description: 'Montrer la liste\net le formulaire',
  priority: 'high',
  assignee: 'Élodie',
  status: 'in_progress',
  created_at: '2026-11-18T12:00:00Z',
}

const bareTicket: Ticket = {
  id: 1,
  ...persoKey(1),
  title: 'Installer le projet',
  description: null,
  priority: 'low',
  assignee: null,
  status: 'todo',
  created_at: '2026-11-02T12:00:00Z',
}

function setup(route = '/liste') {
  const user = userEvent.setup()
  const server = mockServer([fullTicket, bareTicket])
  renderWithQueryClient(<App />, { route })
  return { user, server }
}

/** Ouvre la popup d'un ticket en cliquant sur son titre dans la liste. */
async function openFromList(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(await screen.findByRole('link', { name: title }))
  return screen.findByRole('dialog', { name: title })
}

describe('Popup de détail', () => {
  it('un clic sur un titre de la liste ouvre la popup avec tous les champs', async () => {
    const { user } = setup()

    const dialog = await openFromList(user, 'Préparer la démo')

    expect(within(dialog).getByText('PERSO-2')).toBeInTheDocument()
    expect(within(dialog).getByText('Projet')).toBeInTheDocument()
    expect(within(dialog).getByText('Personnel')).toBeInTheDocument()
    expect(within(dialog).getByText('En cours')).toBeInTheDocument()
    expect(within(dialog).getByText('Haute')).toBeInTheDocument()
    expect(within(dialog).getByText('Élodie')).toBeInTheDocument()
    expect(within(dialog).getByText('18/11/2026')).toBeInTheDocument()
    expect(within(dialog).getByText(/Montrer la liste/)).toBeInTheDocument()
    // La liste reste affichée derrière
    expect(screen.getByRole('table', { name: 'Tickets' })).toBeInTheDocument()
  })

  it('signale les champs vides', async () => {
    setup('/liste/tickets/1')

    const dialog = await screen.findByRole('dialog', { name: 'Installer le projet' })

    expect(within(dialog).getByText('Non assigné')).toBeInTheDocument()
    expect(within(dialog).getByText('Aucune description.')).toBeInTheDocument()
  })

  it('se ferme avec le bouton ✕', async () => {
    const { user } = setup()
    const dialog = await openFromList(user, 'Préparer la démo')

    await user.click(within(dialog).getByRole('button', { name: 'Fermer' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('table', { name: 'Tickets' })).toBeInTheDocument()
  })

  it('ouverte directement par son adresse, elle se ferme sur la liste (sa vue)', async () => {
    const { user } = setup('/liste/tickets/2')
    const dialog = await screen.findByRole('dialog', { name: 'Préparer la démo' })

    await user.click(within(dialog).getByRole('button', { name: 'Fermer' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByRole('table', { name: 'Tickets' })).toBeInTheDocument()
  })

  it('se ferme avec la touche Échap', async () => {
    const { user } = setup()
    const dialog = await openFromList(user, 'Préparer la démo')

    // Le navigateur envoie l'événement « cancel » quand on appuie sur Échap
    fireEvent(dialog, new Event('cancel', { cancelable: true }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('se ferme avec un clic à côté, mais pas avec un clic dans son contenu', async () => {
    const { user } = setup()
    const dialog = await openFromList(user, 'Préparer la démo')

    await user.click(within(dialog).getByText('Élodie'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Un clic sur le fond assombri atteint l'élément <dialog> lui-même
    await user.click(dialog)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('affiche « Ticket introuvable » pour un ticket qui n’existe pas', async () => {
    setup('/liste/tickets/99')

    expect(
      await screen.findByRole('dialog', { name: 'Ticket introuvable' }),
    ).toBeInTheDocument()
  })

  it('affiche « Ticket introuvable » pour une adresse invalide, sans appeler l’API', async () => {
    const { server } = setup('/liste/tickets/abc')

    expect(
      await screen.findByRole('dialog', { name: 'Ticket introuvable' }),
    ).toBeInTheDocument()
    expect(server.fetchMock).not.toHaveBeenCalledWith('/api/tickets/abc')
  })
})

describe('Suppression depuis la popup', () => {
  it('demande une confirmation, et Annuler ne supprime rien', async () => {
    const { user, server } = setup()
    const dialog = await openFromList(user, 'Préparer la démo')

    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }))
    const confirm = within(dialog).getByRole('group', { name: 'Confirmer la suppression' })
    expect(confirm).toHaveTextContent('Supprimer définitivement ce ticket ?')
    // Le focus est sur « Annuler », l'action sans risque
    expect(within(confirm).getByRole('button', { name: 'Annuler' })).toHaveFocus()

    await user.click(within(confirm).getByRole('button', { name: 'Annuler' }))

    expect(within(dialog).getByRole('button', { name: 'Supprimer' })).toBeInTheDocument()
    expect(server.urlsCalled('DELETE')).toEqual([])
  })

  it('après confirmation, supprime le ticket, ferme la popup et le retire de la liste', async () => {
    const { user, server } = setup()
    const dialog = await openFromList(user, 'Préparer la démo')

    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }))
    await user.click(within(dialog).getByRole('button', { name: 'Oui, supprimer' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(server.urlsCalled('DELETE')).toEqual(['/api/tickets/2'])
    expect(screen.queryByRole('link', { name: 'Préparer la démo' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Installer le projet' })).toBeInTheDocument()
  })

  it('ferme la popup sans erreur si le ticket était déjà supprimé', async () => {
    const { user, server } = setup('/liste/tickets/2')
    const dialog = await screen.findByRole('dialog', { name: 'Préparer la démo' })

    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }))
    server.fetchMock.mockImplementationOnce(async () =>
      jsonResponse({ detail: 'Ticket introuvable' }, 404),
    )
    await user.click(within(dialog).getByRole('button', { name: 'Oui, supprimer' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it("garde la popup ouverte et le ticket dans la liste si l'API échoue", async () => {
    const { user, server } = setup()
    const dialog = await openFromList(user, 'Préparer la démo')

    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }))
    server.fetchMock.mockImplementationOnce(async () =>
      jsonResponse({ detail: 'Erreur' }, 500),
    )
    await user.click(within(dialog).getByRole('button', { name: 'Oui, supprimer' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      "Le ticket n'a pas pu être supprimé.",
    )
    expect(screen.getByRole('dialog', { name: 'Préparer la démo' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Préparer la démo' })).toBeInTheDocument()
  })
})

describe('Modification depuis la popup', () => {
  it("n'envoie que les champs modifiés, puis met à jour la popup et la liste", async () => {
    const { user, server } = setup()
    const dialog = await openFromList(user, 'Préparer la démo')

    await user.click(within(dialog).getByRole('button', { name: 'Modifier' }))
    const title = within(dialog).getByLabelText(/Titre/)
    expect(title).toHaveValue('Préparer la démo')
    await user.clear(title)
    await user.type(title, 'Démo prête')
    await user.selectOptions(within(dialog).getByLabelText('Statut'), 'Terminé')
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    const updated = await screen.findByRole('dialog', { name: 'Démo prête' })
    expect(within(updated).getByText('Terminé')).toBeInTheDocument()
    expect(server.bodiesSent('PATCH')).toEqual([{ title: 'Démo prête', status: 'done' }])

    await user.click(within(updated).getByRole('button', { name: 'Fermer' }))
    const table = screen.getByRole('table', { name: 'Tickets' })
    const row = within(table).getByRole('link', { name: 'Démo prête' }).closest('tr')
    expect(row).not.toBeNull()
    expect(within(row as HTMLElement).getByText('Terminé')).toBeInTheDocument()
  })

  it('envoie null quand on vide la description', async () => {
    const { user, server } = setup('/liste/tickets/2')
    const dialog = await screen.findByRole('dialog', { name: 'Préparer la démo' })

    await user.click(within(dialog).getByRole('button', { name: 'Modifier' }))
    await user.clear(within(dialog).getByLabelText('Description'))
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    expect(
      await within(dialog).findByText('Aucune description.'),
    ).toBeInTheDocument()
    expect(server.bodiesSent('PATCH')).toEqual([{ description: null }])
  })

  it("n'appelle pas l'API si rien n'a changé", async () => {
    const { user, server } = setup('/liste/tickets/2')
    const dialog = await screen.findByRole('dialog', { name: 'Préparer la démo' })

    await user.click(within(dialog).getByRole('button', { name: 'Modifier' }))
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    expect(within(dialog).getByRole('button', { name: 'Modifier' })).toBeInTheDocument()
    expect(server.bodiesSent('PATCH')).toEqual([])
  })

  it("refuse un titre vide sans appeler l'API", async () => {
    const { user, server } = setup('/liste/tickets/2')
    const dialog = await screen.findByRole('dialog', { name: 'Préparer la démo' })

    await user.click(within(dialog).getByRole('button', { name: 'Modifier' }))
    await user.clear(within(dialog).getByLabelText(/Titre/))
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    expect(within(dialog).getByText('Le titre est obligatoire.')).toBeInTheDocument()
    expect(server.bodiesSent('PATCH')).toEqual([])
  })

  it("garde la saisie et affiche un message si l'API refuse la modification", async () => {
    const { user, server } = setup('/liste/tickets/2')
    const dialog = await screen.findByRole('dialog', { name: 'Préparer la démo' })
    await user.click(within(dialog).getByRole('button', { name: 'Modifier' }))
    await user.type(within(dialog).getByLabelText('Assigné'), ' et Romain')

    // La prochaine requête (l'enregistrement) est refusée par l'API
    server.fetchMock.mockImplementationOnce(async () => jsonResponse({ detail: [] }, 422))
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      "Le ticket n'a pas pu être modifié. Le serveur a refusé ces valeurs.",
    )
    expect(within(dialog).getByLabelText('Assigné')).toHaveValue('Élodie et Romain')
  })

  it('Annuler abandonne les changements', async () => {
    const { user, server } = setup('/liste/tickets/2')
    const dialog = await screen.findByRole('dialog', { name: 'Préparer la démo' })

    await user.click(within(dialog).getByRole('button', { name: 'Modifier' }))
    await user.type(within(dialog).getByLabelText(/Titre/), ' modifié')
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }))

    expect(screen.getByRole('dialog', { name: 'Préparer la démo' })).toBeInTheDocument()
    expect(server.bodiesSent('PATCH')).toEqual([])
  })

  it('un clic à côté ne ferme pas la popup pendant une modification', async () => {
    const { user } = setup('/liste/tickets/2')
    const dialog = await screen.findByRole('dialog', { name: 'Préparer la démo' })

    await user.click(within(dialog).getByRole('button', { name: 'Modifier' }))
    await user.click(dialog)

    expect(screen.getByRole('dialog', { name: 'Modifier le ticket' })).toBeInTheDocument()
  })
})
