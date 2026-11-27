import { checkResponse, readJson } from './http'

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

/** Crée un projet. ApiError 409 si la clé est déjà prise. */
export async function createProject(payload: { name: string; key: string }): Promise<Project> {
  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return readJson<Project>(response, 'à la création du projet')
}

/** Renomme un projet (la clé ne change jamais). ApiError 404 s'il n'existe plus. */
export async function renameProject(id: number, name: string): Promise<Project> {
  const response = await fetch(`/api/projects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  return readJson<Project>(response, 'au renommage du projet')
}

/** Supprime un projet vide. ApiError 409 s'il contient des tickets ou si c'est le dernier. */
export async function deleteProject(id: number): Promise<void> {
  const response = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
  await checkResponse(response, 'à la suppression du projet')
}
