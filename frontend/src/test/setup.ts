import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Ajoute les vérifications comme toBeInTheDocument() et vide l'écran entre deux tests
afterEach(() => {
  cleanup()
})
