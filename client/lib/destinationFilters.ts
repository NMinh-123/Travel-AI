import type { Destination } from '@shared/types';

export const DESTINATION_CATEGORIES = [
  { id: 'all', label: 'Tất cả' }, { id: 'pass', label: 'Đèo & dốc' },
  { id: 'nature', label: 'Thiên nhiên' }, { id: 'culture', label: 'Văn hóa' },
  { id: 'viewpoint', label: 'Điểm ngắm' }, { id: 'waterfall', label: 'Thác nước' },
] as const;
function normalizeDestinationSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().trim().replace(/\s+/g, ' ');
}
interface DestinationFilters { query: string; category: string; region: string }
export function filterDestinations(items: Destination[], filters: DestinationFilters): Destination[] {
  const query = normalizeDestinationSearch(filters.query);
  return items.filter(d => (filters.category === 'all' || d.category === filters.category) &&
    (filters.region === 'all' || d.district === filters.region) &&
    normalizeDestinationSearch([d.name, d.vietnameseName, d.district, d.description, ...(d.aliases ?? [])].join(' ')).includes(query));
}
