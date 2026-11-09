'use strict';

/**
 * Estudo de Gramática + Quiz de Gramática (conteúdo original da Novera).
 * Cada lição tem um quiz de prática ligado (quizSlug).
 *
 * Quiz: itens "translate" (o aluno escreve em inglês; aceitamos variações listadas
 * e contrações equivalentes) ou "choice" (múltipla escolha).
 */
const t = (pt, accepted) => ({ kind: 'translate', prompt: pt, accepted });
const c = (prompt, options, answer) => ({ kind: 'choice', prompt, options, answer });

const LESSONS = [
  // ------------------------------------------------------------------ A1
  {
    slug: 'grammar-verb-to-be',
    quizSlug: 'gquiz-verb-to-be',
    level: 'A1',
    title: 'Verb To Be',
    description: 'O verbo "ser/estar": afirmativa, negativa e pergunta.',
    data: {
      intro: 'O verbo <b>to be</b> significa <b>ser</b> e <b>estar</b> ao mesmo tempo. É o verbo mais usado do inglês: serve para dizer nome, idade, profissão, origem, sentimentos e onde algo está.',
      structure: {
        headers: ['Pessoa', 'Afirmativa', 'Negativa', 'Pergunta'],
        rows: [
          ['I', 'I am (I\'m)', 'I am not (I\'m not)', 'Am I…?'],
          ['He / She / It', 'He is (he\'s)', 'He is not (he isn\'t)', 'Is he…?'],
          ['You / We / They', 'You are (you\'re)', 'You are not (you aren\'t)', 'Are you…?'],
        ],
      },
      examples: [
        ['I am a nurse.', 'Eu sou enfermeira.'],
        ['She is at the office.', 'Ela está no escritório.'],
        ['We aren\'t tired.', 'Nós não estamos cansados.'],
        ['Is your brother 20?', 'Seu irmão tem 20 anos?'],
        ['They are from Chile.', 'Eles são do Chile.'],
      ],
      notes: [
        'Idade usa <b>to be</b>, não "have": <i>I am 25</i> (e não <i>I have 25</i>).',
        'Na pergunta, o verbo vem <b>antes</b> do sujeito: <i>Are you ready?</i>',
        'Na fala, as contrações (<i>I\'m, she\'s, they\'re</i>) são muito mais comuns.',
      ],
      table: {
        title: 'Usos mais comuns',
        headers: ['Uso', 'Exemplo'],
        rows: [
          ['Nome', 'My name is Paula.'],
          ['Idade', 'He is thirty.'],
          ['Profissão', 'They are engineers.'],
          ['Lugar', 'The keys are in my bag.'],
          ['Sentimento', 'I am hungry.'],
        ],
      },
      mistakes: [
        ['I have 18 years.', 'I am 18 (years old).', 'Idade sempre com "to be".'],
        ['She are my sister.', 'She is my sister.', 'He / she / it pedem "is".'],
        ['You are happy?', 'Are you happy?', 'Na pergunta, inverta: verbo + sujeito.'],
      ],
      summary: [
        'I → am · he/she/it → is · you/we/they → are.',
        'Negativa: acrescente <b>not</b> depois do verbo.',
        'Pergunta: o verbo vai para o início.',
      ],
    },
  },
  {
    slug: 'grammar-simple-present',
    quizSlug: 'gquiz-simple-present',
    level: 'A1',
    title: 'Simple Present',
    description: 'Rotinas e fatos: do / does e o "s" da terceira pessoa.',
    data: {
      intro: 'O <b>simple present</b> fala de <b>rotinas, hábitos e fatos</b>. Com <b>he, she, it</b> o verbo ganha <b>-s</b> na afirmativa, e nas perguntas e negativas usamos os auxiliares <b>do</b> e <b>does</b>.',
      structure: {
        headers: ['Forma', 'I / You / We / They', 'He / She / It'],
        rows: [
          ['Afirmativa', 'I work.', 'She works.'],
          ['Negativa', 'I don\'t work.', 'She doesn\'t work.'],
          ['Pergunta', 'Do you work?', 'Does she work?'],
        ],
      },
      examples: [
        ['I drink coffee every morning.', 'Eu tomo café toda manhã.'],
        ['He plays guitar on weekends.', 'Ele toca violão nos fins de semana.'],
        ['We don\'t eat meat.', 'Nós não comemos carne.'],
        ['Does your mother speak English?', 'Sua mãe fala inglês?'],
        ['The store opens at nine.', 'A loja abre às nove.'],
      ],
      notes: [
        'Com <b>does / doesn\'t</b>, o verbo principal volta ao normal: <i>Does she <b>work</b>?</i> (e não <i>works</i>).',
        'Verbos terminados em <b>-o, -ch, -sh, -ss, -x</b> ganham <b>-es</b>: <i>go → goes, watch → watches</i>.',
        'Consoante + <b>y</b> vira <b>-ies</b>: <i>study → studies</i>. Mas vogal + y fica: <i>play → plays</i>.',
      ],
      table: {
        title: 'Palavras de frequência',
        headers: ['Advérbio', 'Sentido'],
        rows: [
          ['always', 'sempre'],
          ['usually', 'geralmente'],
          ['often', 'frequentemente'],
          ['sometimes', 'às vezes'],
          ['never', 'nunca'],
        ],
      },
      mistakes: [
        ['She work in a bank.', 'She works in a bank.', 'He / she / it ganham -s.'],
        ['Does he likes pizza?', 'Does he like pizza?', 'Depois de "does" o verbo fica sem -s.'],
        ['I no understand.', 'I don\'t understand.', 'A negativa usa don\'t / doesn\'t.'],
      ],
      summary: [
        'Rotinas e fatos → simple present.',
        'He / she / it → verbo + s (ou es / ies).',
        'Perguntas e negativas → do / does + verbo na forma base.',
      ],
    },
  },
  {
    slug: 'grammar-there-is-are',
    quizSlug: 'gquiz-there-is-are',
    level: 'A1',
    title: 'There Is / There Are',
    description: 'Como dizer "tem / há" em inglês.',
    data: {
      intro: 'Para dizer que algo <b>existe</b> em um lugar ("tem", "há"), usamos <b>there is</b> (singular) e <b>there are</b> (plural). Não use "have" para isso.',
      structure: {
        headers: ['Forma', 'Singular', 'Plural'],
        rows: [
          ['Afirmativa', 'There is a park.', 'There are two parks.'],
          ['Negativa', 'There isn\'t a park.', 'There aren\'t any parks.'],
          ['Pergunta', 'Is there a park?', 'Are there any parks?'],
        ],
      },
      examples: [
        ['There is a pharmacy on the corner.', 'Tem uma farmácia na esquina.'],
        ['There are many students in the class.', 'Há muitos alunos na turma.'],
        ['There isn\'t any milk in the fridge.', 'Não tem leite na geladeira.'],
        ['Are there any good restaurants here?', 'Tem bons restaurantes aqui?'],
      ],
      notes: [
        'Use <b>any</b> em negativas e perguntas no plural: <i>Are there any questions?</i>',
        'Com coisas incontáveis (water, milk, money) usamos <b>there is</b>: <i>There is some water.</i>',
        'Resposta curta: <i>Yes, there is. / No, there aren\'t.</i>',
      ],
      table: null,
      mistakes: [
        ['Have a bank near here?', 'Is there a bank near here?', '"Tem" de existência = there is / are.'],
        ['There is three chairs.', 'There are three chairs.', 'Plural pede "there are".'],
        ['There are a problem.', 'There is a problem.', 'Singular pede "there is".'],
      ],
      summary: [
        'Singular / incontável → there is.',
        'Plural → there are.',
        'Perguntas e negativas no plural → any.',
      ],
    },
  },
  // ------------------------------------------------------------------ A2
  {
    slug: 'grammar-simple-past',
    quizSlug: 'gquiz-simple-past',
    level: 'A2',
    title: 'Simple Past',
    description: 'Ações terminadas no passado: verbos regulares e irregulares.',
    data: {
      intro: 'O <b>simple past</b> fala de ações <b>concluídas</b> em um momento do passado (yesterday, last week, in 2019). Verbos regulares ganham <b>-ed</b>; os irregulares têm forma própria. Perguntas e negativas usam <b>did</b>.',
      structure: {
        headers: ['Forma', 'Regular', 'Irregular'],
        rows: [
          ['Afirmativa', 'I worked.', 'I went.'],
          ['Negativa', 'I didn\'t work.', 'I didn\'t go.'],
          ['Pergunta', 'Did you work?', 'Did you go?'],
        ],
      },
      examples: [
        ['We visited my aunt last weekend.', 'Nós visitamos minha tia no fim de semana passado.'],
        ['She bought a new phone yesterday.', 'Ela comprou um celular novo ontem.'],
        ['They didn\'t see the message.', 'Eles não viram a mensagem.'],
        ['Did you sleep well?', 'Você dormiu bem?'],
        ['I was tired after the trip.', 'Eu estava cansado depois da viagem.'],
      ],
      notes: [
        'Depois de <b>did / didn\'t</b> o verbo volta à forma base: <i>Did you <b>go</b>?</i>',
        'O verbo <b>to be</b> no passado é <b>was</b> (I, he, she, it) e <b>were</b> (you, we, they).',
        'Regra do -ed: <i>stop → stopped, study → studied, like → liked</i>.',
      ],
      table: {
        title: 'Irregulares muito usados',
        headers: ['Base', 'Passado', 'Sentido'],
        rows: [
          ['go', 'went', 'ir'],
          ['have', 'had', 'ter'],
          ['make', 'made', 'fazer'],
          ['see', 'saw', 'ver'],
          ['buy', 'bought', 'comprar'],
          ['take', 'took', 'pegar / levar'],
        ],
      },
      mistakes: [
        ['I goed to the beach.', 'I went to the beach.', '"Go" é irregular.'],
        ['Did she called you?', 'Did she call you?', 'Depois de "did", forma base.'],
        ['We was at home.', 'We were at home.', 'We / you / they → were.'],
      ],
      summary: [
        'Ação terminada no passado → simple past.',
        'Regulares: -ed · irregulares: decore os mais comuns.',
        'Perguntas e negativas → did / didn\'t + forma base.',
      ],
    },
  },
  {
    slug: 'grammar-comparatives',
    quizSlug: 'gquiz-comparatives',
    level: 'A2',
    title: 'Comparatives and Superlatives',
    description: 'Comparar coisas: bigger than, the biggest, more interesting…',
    data: {
      intro: 'Para <b>comparar duas coisas</b> usamos o comparativo + <b>than</b>. Para dizer que algo é <b>o mais</b> de um grupo, usamos <b>the</b> + superlativo. A forma muda conforme o tamanho do adjetivo.',
      structure: {
        headers: ['Adjetivo', 'Comparativo', 'Superlativo'],
        rows: [
          ['Curto (cheap)', 'cheaper than', 'the cheapest'],
          ['Terminado em -y (easy)', 'easier than', 'the easiest'],
          ['Longo (expensive)', 'more expensive than', 'the most expensive'],
          ['Irregular (good / bad)', 'better / worse than', 'the best / the worst'],
        ],
      },
      examples: [
        ['My phone is cheaper than yours.', 'Meu celular é mais barato que o seu.'],
        ['This exercise is easier than the last one.', 'Este exercício é mais fácil que o último.'],
        ['Rio is more crowded than my city.', 'O Rio é mais cheio que a minha cidade.'],
        ['It was the best day of my life.', 'Foi o melhor dia da minha vida.'],
      ],
      notes: [
        'Adjetivos curtos com consoante-vogal-consoante dobram a letra: <i>big → bigger → the biggest</i>.',
        'Para igualdade use <b>as … as</b>: <i>She is as tall as her mother.</i>',
        'Nunca junte "more" com "-er": <i>more bigger</i> está errado.',
      ],
      table: null,
      mistakes: [
        ['He is more tall than me.', 'He is taller than me.', 'Adjetivo curto → -er.'],
        ['This is the more expensive hotel.', 'This is the most expensive hotel.', 'Superlativo longo → the most.'],
        ['My car is gooder.', 'My car is better.', 'Good → better → the best.'],
      ],
      summary: [
        'Curtos: -er / the -est · longos: more / the most.',
        'Comparando duas coisas → than.',
        'Irregulares: good → better → best · bad → worse → worst.',
      ],
    },
  },
  {
    slug: 'grammar-future',
    quizSlug: 'gquiz-future',
    level: 'A2',
    title: 'Future: Will and Going To',
    description: 'Planos, previsões e decisões na hora.',
    data: {
      intro: 'Usamos <b>going to</b> para <b>planos</b> já decididos e previsões com evidência. Usamos <b>will</b> para <b>decisões na hora</b>, promessas, ofertas e previsões de opinião.',
      structure: {
        headers: ['Uso', 'Forma', 'Exemplo'],
        rows: [
          ['Plano decidido', 'be + going to + verbo', 'I\'m going to study tonight.'],
          ['Evidência', 'be + going to + verbo', 'Look at the clouds! It\'s going to rain.'],
          ['Decisão na hora', 'will + verbo', 'It\'s cold. I\'ll close the window.'],
          ['Promessa / oferta', 'will + verbo', 'I\'ll help you with that.'],
        ],
      },
      examples: [
        ['We are going to travel in December.', 'Nós vamos viajar em dezembro.'],
        ['I think she will like the gift.', 'Acho que ela vai gostar do presente.'],
        ['The phone is ringing. I\'ll answer it.', 'O telefone está tocando. Eu atendo.'],
        ['They aren\'t going to sell the house.', 'Eles não vão vender a casa.'],
      ],
      notes: [
        'A negativa de will é <b>won\'t</b>: <i>I won\'t forget.</i>',
        'Em going to, o "be" concorda com o sujeito: <i>she <b>is</b> going to, they <b>are</b> going to</i>.',
        'Com "I think / probably" costuma vir <b>will</b>.',
      ],
      table: null,
      mistakes: [
        ['I will to call you.', 'I will call you.', 'Depois de will não há "to".'],
        ['She going to travel.', 'She is going to travel.', 'Não esqueça o verbo to be.'],
        ['Tonight I will go to the cinema with Ana (combinado há dias).', 'Tonight I\'m going to the cinema with Ana.', 'Plano já combinado → going to.'],
      ],
      summary: [
        'Plano decidido antes → going to.',
        'Decisão no momento, promessa, oferta → will.',
        'Negativas: won\'t · am / is / are not going to.',
      ],
    },
  },
  // ------------------------------------------------------------------ B2
  {
    slug: 'grammar-conditionals',
    quizSlug: 'gquiz-conditionals',
    level: 'B2',
    title: 'Conditionals: 2nd, 3rd and Mixed',
    description: 'Hipóteses no presente e no passado, e arrependimentos.',
    data: {
      intro: 'As condicionais expressam <b>hipóteses</b>. A <b>second</b> trata de situações imaginárias no presente/futuro; a <b>third</b>, de situações que <b>não aconteceram</b> no passado; a <b>mixed</b> liga uma condição passada a um resultado presente (ou vice-versa).',
      structure: {
        headers: ['Tipo', 'Condição (if)', 'Resultado'],
        rows: [
          ['Second', 'if + past simple', 'would + verbo'],
          ['Third', 'if + past perfect', 'would have + particípio'],
          ['Mixed (passado → presente)', 'if + past perfect', 'would + verbo'],
          ['Mixed (presente → passado)', 'if + past simple', 'would have + particípio'],
        ],
      },
      examples: [
        ['If I had more time, I would learn Japanese.', 'Se eu tivesse mais tempo, aprenderia japonês.'],
        ['If she had left earlier, she wouldn\'t have missed the flight.', 'Se ela tivesse saído antes, não teria perdido o voo.'],
        ['If I had accepted that job, I would live in London now.', 'Se eu tivesse aceitado aquele emprego, moraria em Londres agora.'],
        ['If he weren\'t so shy, he would have spoken at the meeting.', 'Se ele não fosse tão tímido, teria falado na reunião.'],
      ],
      notes: [
        'Na second conditional, <b>were</b> é usado com todas as pessoas no registro formal: <i>If I were you…</i>',
        'Inversão formal sem "if": <i>Had I known, I would have called.</i> = <i>If I had known…</i>',
        '<b>Unless</b> = "a menos que" (if … not): <i>Unless it stops raining, we won\'t go.</i>',
        '<b>I wish / If only</b> seguem a mesma lógica: <i>I wish I had studied more.</i>',
      ],
      table: null,
      mistakes: [
        ['If I would have known, I would have helped.', 'If I had known, I would have helped.', 'Não use "would" na oração com if.'],
        ['If I was you, I will accept.', 'If I were you, I would accept.', 'Hipótese → were / would.'],
        ['If she studied, she would have passed (ontem).', 'If she had studied, she would have passed.', 'Passado irreal → past perfect.'],
      ],
      summary: [
        'Imaginário agora → if + past · would + verbo.',
        'Passado que não aconteceu → if + past perfect · would have + particípio.',
        'Misturas ligam tempos diferentes; "would" nunca vai na oração com if.',
      ],
    },
  },
  {
    slug: 'grammar-passive-voice',
    quizSlug: 'gquiz-passive-voice',
    level: 'B2',
    title: 'Passive Voice',
    description: 'Quando a ação importa mais do que quem a fez.',
    data: {
      intro: 'A <b>voz passiva</b> coloca o foco na <b>ação</b> ou em quem a <b>recebe</b>. É formada por <b>be</b> (no tempo verbal desejado) + <b>particípio</b>. Quem fez a ação aparece com <b>by</b>, quando é relevante.',
      structure: {
        headers: ['Tempo', 'Estrutura', 'Exemplo'],
        rows: [
          ['Present simple', 'am / is / are + particípio', 'English is spoken here.'],
          ['Past simple', 'was / were + particípio', 'The bridge was built in 1890.'],
          ['Present perfect', 'has / have been + particípio', 'The report has been sent.'],
          ['Present continuous', 'is / are being + particípio', 'The rules are being discussed.'],
          ['Modal', 'modal + be + particípio', 'It must be finished today.'],
        ],
      },
      examples: [
        ['The results will be announced next week.', 'Os resultados serão anunciados na semana que vem.'],
        ['The thief was caught by the police.', 'O ladrão foi pego pela polícia.'],
        ['Thousands of photos are uploaded every minute.', 'Milhares de fotos são enviadas a cada minuto.'],
        ['The meeting has been postponed.', 'A reunião foi adiada.'],
      ],
      notes: [
        'Omitimos o agente quando ele é óbvio, desconhecido ou sem importância: <i>My bike was stolen.</i>',
        'Estrutura impessoal formal: <i>It is said that… / He is believed to be…</i>',
        '<b>Have something done</b> = mandar fazer: <i>I had my car repaired.</i>',
      ],
      table: null,
      mistakes: [
        ['The house was build in 1990.', 'The house was built in 1990.', 'Use o particípio (built).'],
        ['The emails are send every day.', 'The emails are sent every day.', 'Particípio de send é sent.'],
        ['It was happened yesterday.', 'It happened yesterday.', 'Verbos intransitivos não têm passiva.'],
      ],
      summary: [
        'Passiva = be (no tempo certo) + particípio.',
        'Use "by" só quando quem fez a ação importa.',
        'Muito comum em notícias, relatórios e textos formais.',
      ],
    },
  },
];

const QUIZZES = {
  'gquiz-verb-to-be': [
    t('Eu sou estudante.', ['I am a student', 'I\'m a student']),
    t('Ela está cansada.', ['She is tired', 'She\'s tired']),
    t('Nós não somos irmãos.', ['We are not brothers', 'We aren\'t brothers', 'We\'re not brothers', 'We are not siblings', 'We aren\'t siblings']),
    t('Você está com fome?', ['Are you hungry']),
    t('Eles são de Portugal.', ['They are from Portugal', 'They\'re from Portugal']),
    t('Meu pai tem 50 anos.', ['My father is 50', 'My father is fifty', 'My dad is 50', 'My father is 50 years old', 'My father is fifty years old', 'My dad is fifty']),
    c('___ your parents at home?', ['Is', 'Are', 'Am', 'Be'], 1),
    c('The weather ___ nice today.', ['are', 'am', 'is', 'be'], 2),
  ],
  'gquiz-simple-present': [
    t('Eu trabalho em uma escola.', ['I work at a school', 'I work in a school']),
    t('Ela mora em São Paulo.', ['She lives in São Paulo', 'She lives in Sao Paulo']),
    t('Nós não comemos carne.', ['We do not eat meat', 'We don\'t eat meat']),
    t('Ele gosta de futebol?', ['Does he like soccer', 'Does he like football']),
    t('Minha mãe não fala inglês.', ['My mother does not speak English', 'My mother doesn\'t speak English', 'My mom doesn\'t speak English', 'My mom does not speak English']),
    c('She ___ TV every night.', ['watch', 'watches', 'watching', 'watchs'], 1),
    c('___ they study on Saturdays?', ['Does', 'Do', 'Are', 'Is'], 1),
    c('My brother ___ coffee.', ['don\'t drink', 'doesn\'t drinks', 'doesn\'t drink', 'not drink'], 2),
  ],
  'gquiz-there-is-are': [
    t('Tem um banco perto daqui.', ['There is a bank near here', 'There\'s a bank near here', 'There is a bank nearby', 'There\'s a bank nearby']),
    t('Há dois quartos no apartamento.', ['There are two bedrooms in the apartment', 'There are two rooms in the apartment']),
    t('Não tem leite na geladeira.', ['There is no milk in the fridge', 'There isn\'t any milk in the fridge', 'There\'s no milk in the fridge', 'There is not any milk in the fridge']),
    t('Tem alguma pergunta?', ['Are there any questions', 'Is there any question']),
    c('___ a problem with my computer.', ['There are', 'There is', 'Have', 'It has'], 1),
    c('Are there ___ good restaurants here?', ['some', 'a', 'any', 'one'], 2),
    c('There ___ many people at the party.', ['was', 'is', 'were', 'has'], 2),
    c('— Is there a pharmacy here? — No, there ___.', ['isn\'t', 'aren\'t', 'don\'t', 'hasn\'t'], 0),
  ],
  'gquiz-simple-past': [
    t('Eu fui ao cinema ontem.', ['I went to the cinema yesterday', 'I went to the movies yesterday', 'Yesterday I went to the cinema', 'Yesterday I went to the movies']),
    t('Ela comprou um carro novo.', ['She bought a new car']),
    t('Nós não vimos o jogo.', ['We did not see the game', 'We didn\'t see the game', 'We didn\'t watch the game', 'We did not watch the game']),
    t('Você dormiu bem?', ['Did you sleep well']),
    t('Eles estavam em casa.', ['They were at home', 'They were home']),
    c('I ___ my keys this morning.', ['lose', 'losed', 'lost', 'losted'], 2),
    c('Did she ___ the email?', ['sent', 'send', 'sends', 'sending'], 1),
    c('We ___ very happy with the results.', ['was', 'were', 'are be', 'did'], 1),
  ],
  'gquiz-comparatives': [
    t('Meu irmão é mais alto que eu.', ['My brother is taller than me', 'My brother is taller than I am', 'My brother is taller than I']),
    t('Este é o melhor restaurante da cidade.', ['This is the best restaurant in the city', 'This is the best restaurant in town']),
    t('O Brasil é maior que a Argentina.', ['Brazil is bigger than Argentina', 'Brazil is larger than Argentina']),
    t('Inglês é mais fácil que alemão.', ['English is easier than German']),
    c('This hotel is ___ than the other one.', ['more cheap', 'cheaper', 'cheapest', 'more cheaper'], 1),
    c('It was ___ movie I have ever seen.', ['the worse', 'the worst', 'the baddest', 'worst'], 1),
    c('Gold is ___ than silver.', ['expensiver', 'the most expensive', 'more expensive', 'most expensive'], 2),
    c('She is as tall ___ her sister.', ['than', 'as', 'like', 'that'], 1),
  ],
  'gquiz-future': [
    t('Eu vou viajar no próximo mês.', ['I am going to travel next month', 'I\'m going to travel next month', 'I will travel next month', 'I\'ll travel next month']),
    t('Acho que vai chover amanhã.', ['I think it will rain tomorrow', 'I think it\'s going to rain tomorrow', 'I think it is going to rain tomorrow']),
    t('Ela não vai vender a casa.', ['She is not going to sell the house', 'She isn\'t going to sell the house', 'She won\'t sell the house', 'She will not sell the house', 'She\'s not going to sell the house']),
    c('The phone is ringing. I ___ answer it.', ['am going to', 'will', 'going', 'am'], 1),
    c('Look at those clouds! It ___ rain.', ['will to', 'is going to', 'goes to', 'going to'], 1),
    c('We have the tickets. We ___ see the show on Friday.', ['are going to', 'will to', 'going to', 'go to will'], 0),
    c('I promise I ___ tell anyone.', ['won\'t', 'am not going', 'don\'t', 'not will'], 0),
    c('What ___ you going to do tonight?', ['will', 'do', 'are', 'is'], 2),
  ],
  'gquiz-conditionals': [
    t('Se eu fosse você, aceitaria a oferta.', ['If I were you, I would accept the offer', 'If I were you I would accept the offer', 'If I were you, I\'d accept the offer', 'If I were you I\'d accept the offer', 'If I was you, I would accept the offer']),
    t('Se ela tivesse estudado, teria passado.', ['If she had studied, she would have passed', 'If she had studied she would have passed', 'If she\'d studied, she\'d have passed', 'If she had studied, she\'d have passed']),
    t('Eu gostaria de ter mais tempo livre.', ['I wish I had more free time', 'I would like to have more free time', 'I\'d like to have more free time']),
    c('If I ___ about the problem, I would have helped.', ['knew', 'had known', 'would know', 'have known'], 1),
    c('___ I known, I would have called you.', ['Have', 'Did', 'Had', 'Would'], 2),
    c('If he had taken the job, he ___ in Paris now.', ['would live', 'would have lived', 'lives', 'had lived'], 0),
    c('We won\'t go out ___ it stops raining.', ['if', 'unless', 'when', 'despite'], 1),
    c('If I ___ rich, I would travel the world.', ['am', 'were', 'will be', 'had been'], 1),
  ],
  'gquiz-passive-voice': [
    t('O relatório foi enviado ontem.', ['The report was sent yesterday']),
    t('Inglês é falado no mundo todo.', ['English is spoken all over the world', 'English is spoken around the world', 'English is spoken throughout the world', 'English is spoken worldwide']),
    t('A reunião foi adiada.', ['The meeting was postponed', 'The meeting has been postponed', 'The meeting was delayed']),
    c('The bridge ___ in 1890.', ['built', 'was built', 'was build', 'has build'], 1),
    c('The new rules ___ by the board right now.', ['are discussing', 'are being discussed', 'were discuss', 'discussed'], 1),
    c('The results ___ next week.', ['will announce', 'will be announced', 'are announce', 'announced'], 1),
    c('My bike ___ last night.', ['stole', 'was stolen', 'was stole', 'has stolen'], 1),
    c('I had my car ___ yesterday.', ['repair', 'repaired', 'repairing', 'to repair'], 1),
  ],
};

const lessons = LESSONS.map((l) => ({
  slug: l.slug,
  type: 'grammar_lesson',
  level: l.level,
  title: l.title,
  description: l.description,
  data: { ...l.data, quizKey: `b-${l.quizSlug}` },
}));

const quizzes = LESSONS.map((l) => ({
  slug: l.quizSlug,
  type: 'grammar_quiz',
  level: l.level,
  title: l.title,
  description: `Pratique: ${l.description.charAt(0).toLowerCase()}${l.description.slice(1)}`,
  data: { items: QUIZZES[l.quizSlug], lessonKey: `b-${l.slug}` },
}));

module.exports = { lessons, quizzes };
