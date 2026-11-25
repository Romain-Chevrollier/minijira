import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'

import { createQueryClient } from '../query/queryClient'

interface RenderOptions {
  /** Adresse de départ dans l'application, "/" par défaut. */
  route?: string
}

/**
 * Affiche un composant avec un QueryClient neuf, réglé comme celui de l'application mais
 * sans nouvelle tentative en cas d'erreur, et un routeur en mémoire qui démarre à l'adresse demandée (le même type de routeur
 * que l'application). `router` permet de simuler « Précédent » : router.navigate(-1).
 */
export function renderWithQueryClient(ui: ReactElement, { route = '/' }: RenderOptions = {}) {
  const queryClient = createQueryClient({ retries: 0 })
  const router = createMemoryRouter([{ path: '*', element: ui }], { initialEntries: [route] })
  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { ...result, router }
}

/** Fausse réponse JSON de l'API, pour simuler fetch dans les tests. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
