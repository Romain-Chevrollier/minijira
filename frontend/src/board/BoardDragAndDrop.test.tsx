import { focusManager } from '@tanstack/react-query'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Ticket } from '../api/tickets'
import App from '../App'
import { jsonResponse, renderWithQueryClient } from '../test/render'
import { mockServer } from '../test/server'
import { BOARD_STATUSES } from './boardColumns'

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
    title: 'Écrire la doc',
    description: null,
    priority: 'medium',
    assignee: null,
    status: 'in_progress',
    created_at: '2026-11-05T12:00:00Z',
  },
]

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  }
}

/**
 * jsdom ne calcule pas la mise en page : on donne à chaque colonne et à chaque carte
 * une position fictive (3 colonnes de 300 px côte à côte), pour que dnd-kit sache
 * au-dessus de quelle colonne se trouve la carte.
 */
function fakeLayout(this: Element): DOMRect {
  if (this.matches('.ticket-card-preview') || this.querySelector('.ticket-card-preview')) {
    // Copie de la carte qui suit le pointeur : même taille qu'une carte
    return rect(0, 0, 276, 60)
  }
  const column = this.closest<HTMLElement>('[data-status]')
  if (!column) return rect(0, 0, 0, 0)
  const left = BOARD_STATUSES.indexOf(column.dataset.status as Ticket['status']) * 320
  if (this === column) return rect(left, 0, 300, 600)
  const cards = Array.from(column.querySelectorAll('.ticket-card'))
  return rect(left + 12, 60 + cards.indexOf(this) * 70, 276, 60)
}

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(fakeLayout)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function column(name: 'À faire' | 'En cours' | 'Terminé') {
  return screen.getByRole('region', { name })
}

function cardTitles(name: 'À faire' | 'En cours' | 'Terminé') {
  return Array.from(column(name).querySelectorAll('.ticket-card-title')).map(
    (title) => title.textContent,
  )
}

/** Remplace la réponse de l'API au PATCH, le reste du faux serveur ne change pas. */
function onPatch(server: ReturnType<typeof mockServer>, respond: () => Promise<Response>) {
  const original = server.fetchMock.getMockImplementation()!
  server.fetchMock.mockImplementation((input, init) =>
    init?.method === 'PATCH' ? respond() : original(input, init),
  )
}

async function setup() {
  const user = userEvent.setup()
  const server = mockServer(tickets)
  renderWithQueryClient(<App />)
  await screen.findByRole('region', { name: 'À faire' })
  return { user, server }
}

/** Au clavier : Espace prend la carte, les flèches la déplacent, puis `drop` la lâche. */
async function dragWithKeyboard(
  user: ReturnType<typeof userEvent.setup>,
  title: string,
  arrows: string,
  drop = '[Space]',
) {
  screen.getByRole('link', { name: new RegExp(title) }).focus()
  await user.keyboard('[Space]')
  await user.keyboard(arrows)
  await user.keyboard(drop)
}

describe('Glisser-déposer au clavier', () => {
  it('déplacer une carte dans une autre colonne envoie seulement le nouveau statut', async () => {
    const { user, server } = await setup()

    await dragWithKeyboard(user, 'Installer le projet', '[ArrowRight]')

    await waitFor(() => expect(cardTitles('En cours')).toContain('Installer le projet'))
    expect(cardTitles('À faire')).toEqual([])
    expect(server.urlsCalled('PATCH')).toEqual(['/api/tickets/1'])
    expect(server.bodiesSent('PATCH')).toEqual([{ status: 'in_progress' }])
  })

  it('deux flèches vont deux colonnes plus loin, et Entrée lâche aussi la carte', async () => {
    const { user, server } = await setup()

    await dragWithKeyboard(user, 'Installer le projet', '[ArrowRight][ArrowRight]', '[Enter]')

    await waitFor(() => expect(cardTitles('Terminé')).toEqual(['Installer le projet']))
    expect(server.bodiesSent('PATCH')).toEqual([{ status: 'done' }])
    // Entrée a lâché la carte sans ouvrir la popup
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('la carte change de colonne avant la réponse de l’API', async () => {
    const { user, server } = await setup()
    let answer: (response: Response) => void = () => {}
    onPatch(server, () => new Promise((resolve) => (answer = resolve)))

    await dragWithKeyboard(user, 'Écrire la doc', '[ArrowLeft]')

    // L'API n'a pas encore répondu : la carte est déjà dans « À faire »
    await waitFor(() => expect(cardTitles('À faire')).toContain('Écrire la doc'))
    expect(cardTitles('En cours')).toEqual([])

    answer(jsonResponse({ ...tickets[1], status: 'todo' }))
    await waitFor(() => expect(server.urlsCalled('GET')).toContain('/api/tickets'))
  })

  it("si l'API échoue, la carte revient dans sa colonne et un message l'indique", async () => {
    const { user, server } = await setup()
    onPatch(server, async () => jsonResponse({ detail: 'Erreur' }, 500))

    await dragWithKeyboard(user, 'Installer le projet', '[ArrowRight]')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'Impossible de déplacer « Installer le projet ». La carte a été remise à sa place.',
    )
    expect(cardTitles('À faire')).toEqual(['Installer le projet'])
    expect(cardTitles('En cours')).toEqual(['Écrire la doc'])

    await user.click(within(alert).getByRole('button', { name: 'Fermer le message' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('backend injoignable : le board garde ses cartes et affiche le message sans attendre', async () => {
    const { user, server } = await setup()
    // Le PATCH échoue, et le rechargement qui suit ne répond jamais
    server.fetchMock.mockImplementation((_input, init) =>
      init?.method === 'PATCH'
        ? Promise.resolve(jsonResponse({ detail: 'Bad Gateway' }, 502))
        : new Promise<Response>(() => {}),
    )

    await dragWithKeyboard(user, 'Installer le projet', '[ArrowRight]')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impossible de déplacer « Installer le projet ».',
    )
    await waitFor(() => expect(server.urlsCalled('GET')).toHaveLength(2))
    expect(cardTitles('À faire')).toEqual(['Installer le projet'])
    expect(cardTitles('En cours')).toEqual(['Écrire la doc'])
  })

  it('déplacer une carte ne cache pas un rechargement en échec, même en changeant de vue', async () => {
    const { user, server } = await setup()
    const original = server.fetchMock.getMockImplementation()!
    let answerPatch: (response: Response) => void = () => {}
    // Les lectures échouent ; le PATCH attend qu'on lui réponde
    server.fetchMock.mockImplementation((input, init) => {
      if (init?.method === 'PATCH') return new Promise((resolve) => (answerPatch = resolve))
      if (String(input) === '/api/tickets') return Promise.resolve(jsonResponse({}, 502))
      return original(input, init)
    })
    act(() => {
      focusManager.setFocused(false)
      focusManager.setFocused(true)
    })
    await screen.findByText('Données peut-être pas à jour.')

    await dragWithKeyboard(user, 'Installer le projet', '[ArrowRight]')
    await waitFor(() => expect(cardTitles('En cours')).toContain('Installer le projet'))
    expect(screen.getByText('Données peut-être pas à jour.')).toBeInTheDocument()

    // La liste s'affiche avant que son propre rechargement ait pu échouer
    server.fetchMock.mockImplementation(() => new Promise<Response>(() => {}))
    const tabs = screen.getByRole('navigation', { name: 'Vues' })
    await user.click(within(tabs).getByRole('link', { name: 'Liste' }))
    expect(screen.getByText('Données peut-être pas à jour.')).toBeInTheDocument()

    await act(async () => answerPatch(jsonResponse({ ...tickets[0], status: 'in_progress' })))
    expect(screen.getByText('Données peut-être pas à jour.')).toBeInTheDocument()
  })

  it("lâcher la carte dans sa propre colonne ne change rien et n'appelle pas l'API", async () => {
    const { user, server } = await setup()

    // → puis ← : la carte revient au-dessus de sa colonne avant d'être lâchée
    await dragWithKeyboard(user, 'Installer le projet', '[ArrowRight][ArrowLeft]')

    expect(cardTitles('À faire')).toEqual(['Installer le projet'])
    expect(server.urlsCalled('PATCH')).toEqual([])
  })

  it("Échap annule le déplacement sans appeler l'API", async () => {
    const { user, server } = await setup()

    await dragWithKeyboard(user, 'Installer le projet', '[ArrowRight]', '[Escape]')

    expect(cardTitles('À faire')).toEqual(['Installer le projet'])
    expect(cardTitles('En cours')).toEqual(['Écrire la doc'])
    expect(server.urlsCalled('PATCH')).toEqual([])
  })

  it('la colonne survolée est mise en évidence pendant le déplacement', async () => {
    const { user } = await setup()
    screen.getByRole('link', { name: /Installer le projet/ }).focus()

    await user.keyboard('[Space][ArrowRight]')

    await waitFor(() => expect(column('En cours')).toHaveClass('board-column-over'))
    expect(column('À faire')).not.toHaveClass('board-column-over')

    await user.keyboard('[Escape]')
    expect(column('En cours')).not.toHaveClass('board-column-over')
  })

  it('la liste reflète le nouveau statut', async () => {
    const { user } = await setup()

    await dragWithKeyboard(user, 'Installer le projet', '[ArrowRight][ArrowRight]')
    await waitFor(() => expect(cardTitles('Terminé')).toEqual(['Installer le projet']))

    const tabs = screen.getByRole('navigation', { name: 'Vues' })
    await user.click(within(tabs).getByRole('link', { name: 'Liste' }))

    const row = (await screen.findByRole('link', { name: 'Installer le projet' })).closest('tr')!
    expect(within(row).getByText('Terminé')).toBeInTheDocument()
  })
})
