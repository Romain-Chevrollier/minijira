import './StaleDataNotice.css'

interface StaleDataNoticeProps {
  isStale: boolean
  isRetrying: boolean
  onRetry: () => void
}

/**
 * Bandeau discret : l'écran montre des données qui n'ont pas pu être rechargées.
 * La zone `status` est toujours présente, même vide : les lecteurs d'écran
 * n'annoncent un texte que s'il apparaît dans une zone qui existe déjà.
 */
export function StaleDataNotice({ isStale, isRetrying, onRetry }: StaleDataNoticeProps) {
  return (
    <div className={isStale ? 'stale-notice' : 'visually-hidden'}>
      <p role="status">{isStale && 'Données peut-être pas à jour.'}</p>
      {isStale && (
        <button
          type="button"
          className="button-secondary"
          // Pas `disabled` : le bouton perdrait le focus du clavier pendant l'essai
          aria-disabled={isRetrying}
          onClick={() => {
            if (!isRetrying) onRetry()
          }}
        >
          {isRetrying ? 'Nouvel essai…' : 'Réessayer'}
        </button>
      )}
    </div>
  )
}
