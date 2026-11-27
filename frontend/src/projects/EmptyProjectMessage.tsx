/** État vide quand le projet filtré n'a aucun ticket. */
export function EmptyProjectMessage({ name }: { name: string }) {
  return <p className="empty-project">Aucun ticket dans le projet « {name} » pour l'instant.</p>
}
