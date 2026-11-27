import { Navigate, Route, Routes } from 'react-router'

import { AppLayout } from './AppLayout'
import { BoardPage } from './board/BoardPage'
import { ProjectsPage } from './projects/ProjectsPage'
import { ListPage } from './tickets/ListPage'
import { TicketDialog } from './tickets/TicketDialog'

function App() {
  return (
    <Routes>
      {/* Titre, onglets et création d'un ticket communs à tous les écrans */}
      <Route element={<AppLayout />}>
        {/* Chaque vue reste affichée derrière la popup de détail d'un ticket */}
        <Route path="/" element={<BoardPage />}>
          <Route path="tickets/:ticketId" element={<TicketDialog />} />
        </Route>
        <Route path="liste" element={<ListPage />}>
          <Route path="tickets/:ticketId" element={<TicketDialog />} />
        </Route>
        <Route path="projets" element={<ProjectsPage />} />
      </Route>
      {/* Adresse inconnue : retour au board */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
