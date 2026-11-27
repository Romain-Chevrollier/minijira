import type { ClientRect } from '@dnd-kit/core'
import { describe, expect, it } from 'vitest'

import type { Ticket } from '../api/tickets'
import { persoKey } from '../test/fixtures'
import { ANNOUNCEMENTS, columnCoordinates, getMove, KEYBOARD_CODES } from './dragAndDrop'

const ticket: Ticket = {
  id: 1,
  ...persoKey(1),
  title: 'Installer le projet',
  description: null,
  priority: 'low',
  assignee: null,
  status: 'todo',
  created_at: '2026-11-02T12:00:00Z',
}

const active = { id: 1, data: { current: { ticket } } }

describe('getMove', () => {
  it('lâcher dans une autre colonne donne le nouveau statut', () => {
    expect(getMove(active, { id: 'in_progress' })).toEqual({ ticket, status: 'in_progress' })
    expect(getMove(active, { id: 'done' })).toEqual({ ticket, status: 'done' })
  })

  it('lâcher dans sa propre colonne ne change rien', () => {
    expect(getMove(active, { id: 'todo' })).toBeNull()
  })

  it('lâcher hors du board ne change rien', () => {
    expect(getMove(active, null)).toBeNull()
  })

  it('ignore une zone qui n’est pas une colonne', () => {
    expect(getMove(active, { id: 'ailleurs' })).toBeNull()
  })
})

describe('KEYBOARD_CODES', () => {
  it('Espace prend la carte, mais pas Entrée (réservée à l’ouverture de la popup)', () => {
    expect(KEYBOARD_CODES.start).toEqual(['Space'])
    expect(KEYBOARD_CODES.end).toContain('Enter')
    expect(KEYBOARD_CODES.cancel).toEqual(['Escape'])
  })
})

function rect(left: number, top: number, width: number, height: number): ClientRect {
  return { left, top, width, height, right: left + width, bottom: top + height }
}

/** Contexte minimal du capteur clavier : 3 colonnes côte à côte, carte au-dessus de `over`. */
function moveWith(code: string, over: string | null) {
  const context = {
    active: active,
    over: over ? { id: over } : null,
    collisionRect: rect(12, 60, 276, 60),
    droppableRects: new Map([
      ['todo', rect(0, 0, 300, 600)],
      ['in_progress', rect(320, 0, 300, 600)],
      ['done', rect(640, 0, 300, 600)],
    ]),
  }
  const event = new KeyboardEvent('keydown', { code })
  return columnCoordinates(event, {
    active: 1,
    currentCoordinates: { x: 12, y: 60 },
    context: context as unknown as Parameters<typeof columnCoordinates>[1]['context'],
  })
}

describe('columnCoordinates (flèches du clavier)', () => {
  it('→ et ↓ placent la carte au milieu de la colonne suivante', () => {
    expect(moveWith('ArrowRight', 'todo')).toEqual({ x: 332, y: 48 })
    expect(moveWith('ArrowDown', 'in_progress')).toEqual({ x: 652, y: 48 })
  })

  it('← et ↑ placent la carte dans la colonne précédente', () => {
    expect(moveWith('ArrowLeft', 'done')).toEqual({ x: 332, y: 48 })
    expect(moveWith('ArrowUp', 'in_progress')).toEqual({ x: 12, y: 48 })
  })

  it('part de la colonne du ticket quand la carte ne survole aucune colonne', () => {
    expect(moveWith('ArrowRight', null)).toEqual({ x: 332, y: 48 })
  })

  it('ne bouge pas au-delà de la première ou de la dernière colonne', () => {
    expect(moveWith('ArrowLeft', 'todo')).toBeUndefined()
    expect(moveWith('ArrowRight', 'done')).toBeUndefined()
  })

  it('ignore les autres touches', () => {
    expect(moveWith('KeyA', 'todo')).toBeUndefined()
  })
})

describe('ANNOUNCEMENTS (lecteurs d’écran)', () => {
  it('annonce la prise, le survol et le dépôt en français', () => {
    expect(ANNOUNCEMENTS.onDragStart({ active } as never)).toBe(
      'Carte PERSO-1 « Installer le projet » saisie, dans la colonne À faire.',
    )
    expect(ANNOUNCEMENTS.onDragOver({ active, over: { id: 'done' } } as never)).toBe(
      'Carte PERSO-1 « Installer le projet » au-dessus de la colonne Terminé.',
    )
    expect(ANNOUNCEMENTS.onDragEnd({ active, over: { id: 'in_progress' } } as never)).toBe(
      'Carte PERSO-1 « Installer le projet » déposée dans En cours.',
    )
  })

  it('annonce quand la carte reste à sa place', () => {
    expect(ANNOUNCEMENTS.onDragEnd({ active, over: { id: 'todo' } } as never)).toBe(
      'Carte PERSO-1 « Installer le projet » reposée à sa place, sans changement.',
    )
    expect(ANNOUNCEMENTS.onDragCancel({ active, over: null } as never)).toBe(
      'Déplacement annulé. Carte PERSO-1 « Installer le projet » reste à sa place.',
    )
  })
})
