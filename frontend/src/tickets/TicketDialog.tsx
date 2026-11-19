import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState } from 'react'
import type { MouseEvent, ReactNode, SyntheticEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'

import { ApiError, fetchTicket } from '../api/tickets'
import { TicketDetails } from './TicketDetails'
import { TicketEditForm } from './TicketEditForm'
import './TicketDialog.css'

/** "12" -> 12 ; tout ce qui n'est pas un entier positif ("abc", "0", "1.5") -> null. */
function parseTicketId(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null
  const id = Number(value)
  return id > 0 ? id : null
}

/**
 * Popup de détail d'un ticket, affichée par-dessus la liste à l'adresse /tickets/:ticketId.
 * Elle se ferme avec ✕, Échap, un clic à côté (hors modification) ou « Précédent ».
 */
export function TicketDialog() {
  const { ticketId } = useParams()
  const id = parseTicketId(ticketId)
  const navigate = useNavigate()
  const location = useLocation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [isEditing, setIsEditing] = useState(false)

  const query = useQuery({
    queryKey: ['tickets', id],
    queryFn: () => fetchTicket(id as number),
    enabled: id !== null,
  })

  // Ouvre la popup en mode « modal » : le reste de la page est inactif derrière
  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])

  function close() {
    // Ouverte depuis la liste : on revient en arrière, comme le bouton « Précédent ».
    // Ouverte directement par son adresse : on va sur la liste.
    if ((location.state as { fromList?: boolean } | null)?.fromList) {
      navigate(-1)
    } else {
      navigate('/', { replace: true })
    }
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    // Échap : on ferme nous-mêmes, pour que l'adresse revienne aussi à la liste
    event.preventDefault()
    close()
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    // Un clic sur le fond (et non sur le contenu) ferme, sauf pendant une modification
    if (event.target === event.currentTarget && !isEditing) {
      close()
    }
  }

  const isNotFound =
    id === null || (query.error instanceof ApiError && query.error.status === 404)

  let heading: string
  let body: ReactNode
  if (isNotFound) {
    heading = 'Ticket introuvable'
    body = (
      <>
        <p>Ce ticket n'existe pas ou a été supprimé.</p>
        <div className="form-actions">
          <button type="button" className="button-secondary" onClick={close}>
            Fermer
          </button>
        </div>
      </>
    )
  } else if (query.isPending) {
    heading = 'Ticket'
    body = <p role="status">Chargement du ticket…</p>
  } else if (query.isError) {
    heading = 'Ticket'
    body = (
      <div role="alert" className="ticket-dialog-error">
        <p>Impossible de charger le ticket.</p>
        <button
          type="button"
          className="button-secondary"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          Réessayer
        </button>
      </div>
    )
  } else if (isEditing) {
    heading = 'Modifier le ticket'
    body = <TicketEditForm ticket={query.data} onDone={() => setIsEditing(false)} />
  } else {
    heading = query.data.title
    body = (
      <TicketDetails
        ticket={query.data}
        onEdit={() => setIsEditing(true)}
        onDeleted={close}
      />
    )
  }

  return (
    <dialog
      ref={dialogRef}
      className="ticket-dialog"
      aria-labelledby={titleId}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
    >
      <div className="ticket-dialog-content">
        <header className="ticket-dialog-header">
          <h2 id={titleId}>{heading}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Fermer"
            onClick={close}
          >
            ✕
          </button>
        </header>
        {body}
      </div>
    </dialog>
  )
}
