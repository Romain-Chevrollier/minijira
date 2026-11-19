import { describe, expect, it } from 'vitest'

import { formatDate, PRIORITY_LABELS, STATUS_LABELS } from './labels'

describe('labels', () => {
  it('traduit chaque statut en français', () => {
    expect(STATUS_LABELS).toEqual({
      todo: 'À faire',
      in_progress: 'En cours',
      done: 'Terminé',
    })
  })

  it('traduit chaque priorité en français', () => {
    expect(PRIORITY_LABELS).toEqual({
      low: 'Basse',
      medium: 'Moyenne',
      high: 'Haute',
    })
  })

  it('formate une date ISO au format jour/mois/année', () => {
    // Midi UTC : même jour quel que soit le fuseau horaire de la machine
    expect(formatDate('2026-11-18T12:00:00Z')).toBe('18/11/2026')
  })
})
