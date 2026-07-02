import { BadgeId } from '../types';

export interface BadgeDef {
  badgeId: BadgeId;
  category: 'Старт' | 'Навчання' | 'Якість' | 'Серія' | 'Камбек';
  name: string;
  icon: string;
  color: string;
  condition: string;
}

export const BADGE_CATALOGUE: BadgeDef[] = [
  {
    badgeId: 'first_report',
    category: 'Старт',
    name: 'Перша перевірка',
    icon: 'fas fa-clipboard-check',
    color: 'text-blue-500',
    condition: 'Отримай перший звіт від таємного покупця',
  },
  {
    badgeId: 'first_perfect',
    category: 'Старт',
    name: 'Без розгону',
    icon: 'fas fa-rocket',
    color: 'text-orange-500',
    condition: 'Перший звіт у системі повинен бути на 100%',
  },
  {
    badgeId: 'honor_student',
    category: 'Навчання',
    name: 'Відмінник',
    icon: 'fas fa-graduation-cap',
    color: 'text-indigo-500',
    condition: 'Виконай план навчання вчасно після отримання анкети',
  },
  {
    badgeId: 'student_of_year',
    category: 'Навчання',
    name: 'Студент року',
    icon: 'fas fa-award',
    color: 'text-purple-500',
    condition: 'Усі плани навчання виконані вчасно за календарний рік',
  },
  {
    badgeId: 'clean_form',
    category: 'Якість',
    name: 'Чиста анкета',
    icon: 'fas fa-shield-halved',
    color: 'text-green-500',
    condition: 'Умова буде оголошена пізніше',
  },
  {
    badgeId: 'silver_guide',
    category: 'Серія',
    name: 'Срібний гід',
    icon: 'fas fa-medal',
    color: 'text-slate-400',
    condition: '2 квартали поспіль на 100% в одному році',
  },
  {
    badgeId: 'gold_series',
    category: 'Серія',
    name: 'Золота серія',
    icon: 'fas fa-medal',
    color: 'text-amber-400',
    condition: '3 квартали поспіль на 100% в одному році',
  },
  {
    badgeId: 'platinum_standard',
    category: 'Серія',
    name: 'Платиновий стандарт',
    icon: 'fas fa-crown',
    color: 'text-sky-400',
    condition: '4 квартали поспіль на 100% в одному році',
  },
  {
    badgeId: 'comeback',
    category: 'Камбек',
    name: 'Зробила висновки',
    icon: 'fas fa-arrow-trend-up',
    color: 'text-emerald-500',
    condition: 'Попередня анкета <85% з виконаним планом навчання → наступна 100%',
  },
];

export const BADGE_CATEGORIES = ['Старт', 'Навчання', 'Якість', 'Серія', 'Камбек'] as const;
export type BadgeCategory = typeof BADGE_CATEGORIES[number];

export const YEARLY_BADGE_IDS = new Set<BadgeId>([
  'silver_guide',
  'gold_series',
  'platinum_standard',
  'student_of_year',
]);
