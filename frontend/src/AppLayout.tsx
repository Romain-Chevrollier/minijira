import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, Outlet, useMatch } from 'react-router'
import type { To } from 'react-router'

import { ProjectFilter } from './projects/ProjectFilter'
import { PROJECT_PARAM, useProjectFilter } from './projects/useProjectFilter'
import { TicketCreateForm } from './tickets/TicketCreateForm'
import './AppLayout.css'

/**
 * Mise en page commune : titre, onglets Board / Liste / Projets et création d'un ticket.
 * L'écran choisi (et sa popup éventuelle) s'affiche en dessous.
 */
export function AppLayout() {
  const [isCreating, setIsCreating] = useState(false)
  // /liste et /liste/tickets/12 : vue Liste ; /projets : Projets ; tout le reste : Board
  const isListView = useMatch('/liste/*') !== null
  const isProjectsView = useMatch('/projets/*') !== null
  const { projectKey } = useProjectFilter()
  // Board et Liste gardent le filtre d'un onglet à l'autre
  const filterSearch = projectKey ? `?${new URLSearchParams({ [PROJECT_PARAM]: projectKey })}` : ''

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

      {/* De vrais liens : chaque vue a son adresse (Précédent, nouvel onglet…) */}
      <div className="view-bar">
        <nav className="view-tabs" aria-label="Vues">
          <ViewTab to={{ pathname: '/', search: filterSearch }} isActive={!isListView && !isProjectsView}>
            Board
          </ViewTab>
          <ViewTab to={{ pathname: '/liste', search: filterSearch }} isActive={isListView}>
            Liste
          </ViewTab>
          {/* L'écran Projets ne filtre rien : le filtre n'y est pas emporté */}
          <ViewTab to="/projets" isActive={isProjectsView}>
            Projets
          </ViewTab>
        </nav>
        {!isProjectsView && <ProjectFilter />}
      </div>

      {isCreating && (
        <TicketCreateForm
          // Le projet filtré est proposé pour le nouveau ticket
          preferredProjectKey={projectKey}
          onCreated={() => setIsCreating(false)}
          onCancel={() => setIsCreating(false)}
        />
      )}

      <Outlet />
    </main>
  )
}

interface ViewTabProps {
  to: To
  isActive: boolean
  children: ReactNode
}

function ViewTab({ to, isActive, children }: ViewTabProps) {
  return (
    <Link
      to={to}
      className="view-tab"
      // Signale l'onglet actif aux lecteurs d'écran (et sert au style)
      aria-current={isActive ? 'page' : undefined}
    >
      {children}
    </Link>
  )
}
