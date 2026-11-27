import type { Project, ProjectSummary } from '../api/projects'
import type { Ticket } from '../api/tickets'

/** Le projet créé par défaut par l'API. */
export const PERSO: ProjectSummary = { id: 1, key: 'PERSO', name: 'Personnel' }

/** Projets renvoyés par GET /api/projects dans les tests, du plus ancien au plus récent. */
export const PROJECTS: Project[] = [
  { ...PERSO, created_at: '2026-11-01T12:00:00Z', ticket_count: 0 },
  { id: 2, key: 'MAISON', name: 'Maison', created_at: '2026-11-10T12:00:00Z', ticket_count: 0 },
]

/** Numéro, clé et projet d'un ticket de PERSO : persoKey(12) donne PERSO-12. */
export function persoKey(number: number): Pick<Ticket, 'number' | 'key' | 'project'> {
  return { number, key: `PERSO-${number}`, project: PERSO }
}
