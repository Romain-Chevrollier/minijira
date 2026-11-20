import { Link, Outlet } from 'react-router'

/** Vue Board, à l'adresse / . La popup d'un ticket s'affiche par-dessus (/tickets/:ticketId). */
export function BoardPage() {
  return (
    <>
      {/* Contenu provisoire : les colonnes du board Kanban arrivent avec l'issue #40 */}
      <section aria-label="Board">
        <p>
          Le board Kanban arrive bientôt. En attendant, retrouvez vos tickets dans
          l'onglet <Link to="/liste">Liste</Link>.
        </p>
      </section>

      {/* Emplacement de la popup de détail */}
      <Outlet />
    </>
  )
}
