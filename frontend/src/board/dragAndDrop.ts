import {
  KeyboardCode,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type {
  Active,
  Announcements,
  KeyboardCodes,
  KeyboardCoordinateGetter,
  Over,
  ScreenReaderInstructions,
  UniqueIdentifier,
} from '@dnd-kit/core'

import type { Ticket, TicketStatus } from '../api/tickets'
import { STATUS_LABELS } from '../tickets/labels'
import { BOARD_STATUSES } from './boardColumns'

/** Données attachées à une carte qu'on glisse. */
export interface CardData {
  ticket: Ticket
}

/** Un changement de statut à envoyer à l'API. */
export interface TicketMove {
  ticket: Ticket
  status: TicketStatus
}

function isBoardStatus(id: UniqueIdentifier | undefined): id is TicketStatus {
  return BOARD_STATUSES.includes(id as TicketStatus)
}

function draggedTicket(active: Pick<Active, 'data'> | null): Ticket | undefined {
  return (active?.data.current as CardData | undefined)?.ticket
}

/**
 * Décide ce que donne un lâcher : un changement de statut si la carte arrive
 * dans une autre colonne ; rien (null) sur sa propre colonne ou hors du board.
 */
export function getMove(
  active: Pick<Active, 'data'>,
  over: Pick<Over, 'id'> | null,
): TicketMove | null {
  const ticket = draggedTicket(active)
  const status = over?.id
  if (!ticket || !isBoardStatus(status) || status === ticket.status) return null
  return { ticket, status }
}

/**
 * Touches du clavier : Espace prend la carte, Espace ou Entrée la lâche, Échap annule.
 * Entrée ne prend pas la carte : elle reste réservée à l'ouverture de la popup.
 */
export const KEYBOARD_CODES: KeyboardCodes = {
  start: [KeyboardCode.Space],
  cancel: [KeyboardCode.Esc],
  end: [KeyboardCode.Space, KeyboardCode.Enter, KeyboardCode.Tab],
}

/** → et ↓ : colonne suivante ; ← et ↑ : colonne précédente (↓ ↑ pour les colonnes empilées). */
const STEP_BY_KEY: Partial<Record<string, 1 | -1>> = {
  [KeyboardCode.Right]: 1,
  [KeyboardCode.Down]: 1,
  [KeyboardCode.Left]: -1,
  [KeyboardCode.Up]: -1,
}

/** Au clavier, une flèche fait sauter la carte au milieu de la colonne voisine. */
export const columnCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  const step = STEP_BY_KEY[event.code]
  if (!step) return undefined
  event.preventDefault()

  const overId = context.over?.id
  const current = isBoardStatus(overId) ? overId : draggedTicket(context.active)?.status
  if (!current) return undefined
  const target = BOARD_STATUSES[BOARD_STATUSES.indexOf(current) + step]
  if (!target) return undefined // déjà dans la première ou la dernière colonne

  const column = context.droppableRects.get(target)
  const card = context.collisionRect
  if (!column || !card) return undefined
  // Coin haut-gauche de la carte : centrée horizontalement, sous le titre de la colonne
  return {
    x: column.left + (column.width - card.width) / 2,
    y: column.top + 48,
  }
}

/**
 * Souris : le glissement démarre après 5 px, un simple clic ouvre donc la popup.
 * Doigt : appui de 0,2 s avant de glisser, pour pouvoir faire défiler la page.
 */
export function useBoardSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, {
      keyboardCodes: KEYBOARD_CODES,
      coordinateGetter: columnCoordinates,
    }),
  )
}

/** « PERSO-12 « Préparer la démo » » : la clé, puis le titre. */
export function ticketLabel(ticket: Pick<Ticket, 'key' | 'title'>): string {
  return `${ticket.key} « ${ticket.title} »`
}

function cardName(active: Pick<Active, 'data'>): string {
  const ticket = draggedTicket(active)
  return `Carte ${ticket ? ticketLabel(ticket) : ''}`
}

function columnName(id: UniqueIdentifier | undefined): string {
  return isBoardStatus(id) ? STATUS_LABELS[id] : ''
}

/** Ce que les lecteurs d'écran annoncent pendant un déplacement, en français. */
export const ANNOUNCEMENTS: Announcements = {
  onDragStart: ({ active }) =>
    `${cardName(active)} saisie, dans la colonne ${columnName(draggedTicket(active)?.status)}.`,
  onDragOver: ({ active, over }) =>
    over
      ? `${cardName(active)} au-dessus de la colonne ${columnName(over.id)}.`
      : `${cardName(active)} hors des colonnes.`,
  onDragEnd: ({ active, over }) =>
    getMove(active, over)
      ? `${cardName(active)} déposée dans ${columnName(over?.id)}.`
      : `${cardName(active)} reposée à sa place, sans changement.`,
  onDragCancel: ({ active }) => `Déplacement annulé. ${cardName(active)} reste à sa place.`,
}

export const SCREEN_READER_INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    'Entrée ouvre le ticket. Pour changer son statut, appuyez sur Espace, ' +
    'changez de colonne avec les flèches, puis appuyez sur Espace ou Entrée pour déposer la carte. ' +
    'Échap annule.',
}
