import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import { jsonResponse, renderWithQueryClient } from './test/render'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App', () => {
  it('affiche le titre MiniJira et la liste des tickets', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([])))

    renderWithQueryClient(<App />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'MiniJira' }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText("Aucun ticket pour l'instant."),
    ).toBeInTheDocument()
  })
})
