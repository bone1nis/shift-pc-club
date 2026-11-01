/** Роли, которым открыта панель управления клубом. */
export function canUseAdminPanel(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'owner'
}

/** Раздел «Жалобы» (E2E-переписка с владельцем) открыт только владельцу: администратор его не видит. */
export function canUseComplaints(role: string | null | undefined): boolean {
  return role === 'owner'
}
