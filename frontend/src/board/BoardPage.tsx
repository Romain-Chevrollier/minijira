import { Outlet } from 'react-router'

import { Board } from './Board'

/** Vue Board, à l'adresse / . La popup d'un ticket s'affiche par-dessus (/tickets/:ticketId). */
export function BoardPage() {
  return (
    <>
      <section aria-label="Board">
        <Board />
      </section>

      {/* Emplacement de la popup de détail */}
      <Outlet />
    </>
  )
}
