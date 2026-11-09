'use strict';

/**
 * Worksheets interativas da Novera — páginas ilustradas (emoji) com exercícios
 * corrigidos na hora. Cada página é uma seção:
 *   learn  → cartões para estudar (emoji, palavra, frase)
 *   choose → marque a opção correta para cada figura
 *   match  → ligue cada item da esquerda ao da direita
 *   fill   → complete as frases com as palavras do quadro
 */
const learn = (title, instruction, cards) => ({ kind: 'learn', title, instruction, cards });
const choose = (title, instruction, items) => ({ kind: 'choose', title, instruction, items });
const match = (title, instruction, pairs) => ({ kind: 'match', title, instruction, pairs });
const fill = (title, instruction, bank, sentences) => ({ kind: 'fill', title, instruction, bank, sentences });

module.exports = [
  {
    slug: 'ws-my-daily-routine',
    level: 'A1',
    title: 'My Daily Routine',
    description: 'Ações do dia a dia e horários — 4 páginas.',
    data: {
      theme: 'sunrise',
      cover: '⏰',
      pages: [
        learn('Learn the routine', 'Read and repeat. Click a card to hear it.', [
          { emoji: '⏰', word: 'wake up', example: 'I wake up at 7:00.' },
          { emoji: '🚿', word: 'take a shower', example: 'I take a shower every morning.' },
          { emoji: '🥣', word: 'have breakfast', example: 'I have breakfast with my family.' },
          { emoji: '🚌', word: 'go to school', example: 'I go to school by bus.' },
          { emoji: '📚', word: 'do homework', example: 'I do my homework after lunch.' },
          { emoji: '🛏️', word: 'go to bed', example: 'I go to bed at 10:00.' },
        ]),
        choose('What is she doing?', 'Look at the picture and choose the correct answer.', [
          { emoji: '🚿', options: ['She takes a shower.', 'She goes to bed.', 'She has lunch.'], answer: 0 },
          { emoji: '🥣', options: ['She does homework.', 'She has breakfast.', 'She wakes up.'], answer: 1 },
          { emoji: '🛏️', options: ['She goes to school.', 'She takes a shower.', 'She goes to bed.'], answer: 2 },
          { emoji: '📚', options: ['She does homework.', 'She has dinner.', 'She goes to work.'], answer: 0 },
        ]),
        match('Match the times', 'Match each sentence to the correct clock.', [
          { left: '🕖 I wake up at…', right: 'seven o\'clock' },
          { left: '🕗 School starts at…', right: 'eight o\'clock' },
          { left: '🕛 I have lunch at…', right: 'twelve o\'clock (noon)' },
          { left: '🕙 I go to bed at…', right: 'ten o\'clock' },
        ]),
        fill('Complete my day', 'Use the words in the box.', ['wake', 'have', 'go', 'do', 'watch'], [
          'I [wake] up at seven.',
          'I [have] breakfast at half past seven.',
          'I [go] to school by bus.',
          'In the afternoon, I [do] my homework.',
          'At night, I [watch] TV with my family.',
        ]),
      ],
    },
  },
  {
    slug: 'ws-weather-seasons',
    level: 'A1',
    title: 'Weather and Seasons',
    description: 'Clima, estações e roupas — 4 páginas.',
    data: {
      theme: 'sky',
      cover: '🌦️',
      pages: [
        learn('What\'s the weather like?', 'Learn the weather words.', [
          { emoji: '☀️', word: 'sunny', example: 'It is sunny today.' },
          { emoji: '🌧️', word: 'rainy', example: 'It is rainy. Take an umbrella!' },
          { emoji: '☁️', word: 'cloudy', example: 'The sky is cloudy.' },
          { emoji: '💨', word: 'windy', example: 'It is very windy at the beach.' },
          { emoji: '❄️', word: 'snowy', example: 'It is snowy in the mountains.' },
          { emoji: '⛈️', word: 'stormy', example: 'It is stormy tonight.' },
        ]),
        choose('Choose the weather', 'Look and mark the correct word.', [
          { emoji: '🌧️', options: ['sunny', 'rainy', 'snowy'], answer: 1 },
          { emoji: '❄️', options: ['snowy', 'windy', 'hot'], answer: 0 },
          { emoji: '☀️', options: ['cloudy', 'stormy', 'sunny'], answer: 2 },
          { emoji: '💨', options: ['windy', 'rainy', 'cloudy'], answer: 0 },
        ]),
        match('Seasons and clothes', 'Match each season to what you wear.', [
          { left: '🌸 Spring', right: 'a light jacket' },
          { left: '🏖️ Summer', right: 'shorts and sunglasses' },
          { left: '🍂 Fall', right: 'a sweater' },
          { left: '⛄ Winter', right: 'a coat, a scarf and gloves' },
        ]),
        fill('Complete the sentences', 'Use the words in the box.', ['cold', 'umbrella', 'hot', 'seasons', 'snow'], [
          'There are four [seasons] in a year.',
          'In summer, it is [hot] and sunny.',
          'It is raining. Take an [umbrella].',
          'In winter, it is very [cold].',
          'In some countries, it can [snow] in December.',
        ]),
      ],
    },
  },
  {
    slug: 'ws-at-the-restaurant',
    level: 'A2',
    title: 'At the Restaurant',
    description: 'Pedir, perguntar e pagar num restaurante — 4 páginas.',
    data: {
      theme: 'warm',
      cover: '🍽️',
      pages: [
        learn('Useful phrases', 'Learn what to say at a restaurant.', [
          { emoji: '📋', word: 'Can I see the menu, please?', meaning: 'Pedir o cardápio.' },
          { emoji: '🙋', word: 'I\'d like the chicken, please.', meaning: 'Fazer o pedido.' },
          { emoji: '🥤', word: 'Could I have some water?', meaning: 'Pedir algo para beber.' },
          { emoji: '🌶️', word: 'Is this dish spicy?', meaning: 'Perguntar sobre um prato.' },
          { emoji: '🧾', word: 'Can we have the bill, please?', meaning: 'Pedir a conta.' },
          { emoji: '💳', word: 'Can I pay by card?', meaning: 'Perguntar a forma de pagamento.' },
        ]),
        choose('What do you say?', 'Choose the best sentence for each situation.', [
          { emoji: '🧾', prompt: 'You finished eating and want to pay.', options: ['Can I see the menu?', 'Can we have the bill, please?', 'I\'d like a table for two.'], answer: 1 },
          { emoji: '🪑', prompt: 'You arrive with a friend.', options: ['A table for two, please.', 'Is it spicy?', 'Keep the change.'], answer: 0 },
          { emoji: '🍝', prompt: 'The waiter asks what you want.', options: ['I\'d like the pasta, please.', 'I am a pasta.', 'Give me pasta now.'], answer: 0 },
          { emoji: '🥜', prompt: 'You are allergic to nuts.', options: ['I love nuts!', 'Does this dish have nuts?', 'Where are the nuts?'], answer: 1 },
        ]),
        match('Waiter and customer', 'Match each question to the best answer.', [
          { left: 'Are you ready to order?', right: 'Yes, I\'d like the soup, please.' },
          { left: 'Anything to drink?', right: 'An orange juice, please.' },
          { left: 'How was your meal?', right: 'It was delicious, thank you.' },
          { left: 'Would you like dessert?', right: 'No, thanks. Just the bill.' },
        ]),
        fill('Complete the dialogue', 'Use the words in the box.', ['table', 'menu', 'order', 'bill', 'card'], [
          'Good evening. A [table] for two, please.',
          'Here is the [menu].',
          'Are you ready to [order]?',
          'Can we have the [bill], please?',
          'Can I pay by [card]?',
        ]),
      ],
    },
  },
  {
    slug: 'ws-phrasal-verbs-work',
    level: 'B2',
    title: 'Phrasal Verbs at Work',
    description: 'Phrasal verbs comuns no ambiente profissional — 4 páginas.',
    data: {
      theme: 'violet',
      cover: '💼',
      pages: [
        learn('Six phrasal verbs for the office', 'Read the meaning and the example.', [
          { emoji: '🗓️', word: 'put off', meaning: 'adiar', example: 'We put off the meeting until Monday.' },
          { emoji: '💡', word: 'come up with', meaning: 'ter (uma ideia)', example: 'She came up with a great solution.' },
          { emoji: '🔎', word: 'look into', meaning: 'investigar', example: 'IT will look into the problem.' },
          { emoji: '⛽', word: 'run out of', meaning: 'ficar sem', example: 'We ran out of paper.' },
          { emoji: '🤝', word: 'take over', meaning: 'assumir', example: 'Ana took over the project.' },
          { emoji: '✅', word: 'carry out', meaning: 'realizar', example: 'They carried out a survey.' },
        ]),
        choose('What does it mean?', 'Choose the correct meaning of the phrasal verb.', [
          { emoji: '🗓️', prompt: 'The launch was put off.', options: ['canceled forever', 'postponed', 'finished early'], answer: 1 },
          { emoji: '🔎', prompt: 'We\'ll look into your complaint.', options: ['ignore', 'investigate', 'answer quickly'], answer: 1 },
          { emoji: '🤝', prompt: 'A new manager took over the team.', options: ['left', 'assumed control of', 'criticized'], answer: 1 },
          { emoji: '⛽', prompt: 'The printer ran out of ink.', options: ['had no more', 'got more', 'spilled'], answer: 0 },
        ]),
        match('Match the halves', 'Complete each sentence logically.', [
          { left: 'The committee carried out', right: 'a detailed investigation.' },
          { left: 'Our designer came up with', right: 'a brilliant new logo.' },
          { left: 'Because of the storm, they put off', right: 'the outdoor event.' },
          { left: 'After the director retired, Maria took over', right: 'the whole department.' },
        ]),
        fill('Complete the email', 'Use the phrasal verbs in the box (correct form).', ['look into', 'ran out of', 'come up with', 'put off', 'take over'], [
          'Our team will [look into] the delay and reply by Friday.',
          'We [ran out of] samples, so we ordered more.',
          'Can you [come up with] a plan to reduce costs?',
          'Let\'s [put off] the decision until we have more data.',
          'Who will [take over] the account while Paul is away?',
        ]),
      ],
    },
  },
];
