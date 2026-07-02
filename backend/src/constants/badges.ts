export type BadgeId =
  | 'first_report'
  | 'first_perfect'
  | 'honor_student'
  | 'student_of_year'
  | 'clean_form'
  | 'silver_guide'
  | 'gold_series'
  | 'platinum_standard'
  | 'comeback';

export const YEARLY_BADGE_IDS = new Set<BadgeId>([
  'silver_guide',
  'gold_series',
  'platinum_standard',
  'student_of_year',
]);
