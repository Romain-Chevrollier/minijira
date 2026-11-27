import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { Ticket } from '../api/tickets'
import { persoKey } from '../test/fixtures'
import App from '../App'
import { jsonResponse, renderWithQueryClient } from '../test/render'
import { mockServer } from '../test/server'

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

const QUESTION = 'Abandonner tes modifications ?'

/** Ouvre le ticket depuis la liste, comme un utilisateur, puis passe en modification. */
async function startEditing({ type = ' modifié' } = {}) {
  const user = userEvent.setup()
  const server = mockServer([ticket])
  const { router } = renderWithQueryClient(<App />, { route: '/liste' })
  await user.click(await screen.findByRole('link', { name: ticket.title }))
  const dialog = await screen.findByRole('dialog', { name: ticket.title })
  await user.click(within(dialog).getByRole('button', { name: 'Modifier' }))
  const title = within(dialog).getByLabelText(/Titre/)
  if (type) await user.type(title, type)
  return { user, server, router, dialog, title }
}

const path = (router: { state: { location: { pathname: string } } }) =>
  router.state.location.pathname

function question() {
  return screen.queryByRole('group', { name: 'Abandonner les modifications' })
}

describe('Fermer la popup pendant une modification', () => {
  it('✕ demande confirmation, avec le focus sur « Continuer la modification »', async () => {
    const { user, router, dialog } = await startEditing()

    await user.click(within(dialog).getByRole('button', { name: 'Fermer' }))

    expect(question()).toHaveTextContent(QUESTION)
    expect(screen.getByRole('button', { name: 'Continuer la modification' })).toHaveFocus()
    expect(screen.getByDisplayValue('Mon ticket modifié')).toBeInTheDocument()
    expect(path(router)).toBe('/liste/tickets/1')
  })

  it('Échap demande confirmation', async () => {
    const { user, router } = await startEditing()

    await user.keyboard('{Escape}')

    expect(question()).toBeInTheDocument()
    expect(path(router)).toBe('/liste/tickets/1')
  })

  it('une autre demande de fermeture du navigateur demande aussi confirmation', async () => {
    const { router, dialog } = await startEditing()

    fireEvent(dialog, new Event('cancel', { cancelable: true }))

    expect(await screen.findByRole('group', { name: 'Abandonner les modifications' })).toBeInTheDocument()
    expect(path(router)).toBe('/liste/tickets/1')
  })

  it('« Précédent » demande confirmation et garde l’adresse du ticket', async () => {
    const { router } = await startEditing()

    await act(async () => router.navigate(-1))

    expect(question()).toBeInTheDocument()
    expect(path(router)).toBe('/liste/tickets/1')
    expect(screen.getByDisplayValue('Mon ticket modifié')).toBeInTheDocument()
  })

  it('« Continuer la modification » garde la saisie et rend le focus au champ', async () => {
    const { user, router, title } = await startEditing()
    await user.keyboard('{Escape}')

    await user.click(screen.getByRole('button', { name: 'Continuer la modification' }))

    expect(question()).not.toBeInTheDocument()
    expect(title).toHaveValue('Mon ticket modifié')
    expect(title).toHaveFocus()
    expect(path(router)).toBe('/liste/tickets/1')
  })

  it('Échap sur la question revient à la modification', async () => {
    const { user, title } = await startEditing()
    await user.keyboard('{Escape}')
    expect(question()).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(question()).not.toBeInTheDocument()
    expect(title).toHaveValue('Mon ticket modifié')
    expect(title).toHaveFocus()
  })

  it('Échap répété ne ferme jamais la popup', async () => {
    const { user } = await startEditing()

    for (let i = 0; i < 5; i++) await user.keyboard('{Escape}')

    expect(question()).toBeInTheDocument()
    expect(screen.getByDisplayValue('Mon ticket modifié')).toBeInTheDocument()
  })

  it('« Abandonner » ferme sans rien enregistrer', async () => {
    const { user, server, router, dialog } = await startEditing()
    await user.click(within(dialog).getByRole('button', { name: 'Fermer' }))

    await user.click(screen.getByRole('button', { name: 'Abandonner' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(path(router)).toBe('/liste')
    expect(server.urlsCalled('PATCH')).toEqual([])
  })

  it('après « Abandonner » sur « Précédent », la vue derrière s’affiche', async () => {
    const { user, router } = await startEditing()
    await act(async () => router.navigate(-1))

    await user.click(screen.getByRole('button', { name: 'Abandonner' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(path(router)).toBe('/liste')
  })

  it('un enregistrement en échec laisse la confirmation active', async () => {
    const { user, server, dialog } = await startEditing()
    server.fetchMock.mockImplementationOnce(async () => jsonResponse({}, 502))
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
    await within(dialog).findByRole('alert')

    await user.click(within(dialog).getByRole('button', { name: 'Fermer' }))

    expect(question()).toBeInTheDocument()
  })
})

describe('Fermer la popup sans saisie à perdre', () => {
  it('sans modification, ✕ ferme tout de suite', async () => {
    const { user, router, dialog } = await startEditing({ type: '' })

    await user.click(within(dialog).getByRole('button', { name: 'Fermer' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(path(router)).toBe('/liste')
  })

  it('une saisie remise comme avant ferme tout de suite', async () => {
    const { user, router, title } = await startEditing()
    await user.clear(title)
    await user.type(title, ticket.title)

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(path(router)).toBe('/liste')
  })

  it('après un enregistrement réussi, ✕ ferme tout de suite', async () => {
    const { user, router, dialog } = await startEditing()
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
    await within(dialog).findByRole('button', { name: 'Modifier' })

    await user.click(within(dialog).getByRole('button', { name: 'Fermer' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(path(router)).toBe('/liste')
  })

  it('« Annuler » abandonne la saisie sans confirmation', async () => {
    const { user, dialog } = await startEditing()

    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }))

    expect(question()).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Modifier' })).toBeInTheDocument()
  })
})

describe('Recharger la page ou fermer l’onglet', () => {
  function leavePage() {
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    // Annulé : le navigateur affiche son message « Quitter le site ? »
    return event.defaultPrevented
  }

  it('le navigateur prévient pendant une modification', async () => {
    await startEditing()

    expect(leavePage()).toBe(true)
  })

  it('le navigateur ne prévient pas sans saisie à perdre', async () => {
    const { user, dialog } = await startEditing()
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
    await within(dialog).findByRole('button', { name: 'Modifier' })

    expect(leavePage()).toBe(false)
  })
})
