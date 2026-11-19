import { useState } from 'react'
import { Outlet } from 'react-router'

import { TicketCreateForm } from './TicketCreateForm'
import { TicketList } from './TicketList'

/** Page principale : création et liste des tickets. La popup de détail s'affiche par-dessus. */
export function TicketsPage() {
  const [isCreating, setIsCreating] = useState(false)

  return (
    <main>
      <header className="page-header">
        <h1>MiniJira</h1>
        {!isCreating && (
          <button
            type="button"
            className="button-primary"
            onClick={() => setIsCreating(true)}
          >
            Nouveau ticket
          </button>
        )}
      </header>

      {isCreating && (
        <TicketCreateForm
          onCreated={() => setIsCreating(false)}
          onCancel={() => setIsCreating(false)}
        />
      )}

      <TicketList />

      {/* Emplacement de la popup de détail, quand l'adresse est /tickets/:ticketId */}
      <Outlet />
    </main>
  )
}
