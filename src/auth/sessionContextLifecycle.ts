export function canReuseSessionContext(
  loadedUserId: string | null,
  nextUserId: string | null,
) {
  return Boolean(nextUserId && loadedUserId === nextUserId)
}
