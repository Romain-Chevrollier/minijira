import { useState } from 'react'

import { TicketCreateForm } from './tickets/TicketCreateForm'
import { TicketList } from './tickets/TicketList'

function App() {
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
    </main>
  )
}

export default App
