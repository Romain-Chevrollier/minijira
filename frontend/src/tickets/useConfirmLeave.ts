import { useEffect, useRef } from 'react'
import { useBlocker } from 'react-router'

/**
 * Tant que `hasChanges` est vrai, retient toute navigation qui quitterait le ticket
 * (✕, Échap, « Précédent »…) et fait prévenir le navigateur si on recharge la page
 * ou ferme l'onglet. `isAsking` : une fermeture attend la réponse de l'utilisateur.
 */
export function useConfirmLeave(hasChanges: boolean) {
  // Élément qui avait le focus quand la fermeture a été demandée, pour l'y remettre
  const returnFocusTo = useRef<Element | null>(null)

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    const block = hasChanges && currentLocation.pathname !== nextLocation.pathname
    if (block && returnFocusTo.current === null) {
      returnFocusTo.current = document.activeElement
    }
    return block
  })

  useEffect(() => {
    if (!hasChanges) return
    // Recharger ou fermer l'onglet : le navigateur affiche son message « Quitter le site ? »
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [hasChanges])

  function keepEditing() {
    blocker.reset?.()
    const target = returnFocusTo.current
    returnFocusTo.current = null
    if (target instanceof HTMLElement && target !== document.body) target.focus()
  }

  function leave() {
    returnFocusTo.current = null
    blocker.proceed?.()
  }

  return { isAsking: blocker.state === 'blocked', keepEditing, leave }
}
