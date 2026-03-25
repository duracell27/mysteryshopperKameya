import { AuditResult } from './types';

export const MOCK_AUDIT: AuditResult = {
  id: 'TK-2024-047',
  date: '15 червня 2024',
  totalScore: 78,
  sections: [
    {
      title: 'Зустріч та перше враження',
      score: 9,
      maxScore: 10,
      feedback:
        'Консультант привітала клієнта з посмішкою та запропонувала допомогу через 30 секунд після входу. Однак не представилась по імені.',
      questions: [
        { question: 'Вітання клієнта протягом 30 секунд', answer: 'Так', isCorrect: true },
        { question: 'Встановлення зорового контакту', answer: 'Так', isCorrect: true },
        {
          question: 'Персональне представлення консультанта',
          answer: 'Ні',
          isCorrect: false,
          comment: 'Не представилась на ім\'я',
        },
      ],
    },
    {
      title: 'Виявлення потреб',
      score: 15,
      maxScore: 25,
      feedback:
        'Консультант задала лише 2 питання замість необхідних 5. Не з\'ясовано привід покупки та бюджет клієнта.',
      questions: [
        {
          question: 'Питання про привід покупки',
          answer: 'Ні',
          isCorrect: false,
          comment: 'Не запитала для кого чи для якого приводу',
        },
        {
          question: 'Питання про бюджет клієнта',
          answer: 'Ні',
          isCorrect: false,
          comment: 'Критично важливе питання для підбору товару',
        },
        { question: 'Питання про вподобання в металі', answer: 'Так', isCorrect: true },
        { question: 'Питання про розмір', answer: 'Так', isCorrect: true },
        {
          question: 'Активне слухання та уточнення',
          answer: 'Частково',
          isCorrect: false,
          comment: 'Перебивала клієнта двічі',
        },
      ],
    },
    {
      title: 'Презентація товару',
      score: 22,
      maxScore: 25,
      feedback:
        'Чудова презентація! Консультант впевнено розповіла про характеристики каміння та показала 3 варіанти.',
      questions: [
        { question: 'Показ 3+ варіантів товару', answer: 'Так', isCorrect: true },
        { question: 'Розповідь про характеристики каміння (4C)', answer: 'Так', isCorrect: true },
        { question: 'Пропозиція приміряти прикраси', answer: 'Так', isCorrect: true },
        {
          question: 'Використання техніки Асоціацій',
          answer: 'Ні',
          isCorrect: false,
          comment: 'Не пов\'язала прикрасу з подією або образом клієнта',
        },
        { question: 'Переваги перед конкурентами', answer: 'Так', isCorrect: true },
      ],
    },
    {
      title: 'Робота з запереченнями',
      score: 11,
      maxScore: 20,
      feedback:
        'Слабке місце. На заперечення "дорого" консультант зразу запропонувала знижку, не використавши жодної техніки.',
      questions: [
        {
          question: 'Техніка Приєднання до заперечення',
          answer: 'Ні',
          isCorrect: false,
          comment: 'Зразу перейшла в захисну позицію',
        },
        {
          question: 'Аргументація цінності товару',
          answer: 'Частково',
          isCorrect: false,
          comment: 'Аргументація слабка, без конкретних фактів',
        },
        { question: 'Пропозиція альтернативного варіанту', answer: 'Так', isCorrect: true },
        { question: 'Збереження позитивного настрою', answer: 'Так', isCorrect: true },
      ],
    },
    {
      title: 'Завершення продажу та прощання',
      score: 9,
      maxScore: 10,
      feedback: 'Гарне завершення. Консультант запропонувала супутні товари та подарункову упаковку.',
      questions: [
        { question: 'Крос-продаж (супутній товар)', answer: 'Так', isCorrect: true },
        {
          question: 'Пропозиція програми лояльності',
          answer: 'Ні',
          isCorrect: false,
          comment: 'Не розповіла про бонусну карту',
        },
        { question: 'Подяка за візит та запрошення повернутись', answer: 'Так', isCorrect: true },
      ],
    },
  ],
};
