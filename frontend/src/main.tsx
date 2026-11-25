import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import './index.css'
import App from './App.tsx'
import { createQueryClient } from './query/queryClient'

// Gère le chargement et le cache des données de l'API pour toute l'application
const queryClient = createQueryClient()

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
