import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// findBy… et waitFor attendent l'écran jusqu'à 5 s (1 s par défaut). Un test lent
// prend environ 0,5 s : 1 s ne laissait pas de marge sur un ordinateur occupé (CI…).
// Un test qui passe n'est pas ralenti : l'attente s'arrête dès que l'écran est prêt.
configure({ asyncUtilTimeout: 5000 })

// jsdom ne sait pas encore ouvrir les popups <dialog> : version minimale pour les tests.
// Le vrai comportement (Échap, focus, fond assombri) est vérifié dans un navigateur.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function close() {
    if (!this.open) return
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
}

// Ajoute les vérifications comme toBeInTheDocument(), vide l'écran entre deux tests
// et remet le vrai fetch après les tests qui le simulent
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
