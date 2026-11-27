import { readJson } from './http'

/** Projet renvoyé par l'API (ProjectRead). */
export interface Project {
  id: number
  key: string
  name: string
  created_at: string
  ticket_count: number
}

/** Projet tel qu'il accompagne chaque ticket (ProjectSummary). */
export type ProjectSummary = Pick<Project, 'id' | 'key' | 'name'>

/** Liste des projets, du plus ancien au plus récent (tri fait par l'API). */
export async function fetchProjects(): Promise<Project[]> {
  const response = await fetch('/api/projects')
  return readJson<Project[]>(response, 'au chargement des projets')
}
