import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { Project } from '../api/projects'
import type { Ticket } from '../api/tickets'
import { persoKey, PROJECTS } from '../test/fixtures'
import { jsonResponse, renderWithQueryClient } from '../test/render'
import { TicketCreateForm } from './TicketCreateForm'

const createdTicket: Ticket = {
  id: 7,
  ...persoKey(7),
  title: 'Préparer la démo',
  description: null,
  priority: 'high',
  assignee: 'Romain',
  status: 'todo',
  created_at: '2026-11-19T12:00:00Z',
}

const onCreated = vi.fn()
const onCancel = vi.fn()

afterEach(() => {
  onCreated.mockReset()
  onCancel.mockReset()
})

type Route = () => Response | Promise<Response>

/**
 * Remplace fetch : GET /api/projects et POST /api/tickets répondent chacun par leur
 * fonction (par défaut, les projets de test et un ticket créé).
 */
function stubApi({
  projects = () => jsonResponse(PROJECTS),
  createTicket = () => jsonResponse(createdTicket, 201),
}: { projects?: Route; createTicket?: Route } = {}) {
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input)
    if (url === '/api/projects') return projects()
    if (url === '/api/tickets' && init?.method === 'POST') return createTicket()
    throw new Error(`Requête inattendue : ${init?.method ?? 'GET'} ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return {
    /** Corps des créations envoyées à l'API. */
    created: () =>
      fetchMock.mock.calls
        .filter(([, init]) => init?.method === 'POST')
        .map(([, init]) => JSON.parse(String(init?.body)) as unknown),
  }
}

const projectField = () => screen.getByLabelText(/Projet/)
const titleField = () => screen.getByLabelText(/Titre/)

function renderForm() {
  renderWithQueryClient(<TicketCreateForm onCreated={onCreated} onCancel={onCancel} />)
}

/** Affiche le formulaire et attend que les projets soient chargés. */
async function renderLoadedForm() {
  renderForm()
  await waitFor(() => expect(projectField()).toBeEnabled())
}

describe('TicketCreateForm', () => {
  it('propose la priorité Moyenne par défaut', async () => {
    stubApi()
    await renderLoadedForm()

    expect(screen.getByLabelText('Priorité')).toHaveValue('medium')
  })

  it('propose tous les projets et présélectionne le plus ancien', async () => {
    stubApi()
    await renderLoadedForm()

    expect(projectField()).toHaveValue('1')
    expect(projectField()).toBeRequired()
    const options = screen.getAllByRole('option', { name: /\(/ })
    expect(options.map((option) => option.textContent)).toEqual([
      'Personnel (PERSO)',
      'Maison (MAISON)',
    ])
  })

  it("envoie les valeurs nettoyées et le projet à l'API puis signale la création", async () => {
    const user = userEvent.setup()
    const api = stubApi()
    await renderLoadedForm()

    await user.type(titleField(), '  Préparer la démo  ')
    await user.selectOptions(screen.getByLabelText('Priorité'), 'Haute')
    await user.type(screen.getByLabelText('Assigné'), ' Romain ')
    await user.click(screen.getByRole('button', { name: 'Créer' }))

    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce())
    expect(api.created()).toEqual([
      {
        title: 'Préparer la démo',
        description: null,
        priority: 'high',
        assignee: 'Romain',
        project_id: 1,
      },
    ])
  })

  it('envoie le projet choisi', async () => {
    const user = userEvent.setup()
    const api = stubApi()
    await renderLoadedForm()

    await user.selectOptions(projectField(), 'Maison (MAISON)')
    await user.type(titleField(), 'Tondre la pelouse')
    await user.click(screen.getByRole('button', { name: 'Créer' }))

    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce())
    expect(api.created()).toEqual([expect.objectContaining({ project_id: 2 })])
  })

  it('pendant le chargement des projets, on peut écrire mais pas encore créer', async () => {
    const user = userEvent.setup()
    stubApi({ projects: () => new Promise(() => {}) })
    renderForm()

    expect(projectField()).toBeDisabled()
    expect(projectField()).toHaveDisplayValue('Chargement des projets…')
    expect(screen.getByRole('button', { name: 'Créer' })).toBeDisabled()
    await user.type(titleField(), 'Préparer la démo')
    expect(titleField()).toHaveValue('Préparer la démo')
  })

  it('si les projets ne se chargent pas, garde la saisie et propose de réessayer', async () => {
    const user = userEvent.setup()
    let projectsAvailable = false
    stubApi({
      projects: () =>
        projectsAvailable
          ? jsonResponse(PROJECTS)
          : Promise.reject(new TypeError('Failed to fetch')),
    })
    renderForm()
    await user.type(titleField(), 'Préparer la démo')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impossible de charger les projets.',
    )
    expect(projectField()).toHaveDisplayValue('Projets indisponibles')
    expect(screen.getByRole('button', { name: 'Créer' })).toBeDisabled()

    projectsAvailable = true
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))

    await waitFor(() => expect(projectField()).toHaveValue('1'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(titleField()).toHaveValue('Préparer la démo')
    expect(screen.getByRole('button', { name: 'Créer' })).toBeEnabled()
  })

  it('si le projet choisi a été supprimé entre-temps, le dit et garde la saisie', async () => {
    const user = userEvent.setup()
    let projects: Project[] = PROJECTS
    let creations = 0
    const api = stubApi({
      projects: () => jsonResponse(projects),
      createTicket: () => {
        creations += 1
        if (creations === 1) {
          // Maison a été supprimé depuis l'ouverture du formulaire
          projects = [PROJECTS[0]]
          return jsonResponse({ detail: "Le projet 2 n'existe pas" }, 422)
        }
        return jsonResponse(createdTicket, 201)
      },
    })
    await renderLoadedForm()

    await user.selectOptions(projectField(), 'Maison (MAISON)')
    await user.type(titleField(), 'Tondre la pelouse')
    await user.click(screen.getByRole('button', { name: 'Créer' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le projet choisi a été supprimé entre-temps. Choisis un autre projet puis réessaie.',
    )
    expect(screen.getByText("Ce projet n'existe plus. Choisis-en un autre.")).toBeInTheDocument()
    // Aucun autre projet n'est choisi à sa place : il faut en choisir un
    expect(projectField()).toHaveValue('')
    expect(projectField()).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByRole('option', { name: 'Maison (MAISON)' })).not.toBeInTheDocument()
    expect(titleField()).toHaveValue('Tondre la pelouse')
    expect(onCreated).not.toHaveBeenCalled()

    await user.selectOptions(projectField(), 'Personnel (PERSO)')
    expect(screen.queryByText(/Ce projet n'existe plus/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Créer' }))

    await waitFor(() => expect(onCreated).toHaveBeenCalledOnce())
    expect(api.created()).toEqual([
      expect.objectContaining({ project_id: 2 }),
      expect.objectContaining({ title: 'Tondre la pelouse', project_id: 1 }),
    ])
  })

  it.each(['', '   '])(
    "n'envoie rien et affiche une erreur si le titre est vide (%j)",
    async (title) => {
      const user = userEvent.setup()
      const api = stubApi()
      await renderLoadedForm()

      if (title) await user.type(titleField(), title)
      await user.click(screen.getByRole('button', { name: 'Créer' }))

      expect(screen.getByText('Le titre est obligatoire.')).toBeInTheDocument()
      expect(titleField()).toHaveAttribute('aria-invalid', 'true')
      expect(api.created()).toEqual([])
    },
  )

  it("efface l'erreur du titre dès qu'on le corrige", async () => {
    const user = userEvent.setup()
    stubApi()
    await renderLoadedForm()

    await user.click(screen.getByRole('button', { name: 'Créer' }))
    await user.type(titleField(), 'Un titre')

    expect(screen.queryByText('Le titre est obligatoire.')).not.toBeInTheDocument()
  })

  it("limite la saisie du titre à 200 caractères et de l'assigné à 100", () => {
    stubApi()
    renderForm()

    expect(titleField()).toHaveAttribute('maxLength', '200')
    expect(screen.getByLabelText('Assigné')).toHaveAttribute('maxLength', '100')
  })

  it("garde la saisie et affiche un message si l'API refuse les valeurs", async () => {
    const user = userEvent.setup()
    stubApi({ createTicket: () => jsonResponse({ detail: [] }, 422) })
    await renderLoadedForm()

    await user.type(titleField(), 'Préparer la démo')
    await user.click(screen.getByRole('button', { name: 'Créer' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Le ticket n'a pas pu être créé. Le serveur a refusé ces valeurs.",
    )
    // Le projet existe toujours : il reste choisi, sans message sur le champ
    expect(projectField()).toHaveValue('1')
    expect(screen.queryByText(/Ce projet n'existe plus/)).not.toBeInTheDocument()
    expect(titleField()).toHaveValue('Préparer la démo')
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('affiche un message si le serveur ne répond pas', async () => {
    const user = userEvent.setup()
    stubApi({ createTicket: () => Promise.reject(new TypeError('Failed to fetch')) })
    await renderLoadedForm()

    await user.type(titleField(), 'Préparer la démo')
    await user.click(screen.getByRole('button', { name: 'Créer' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Le serveur ne répond pas.')
    expect(titleField()).toHaveValue('Préparer la démo')
  })

  it("désactive le bouton pendant l'envoi pour éviter les doublons", async () => {
    const user = userEvent.setup()
    stubApi({ createTicket: () => new Promise(() => {}) })
    await renderLoadedForm()

    await user.type(titleField(), 'Préparer la démo')
    await user.click(screen.getByRole('button', { name: 'Créer' }))

    expect(await screen.findByRole('button', { name: 'Création…' })).toBeDisabled()
  })

  it('Annuler referme le formulaire sans rien envoyer', async () => {
    const user = userEvent.setup()
    const api = stubApi()
    await renderLoadedForm()

    await user.type(titleField(), 'Brouillon')
    await user.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(onCancel).toHaveBeenCalledOnce()
    expect(api.created()).toEqual([])
  })
})
