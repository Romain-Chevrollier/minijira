import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { ApiError } from './api/tickets'
import './index.css'
import App from './App.tsx'

// Gère le chargement et le cache des données de l'API pour toute l'application.
// Appli locale : une seule nouvelle tentative suffit avant d'afficher une erreur,
// et aucune si le ticket n'existe pas (404).
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status === 404) && failureCount < 1,
    },
  },
})

// Routeur « de données » : nécessaire pour retenir une navigation (useBlocker), par exemple
// « Précédent » pendant une modification. Les routes restent décrites dans App.
const router = createBrowserRouter([{ path: '*', element: <App /> }])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
