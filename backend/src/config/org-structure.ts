export const ORG_STRUCTURE = {
  stores: {
    label: 'Магазини',
    groups: {
      store_1:  'Арсен',
      store_2:  'Бельведерська',
      store_3:  'Галицька',
      store_4:  'Галич',
      store_5:  'Коломия',
      store_6:  'Надвірна золото',
      store_7:  'Надвірна срібло',
      store_8:  'Цум',
      store_9:  'Шашкевича',
      store_10: 'Шпитальна',
      store_11: 'Магазин 11',
    },
    positions: ['Керівник', 'Консультант', 'Початківець консультант'],
  },
  office: {
    label: 'Офіс',
    groups: {
      marketing:  'Маркетинг',
      accounting: 'Бухгалтерія',
      supply:     'Постачання',
      hr:         'HR',
      it:         'IT',
      management: 'Керівник',
    },
    positions: ['Співробітник', 'Керівник'],
  },
  security: {
    label: 'Охорона',
    groups: {
      staff:      'Охоронці',
      management: 'Керівник',
    },
    positions: ['Охоронець', 'Керівник'],
  },
} as const;

export type Division = keyof typeof ORG_STRUCTURE;
export type GroupKey<D extends Division> = keyof typeof ORG_STRUCTURE[D]['groups'];

export function getDivisionLabel(division: string): string {
  return (ORG_STRUCTURE as Record<string, { label: string }>)[division]?.label ?? division;
}

export function getGroupLabel(division: string, group: string): string {
  const groups = (ORG_STRUCTURE as Record<string, { groups: Record<string, string> }>)[division]?.groups;
  return groups?.[group] ?? group;
}

export function isValidOrg(division: string, group: string, position: string): boolean {
  const div = (ORG_STRUCTURE as Record<string, { groups: Record<string, string>; positions: readonly string[] }>)[division];
  if (!div) return false;
  if (!div.groups[group]) return false;
  if (!div.positions.includes(position)) return false;
  return true;
}
