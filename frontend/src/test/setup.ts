import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

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
