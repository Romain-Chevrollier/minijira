import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import App from './App'
import { renderWithQueryClient } from './test/render'
import { mockServer } from './test/server'

describe('App', () => {
  it('affiche le titre MiniJira et la liste des tickets', async () => {
    mockServer()

    renderWithQueryClient(<App />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'MiniJira' }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText("Aucun ticket pour l'instant."),
    ).toBeInTheDocument()
  })

  it('crée un ticket : il apparaît en tête de liste, en « À faire », et le formulaire se ferme', async () => {
    const user = userEvent.setup()
    mockServer()
    renderWithQueryClient(<App />)
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

  it('Annuler referme le formulaire', async () => {
    const user = userEvent.setup()
    const server = mockServer()
    renderWithQueryClient(<App />)

    await user.click(screen.getByRole('button', { name: 'Nouveau ticket' }))
    await user.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(screen.queryByRole('form', { name: 'Nouveau ticket' })).not.toBeInTheDocument()
    expect(server.bodiesSent('POST')).toEqual([])
  })

  it('renvoie vers la liste pour une adresse inconnue', async () => {
    mockServer()

    renderWithQueryClient(<App />, { route: '/nimporte/quoi' })

    expect(
      await screen.findByText("Aucun ticket pour l'instant."),
    ).toBeInTheDocument()
  })
})
