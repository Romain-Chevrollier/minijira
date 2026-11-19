import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Ticket } from '../api/tickets'
import { jsonResponse, renderWithQueryClient } from '../test/render'
import { TicketCreateForm } from './TicketCreateForm'

const createdTicket: Ticket = {
  id: 7,
  title: 'Préparer la démo',
  description: null,
  priority: 'high',
  assignee: 'Romain',
  status: 'todo',
  created_at: '2026-11-19T12:00:00Z',
}

const fetchMock = vi.fn<typeof fetch>()
const onCreated = vi.fn()
const onCancel = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  fetchMock.mockReset()
  onCreated.mockReset()
  onCancel.mockReset()
  vi.unstubAllGlobals()
})

function renderForm() {
  renderWithQueryClient(
    <TicketCreateForm onCreated={onCreated} onCancel={onCancel} />,
  )
}

describe('TicketCreateForm', () => {
  it('propose la priorité Moyenne par défaut', () => {
    renderForm()

    expect(screen.getByLabelText('Priorité')).toHaveValue('medium')
  })

  it("envoie les valeurs nettoyées à l'API puis signale la création", async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValueOnce(jsonResponse(createdTicket, 201))
    renderForm()

    await user.type(screen.getByLabelText(/Titre/), '  Préparer la démo  ')
    await user.selectOptions(screen.getByLabelText('Priorité'), 'Haute')
    await user.type(screen.getByLabelText('Assigné'), ' Romain ')
    await user.click(screen.getByRole('button', { name: 'Créer' }))

    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce())
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/tickets')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({
      title: 'Préparer la démo',
      description: null,
      priority: 'high',
      assignee: 'Romain',
    })
  })

  it.each(['', '   '])(
    "n'envoie rien et affiche une erreur si le titre est vide (%j)",
    async (title) => {
      const user = userEvent.setup()
      renderForm()

      const titleInput = screen.getByLabelText(/Titre/)
      if (title) await user.type(titleInput, title)
      await user.click(screen.getByRole('button', { name: 'Créer' }))

      expect(screen.getByText('Le titre est obligatoire.')).toBeInTheDocument()
      expect(titleInput).toHaveAttribute('aria-invalid', 'true')
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it("efface l'erreur du titre dès qu'on le corrige", async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByRole('button', { name: 'Créer' }))
    await user.type(screen.getByLabelText(/Titre/), 'Un titre')

    expect(screen.queryByText('Le titre est obligatoire.')).not.toBeInTheDocument()
  })

  it("limite la saisie du titre à 200 caractères et de l'assigné à 100", () => {
    renderForm()

    expect(screen.getByLabelText(/Titre/)).toHaveAttribute('maxLength', '200')
    expect(screen.getByLabelText('Assigné')).toHaveAttribute('maxLength', '100')
  })

  it("garde la saisie et affiche un message si l'API refuse la création", async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: [] }, 422))
    renderForm()

    await user.type(screen.getByLabelText(/Titre/), 'Préparer la démo')
    await user.click(screen.getByRole('button', { name: 'Créer' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Le ticket n'a pas pu être créé. Le serveur a refusé ces valeurs.",
    )
    expect(screen.getByLabelText(/Titre/)).toHaveValue('Préparer la démo')
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('affiche un message si le serveur ne répond pas', async () => {
    const user = userEvent.setup()
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    renderForm()

    await user.type(screen.getByLabelText(/Titre/), 'Préparer la démo')
    await user.click(screen.getByRole('button', { name: 'Créer' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le serveur ne répond pas.',
    )
    expect(screen.getByLabelText(/Titre/)).toHaveValue('Préparer la démo')
  })

  it("désactive le bouton pendant l'envoi pour éviter les doublons", async () => {
    const user = userEvent.setup()
    fetchMock.mockReturnValueOnce(new Promise(() => {}))
    renderForm()

    await user.type(screen.getByLabelText(/Titre/), 'Préparer la démo')
    await user.click(screen.getByRole('button', { name: 'Créer' }))

    expect(await screen.findByRole('button', { name: 'Création…' })).toBeDisabled()
  })

  it('Annuler referme le formulaire sans rien envoyer', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText(/Titre/), 'Brouillon')
    await user.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(onCancel).toHaveBeenCalledOnce()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
