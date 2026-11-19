import { Navigate, Route, Routes } from 'react-router'

import { TicketDialog } from './tickets/TicketDialog'
import { TicketsPage } from './tickets/TicketsPage'

function App() {
  return (
    <Routes>
      {/* La liste reste affichée derrière la popup de détail d'un ticket */}
      <Route path="/" element={<TicketsPage />}>
        <Route path="tickets/:ticketId" element={<TicketDialog />} />
      </Route>
      {/* Adresse inconnue : retour à la liste */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
