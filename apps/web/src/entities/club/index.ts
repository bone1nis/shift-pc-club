import type { Catalog } from '@shift/contracts'
import { api } from '@fsd/shared/api'
export const getCatalog = () => api<Catalog>('/api/club/catalog')
export { useClubProfile } from './model/useClubProfile'
export type { Catalog, ClubProfile, Workstation, Zone, Tariff } from '@shift/contracts'
