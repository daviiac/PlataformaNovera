'use strict';

/**
 * Trilha de aulas (apresentações do Canva) e homeworks da Novera.
 *
 * Aulas: pastas "Class A1 / A2 / B2" do Canva, na ordem do número FORA dos
 * parênteses (ex.: "A1 - 02(10) Daily Routine" é a aula 02).
 * O link de cada apresentação é cadastrado pelo administrador no painel.
 *
 * Homeworks: 62 PDFs analisados um a um. Cada um foi colocado no nível pela
 * complexidade (gramática, tamanho das frases e dos textos) e ligado à aula do
 * mesmo tema; a numeração (HW 01, 02…) segue a ordem das aulas dentro do nível.
 * O arquivo é enviado pelo administrador ("Importar homeworks"); o sistema
 * reconhece cada PDF pelo nome.
 */

const LESSONS = {
  A1: [
    { n: 1, title: 'Apresentação', pages: 15 },
    { n: 2, title: 'Daily Routine', pages: 14 },
    { n: 3, title: 'At the House', pages: 12 },
    { n: 4, title: 'At the Supermarket', pages: 18 },
    { n: 5, title: 'Food and Meal', pages: 13 },
    { n: 6, title: 'Going to / Will', pages: 15 },
    { n: 7, title: 'Shopping for Clothes', pages: 14 },
    { n: 8, title: 'At the Airport', pages: 12 },
    { n: 9, title: 'At the Hotel', pages: 17 },
    { n: 10, title: 'Sport', pages: 14 },
    { n: 11, title: 'Going to the Doctor', pages: 17 },
  ],
  A2: [
    { n: 1, title: 'Apresentação', pages: 14 },
    { n: 2, title: 'Train Station', pages: 16 },
    { n: 3, title: 'Climate', pages: 14 },
    { n: 4, title: 'Museum', pages: 19 },
    { n: 5, title: 'Food and Drink', pages: 15 },
    { n: 6, title: 'Planet and Responsibility', pages: 18 },
    { n: 7, title: 'City or Countryside', pages: 16 },
    { n: 8, title: 'What is Culture', pages: 15 },
    { n: 9, title: 'At the Library', pages: 14 },
    { n: 10, title: 'At the Zoo', pages: 16 },
    { n: 11, title: 'Grammar: Should, Could, Would', pages: 7, extra: true },
  ],
  B2: [
    { n: 1, title: 'Travel Experience', pages: 14 },
    { n: 2, title: 'Future Career', pages: 16 },
    { n: 3, title: 'Cooking', pages: 13 },
    { n: 4, title: 'Sport', pages: 13 },
    { n: 5, title: 'Climate', pages: 14 },
    { n: 6, title: 'Movies and Series', pages: 15 },
    { n: 7, title: 'The Power of Curiosity', pages: 19 },
    { n: 8, title: 'The Psychology of Happiness', pages: 17 },
    { n: 9, title: 'Memory', pages: 17 },
    { n: 10, title: 'Digital Identity', pages: 20 },
  ],
};

// [nível, aula, arquivo, título, páginas, descrição]
const HW = [
  // ------------------------------------------------------------------ A1
  ['A1', 1, 'Beginner_level_-_Greetings_&_Farewells.pdf', 'Greetings & Farewells', 6, 'Cumprimentos e despedidas: completar, combinar pares e corrigir frases.'],
  ['A1', 1, 'Beginner_Level_-_Origin.pdf', 'Origin', 4, 'Origem e nacionalidade (from, born, hometown, grew up) e perguntas sobre de onde você é.'],
  ['A1', 1, 'Beginner_Level_-_Family_&_People_Around_Me.pdf', 'Family & People Around Me', 7, 'Família e pessoas próximas com simple present (works, lives) e reescrita com suas palavras.'],
  ['A1', 2, 'Beginner_level_-_Verb_Conjugation.pdf', 'Verb Conjugation', 6, 'Verbos na 3ª pessoa do singular (-s, -es, -ies): completar, múltipla escolha e correção.'],
  ['A1', 2, 'Daily_Routines_&_Free_Time_-_beginner_level_.pdf', 'Daily Routines & Free Time', 6, 'Rotina diária: frase correta, usually / don\'t usually e reescrita.'],
  ['A1', 2, 'Beginner_Level_-_Jobs_&_Work.pdf', 'Jobs & Work', 7, 'Profissões e o que cada uma faz, com simple present.'],
  ['A1', 2, 'Beginner_Level_-_Likes,_Dislikes_&_Preferences_.pdf', 'Likes, Dislikes & Preferences', 5, 'Gostos e preferências: like / love / hate + -ing.'],
  ['A1', 2, 'Did__Do__When,_What,_How,_Who,_Where_-_beginner_level_.pdf', 'Did / Do / Question Words', 5, 'Perguntas com do, does e did e com when, what, how, who, where.'],
  ['A1', 3, 'Beginner_Level_-_My_house.pdf', 'My House', 5, 'Cômodos da casa e erros de concordância para corrigir.'],
  ['A1', 3, 'Beginner_level_-_Prepositions.pdf', 'Prepositions', 5, 'Preposições de lugar (in, on, under, next to, in front of).'],
  ['A1', 3, 'Beginner_Level_-Neighborhood.pdf', 'My Neighborhood', 5, 'Leitura curta sobre o bairro, compreensão e there is / there are.'],
  ['A1', 3, 'Animals_Around_Us_-_beginner_level_.pdf', 'Animals Around Us', 5, 'Animais: correção de frases, descrições e combinação.'],
  ['A1', 4, 'Beginner_Level_-_At_the_supermarket.pdf', 'At the Supermarket', 3, 'Seções do supermercado e categorias de alimentos.'],
  ['A1', 4, 'Supermarket_Part_2_-_beginner_level_.pdf', 'Supermarket — Part 2', 6, 'Some e any, contáveis e incontáveis.'],
  ['A1', 5, 'At_the_Restaurant_-_beginner_level_.pdf', 'At the Restaurant', 5, 'Ordem das palavras, don\'t / doesn\'t e pedidos no restaurante.'],
  ['A1', 6, 'Beginner_-_Will_&_Going_to_.pdf', 'Will & Going to', 4, 'Will x going to: completar e transformar frases para o futuro.'],
  ['A1', 6, 'Will_&_Going_to_Part_2_-_beginner_level_.pdf', 'Will & Going to — Part 2', 5, 'Previsão, plano e decisão na hora: múltipla escolha e situações.'],
  ['A1', 7, 'Clothes_&_What_I_Wear_-_beginner_level_.pdf', 'Clothes & What I Wear', 7, 'Roupas: combinar descrições e reescrever frases com wear / wears.'],
  ['A1', 7, 'Beginner_Level_-_Adjectives.pdf', 'Adjectives', 3, 'Ordem adjetivo + substantivo para descrever roupas e objetos.'],
  ['A1', 7, 'Beginner_Level_-_Comparative_and_Superlative.pdf', 'Comparative and Superlative', 2, 'Comparativos e superlativos (bigger than, the smartest).'],
  ['A1', 7, 'Beginner_Level_-_Weather_&_Seasons.pdf', 'Weather & Seasons', 6, 'Clima e estações com there is / there are e leitura curta.'],
  ['A1', 8, 'Beginner_level_-_At_the_airport.pdf', 'At the Airport', 6, 'Leitura no aeroporto e perguntas: check-in, gate e embarque.'],
  ['A1', 8, 'Beginner_level_-_Transportation_&_Daily_life.pdf', 'Transportation & Daily Life', 6, 'Meios de transporte: transformar frases em pergunta e negativa.'],
  ['A1', 9, 'Beginner_Level_-_Travel_&_Experience.pdf', 'Travel & Experience', 8, 'Vocabulário de viagem (passport, luggage, hotel) e present continuous.'],
  ['A1', 9, 'Was,_Wasn’t,_Were,_Weren’t_-_beginner_level_.pdf', 'Was, Wasn\'t, Were, Weren\'t', 5, 'Passado do verbo to be: afirmativa, negativa e pergunta.'],
  ['A1', 10, 'Beginner_level_-_Free_time_.pdf', 'Free Time', 5, 'Atividades de lazer: melhor opção, ordem das palavras e rotina.'],
  ['A1', 10, 'Nature_and_Forest_Life_-_beginner_level_.pdf', 'Nature and Forest Life', 5, 'Leitura sobre a floresta, compreensão e must.'],
  ['A1', 10, 'Beginner_Level_-_Past_simple.pdf', 'Past Simple', 3, 'Passado simples com verbos regulares e irregulares.'],
  ['A1', 11, 'Beginner_Level_-_Health_and_Body.pdf', 'Health and Body', 5, 'Partes do corpo e suas funções; frases negativas e perguntas.'],
  ['A1', 11, 'Feelings_&_Emotions_-_beginner_level_.pdf', 'Feelings & Emotions', 5, 'Sentimentos e situações do dia a dia; frase correta.'],
  ['A1', 11, 'Simple_Past_Part_2_-_beginner_level_.pdf', 'Simple Past — Part 2', 5, 'Mais prática de passado simples: regulares, irregulares e perguntas.'],
  // ------------------------------------------------------------------ A2
  ['A2', 1, 'Daily_Life,_Habits_&_Lifestyle_-_intermediate_level_.pdf', 'Daily Life, Habits & Lifestyle', 4, 'Advérbios de frequência e hábitos; texto sobre estilo de vida.'],
  ['A2', 2, 'Travel_&_Transportation_-_intermediate_level_.pdf', 'Travel & Transportation', 6, 'Transportes: definições, leitura e situações de viagem.'],
  ['A2', 2, '_Losing,_Forgetting_&_Misplacing_Things_-_intermediate_level_.pdf', 'Losing, Forgetting & Misplacing Things', 8, 'Leitura longa sobre perder e esquecer objetos; vocabulário e compreensão.'],
  ['A2', 3, 'Past_Continuous_-_beginner_level_.pdf', 'Past Continuous', 2, '30 frases de past continuous (was / were + -ing, while e when).'],
  ['A2', 4, 'Giving_directions_INTERMEDIATE_LEVEL.pdf', 'Giving Directions', 3, 'Dar e entender direções (turn left, go straight, across from).'],
  ['A2', 4, 'Past_perfect_-_beginner_level_.pdf', 'Past Perfect', 5, 'Had + particípio: a ação que aconteceu antes de outra no passado.'],
  ['A2', 5, 'Household_Utensils_-_intermediate_level_.pdf', 'Household Utensils', 3, 'Leitura "A Big Cleaning Day": utensílios domésticos e de cozinha.'],
  ['A2', 6, 'Small_Daily_Decisions_&_Their_Consequences_-_intermediate_level_.pdf', 'Small Daily Decisions', 6, 'Leitura sobre escolhas do dia a dia e suas consequências; compreensão e opinião.'],
  ['A2', 7, 'Comparative_and_Superlative_Part_2_-_intermediate_level_.pdf', 'Comparative and Superlative — Part 2', 6, 'Comparativos e superlativos em contexto (cidade x campo).'],
  ['A2', 7, 'Shopping_Habits_&_Daily_Spending_-_intermediate_level_.pdf', 'Shopping Habits & Daily Spending', 5, 'Leitura sobre hábitos de consumo; compreensão e vocabulário de compras.'],
  ['A2', 8, 'Feeling_Out_of_Place_and_Learning_to_Adapt_-_intermediate_level_.pdf', 'Feeling Out of Place', 5, 'Leitura sobre adaptação a novas situações e culturas.'],
  ['A2', 8, 'Social_Media_&_Relationships_-_intermediate_level_.pdf', 'Social Media & Relationships', 5, 'Redes sociais e relacionamentos: frequência, leitura e opinião.'],
  ['A2', 9, 'ComfortZones_&_Trying_New_Things_-_intermediate_level_.pdf', 'Comfort Zones & Trying New Things', 5, 'Leitura sobre zona de conforto e novas experiências; interpretação.'],
  ['A2', 10, 'Past_tenses_review_-_Intermediate_level_.pdf', 'Past Tenses Review', 5, 'Revisão de past perfect, present perfect e simple past, com quadro de estrutura.'],
  ['A2', 11, 'Intermediate_-_Could,_should_&_would.pdf', 'Could, Should & Would', 4, 'Modais: conselhos, possibilidades e pedidos educados.'],
  // ------------------------------------------------------------------ B2
  ['B2', 1, 'Travel_and_Experience_-_advanced__level_.pdf', 'Travel and Experience', 4, 'Vocabulário de viagem em contexto (booked, sightseeing, souvenir).'],
  ['B2', 1, '“Did_you”_x_“Have_you_ever”__-_advanced__level_.pdf', '"Did you" x "Have you ever"', 2, 'Simple past x present perfect para falar de experiências.'],
  ['B2', 2, 'Interview_&_Future_Career_-_advanced__level_.pdf', 'Interview & Future Career', 6, 'Entrevista de emprego: perguntas, combinações e respostas sobre carreira.'],
  ['B2', 2, 'Advanced_level_-_Grammar_review.pdf', 'Grammar Review', 8, 'Present perfect, present perfect continuous e tag questions.'],
  ['B2', 3, '_Cooking__-_advanced__level_.pdf', 'Cooking', 4, 'Verbos culinários em contexto (chop, sauté, simmer, peel).'],
  ['B2', 4, 'Sports_-_advanced__level_.pdf', 'Sports', 3, 'Comparativos, superlativos e condicionais aplicados a esportes.'],
  ['B2', 5, 'Advanced_-_Passive_voice.pdf', 'Passive Voice', 6, 'Voz ativa ↔ passiva em vários tempos verbais.'],
  ['B2', 5, 'Passive_Voice_-_advanced__level_.pdf', 'Passive Voice — Simple Present', 2, 'Transformar frases da voz ativa para a passiva no presente.'],
  ['B2', 6, 'Movies,_Series_&_Pop_Culture_-_advanced__level_.pdf', 'Movies, Series & Pop Culture', 6, 'Vocabulário de cinema e séries (plot twist, engaging) e textos.'],
  ['B2', 7, 'Space,_Universe_&_Scientific_Discoveries_-_advanced__level_.pdf', 'Space, Universe & Scientific Discoveries', 6, 'Leitura avançada sobre descobertas científicas.'],
  ['B2', 7, 'Personal_Growth,_Choices_&_Life_Transitions_-_advanced__level_.pdf', 'Personal Growth, Choices & Life Transitions', 5, 'Leitura avançada sobre crescimento pessoal e escolhas.'],
  ['B2', 8, 'Time,_Change_&_Life_Decisions_-_advanced__level_.pdf', 'Time, Change & Life Decisions', 5, 'Leitura sobre decisões e mudanças; conectivos e interpretação.'],
  ['B2', 9, 'Advanced_level_-_Memory_&_Participle_Clauses.pdf', 'Memory & Participle Clauses', 9, 'Vocabulário de memória e orações reduzidas de particípio.'],
  ['B2', 9, '_Memories_&_Meaningful_Moments_-_advanced__level__(1).pdf', 'Memories & Meaningful Moments', 7, 'Leitura sobre memórias marcantes; condicionais e conectivos.'],
  ['B2', 9, 'Past_Perfect_Part_2_-_advanced__level_.pdf', 'Past Perfect — Part 2', 7, 'Past perfect em narrativas (by the time, already).'],
  ['B2', 10, '_Technology_&_Society__-_advanced__level_.pdf', 'Technology & Society', 4, 'Vocabulário de tecnologia (privacy, storage, upgrade) e leitura.'],
];

/** Chave estável a partir do nome do arquivo (ignora acentos, aspas e pontuação). */
function fileKey(name) {
  return String(name || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\.pdf$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const pad = (n) => String(n).padStart(2, '0');

const HOMEWORK = [];
for (const level of ['A1', 'A2', 'B2']) {
  HW.filter((h) => h[0] === level).forEach(([lvl, lesson, file, title, pages, description], i) => {
    HOMEWORK.push({
      key: fileKey(file),
      level: lvl,
      lesson,
      seq: i + 1,
      code: `${lvl} · HW ${pad(i + 1)}`,
      file,
      title,
      pages,
      description,
    });
  });
}
const HOMEWORK_BY_KEY = new Map(HOMEWORK.map((h) => [h.key, h]));

module.exports = { LESSONS, HOMEWORK, HOMEWORK_BY_KEY, fileKey, pad };
