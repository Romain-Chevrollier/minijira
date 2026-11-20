import { Outlet } from 'react-router'

import { TicketList } from './TicketList'

/** Vue Liste, à l'adresse /liste. La popup d'un ticket s'affiche par-dessus (/liste/tickets/:ticketId). */
export function ListPage() {
  return (
    <>
      <TicketList />

      {/* Emplacement de la popup de détail */}
      <Outlet />
    </>
  )
}
