'use strict';

/**
 * Monte a Frase (ordenar palavras) e Corrigir Textos — conteúdo original da Novera.
 *
 * Corrigir Textos: no texto, cada erro é marcado como [errado|certo].
 * O aluno vê a palavra errada e precisa clicar nela.
 */
const wordOrder = [
  {
    slug: 'order-introductions',
    level: 'A1',
    title: 'Introductions',
    description: 'Apresentações com o verbo to be.',
    data: { sentences: [
      { en: 'My name is Carla.', pt: 'Meu nome é Carla.' },
      { en: 'I am from Brazil.', pt: 'Eu sou do Brasil.' },
      { en: 'She is my best friend.', pt: 'Ela é minha melhor amiga.' },
      { en: 'Are you a teacher?', pt: 'Você é professor?' },
      { en: 'We are not at home.', pt: 'Nós não estamos em casa.' },
      { en: 'How old is your brother?', pt: 'Quantos anos tem seu irmão?' },
    ] },
  },
  {
    slug: 'order-daily-life',
    level: 'A1',
    title: 'Daily Life',
    description: 'Rotina no simple present, com do / does.',
    data: { sentences: [
      { en: 'I drink coffee every morning.', pt: 'Eu tomo café toda manhã.' },
      { en: 'He doesn\'t like vegetables.', pt: 'Ele não gosta de legumes.' },
      { en: 'Do you work on Saturdays?', pt: 'Você trabalha aos sábados?' },
      { en: 'They play soccer after school.', pt: 'Eles jogam futebol depois da aula.' },
      { en: 'My mother cooks dinner at seven.', pt: 'Minha mãe faz o jantar às sete.' },
      { en: 'What time does the class start?', pt: 'Que horas a aula começa?' },
    ] },
  },
  {
    slug: 'order-last-weekend',
    level: 'A2',
    title: 'Last Weekend',
    description: 'Frases no passado e comparações.',
    data: { sentences: [
      { en: 'We visited my aunt last weekend.', pt: 'Visitamos minha tia no fim de semana passado.' },
      { en: 'Did you see the game yesterday?', pt: 'Você viu o jogo ontem?' },
      { en: 'She didn\'t go to the party.', pt: 'Ela não foi à festa.' },
      { en: 'I was very tired after the trip.', pt: 'Eu estava muito cansado depois da viagem.' },
      { en: 'Where did they have lunch?', pt: 'Onde eles almoçaram?' },
      { en: 'The movie was better than the book.', pt: 'O filme foi melhor que o livro.' },
    ] },
  },
  {
    slug: 'order-future-plans',
    level: 'A2',
    title: 'Future Plans',
    description: 'Planos com going to, will e superlativos.',
    data: { sentences: [
      { en: 'I am going to travel next month.', pt: 'Vou viajar no mês que vem.' },
      { en: 'It will probably rain tomorrow.', pt: 'Provavelmente vai chover amanhã.' },
      { en: 'What are you going to do tonight?', pt: 'O que você vai fazer hoje à noite?' },
      { en: 'This is the most beautiful beach in the region.', pt: 'Esta é a praia mais bonita da região.' },
      { en: 'My phone is cheaper than yours.', pt: 'Meu celular é mais barato que o seu.' },
      { en: 'We are meeting our friends at six.', pt: 'Vamos encontrar nossos amigos às seis.' },
    ] },
  },
  {
    slug: 'order-conditionals',
    level: 'B2',
    title: 'Conditionals',
    description: 'Hipóteses, arrependimentos e inversão.',
    data: { sentences: [
      { en: 'If I were you, I would accept the offer.', pt: 'Se eu fosse você, aceitaria a oferta.' },
      { en: 'She would have passed if she had studied harder.', pt: 'Ela teria passado se tivesse estudado mais.' },
      { en: 'Unless it stops raining, the game will be canceled.', pt: 'A menos que pare de chover, o jogo será cancelado.' },
      { en: 'I wish I had more free time.', pt: 'Eu queria ter mais tempo livre.' },
      { en: 'Had I known, I would have called you.', pt: 'Se eu soubesse, teria ligado para você.' },
      { en: 'If we leave now, we will catch the train.', pt: 'Se sairmos agora, pegaremos o trem.' },
    ] },
  },
  {
    slug: 'order-passive-voice',
    level: 'B2',
    title: 'Passive Voice',
    description: 'Voz passiva em vários tempos verbais.',
    data: { sentences: [
      { en: 'The bridge was built in the nineteenth century.', pt: 'A ponte foi construída no século XIX.' },
      { en: 'The results will be announced next week.', pt: 'Os resultados serão anunciados na semana que vem.' },
      { en: 'English is spoken all over the world.', pt: 'Inglês é falado no mundo todo.' },
      { en: 'The report has already been sent to the manager.', pt: 'O relatório já foi enviado ao gerente.' },
      { en: 'The thief was caught by the police.', pt: 'O ladrão foi pego pela polícia.' },
      { en: 'New rules are being discussed by the board.', pt: 'Novas regras estão sendo discutidas pela diretoria.' },
    ] },
  },
];

const textCorrection = [
  {
    slug: 'fix-best-friend',
    level: 'A1',
    title: 'My Best Friend',
    description: 'Verb to be e simple present.',
    data: { text: 'My best friend [are|is] called Julia. She [have|has] long brown hair and green eyes. Julia [work|works] in a bookstore near my house. On weekends, we [goes|go] to the park together. She [don\'t|doesn\'t] like coffee, but she loves tea.' },
  },
  {
    slug: 'fix-my-bedroom',
    level: 'A1',
    title: 'My Bedroom',
    description: 'There is / there are e concordância.',
    data: { text: 'My bedroom [are|is] small but cozy. There [is|are] two windows and a big bed. My books [is|are] on a shelf next to the desk. I [has|have] a lamp with a blue light. At night, my cat [sleep|sleeps] at the end of my bed.' },
  },
  {
    slug: 'fix-mountain-trip',
    level: 'A2',
    title: 'A Trip to the Mountains',
    description: 'Passado simples e comparativos.',
    data: { text: 'Last July, my family and I [go|went] to the mountains. The trip [take|took] four hours by car. The hotel was [cheapest|cheaper] than we expected. We [buyed|bought] fresh cheese at a local market. In the evening it was very [coldly|cold], so we [drinked|drank] hot chocolate by the fire.' },
  },
  {
    slug: 'fix-formal-email',
    level: 'B2',
    title: 'A Complaint Email',
    description: 'E-mail formal de reclamação.',
    data: { text: 'Dear Ms. Carter, I am writing to [complaint|complain] about a sofa I purchased from your store on 3 March. The delivery was [suppose|supposed] to take place within five working days, but it [arrive|arrived] three weeks late. Moreover, when it was finally delivered, one of the cushions was [damage|damaged]. I would be grateful if you [can|could] arrange a replacement as soon as possible. Yours sincerely, Paula Mendes.' },
  },
  {
    slug: 'fix-social-media',
    level: 'B2',
    title: 'Social Media: An Opinion',
    description: 'Texto de opinião com conectivos e vocabulário avançado.',
    data: { text: 'Social media has [became|become] an essential part of modern life. [Despite|Although] it connects people, it can also isolate them. Many teenagers spend more time online [then|than] with their friends, and studies suggest that excessive use [effects|affects] sleep and concentration. Therefore, schools and parents should [encouraging|encourage] healthier habits.' },
  },
];

module.exports = { wordOrder, textCorrection };
