import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router'

interface RenderOptions {
  /** Adresse de départ dans l'application, "/" par défaut. */
  route?: string
}

/**
 * Affiche un composant avec un QueryClient neuf (sans nouvelle tentative en cas d'erreur)
 * et un routeur en mémoire qui démarre à l'adresse demandée.
 */
export function renderWithQueryClient(ui: ReactElement, { route = '/' }: RenderOptions = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <MemoryRouter initialEntries={[route]}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  )
}

/** Fausse réponse JSON de l'API, pour simuler fetch dans les tests. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
