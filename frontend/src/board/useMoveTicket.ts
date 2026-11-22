import { useMutation, useQueryClient } from '@tanstack/react-query'

import { updateTicket } from '../api/tickets'
import type { Ticket, TicketStatus } from '../api/tickets'
import type { TicketMove } from './dragAndDrop'

function withStatus(tickets: Ticket[] | undefined, id: number, status: TicketStatus) {
  return tickets?.map((ticket) => (ticket.id === id ? { ...ticket, status } : ticket))
}

/**
 * Change le statut d'un ticket depuis le board.
 * La carte change de colonne tout de suite (mise à jour « optimiste »), sans attendre l'API ;
 * si l'API échoue, elle revient dans sa colonne d'origine.
 */
export function useMoveTicket() {
  const queryClient = useQueryClient()

  return useMutation({
    // Seul le statut est envoyé
    mutationFn: ({ ticket, status }: TicketMove) => updateTicket(ticket.id, { status }),

    onMutate: async ({ ticket, status }) => {
      // Un chargement en cours de la liste ne doit pas écraser le déplacement
      await queryClient.cancelQueries({ queryKey: ['tickets'], exact: true })
      queryClient.setQueryData<Ticket[]>(['tickets'], (tickets) =>
        withStatus(tickets, ticket.id, status),
      )
    },

    onError: (_error, { ticket }) => {
      // Retour à la colonne d'origine (ticket contient le statut d'avant le déplacement)
      queryClient.setQueryData<Ticket[]>(['tickets'], (tickets) =>
        withStatus(tickets, ticket.id, ticket.status),
      )
    },

    // Dans tous les cas, on recharge : liste, board et popup affichent l'état réel.
    // Sans attendre la fin du rechargement : le message d'échec s'affiche tout de suite
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
  })
}
