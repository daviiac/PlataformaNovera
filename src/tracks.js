'use strict';

const TRACKS = [
  {
    level: 'A1',
    name: 'Iniciante',
    description: 'A base da língua: apresentações, verbo to be, rotina e vocabulário essencial do dia a dia.',
  },
  {
    level: 'A2',
    name: 'Básico',
    description: 'Comunicação em situações práticas: passado, futuro, comparações, viagens e serviços.',
  },
  {
    level: 'B2',
    name: 'Intermediário superior',
    description: 'Fluência e precisão: condicionais, voz passiva, phrasal verbs, argumentação e escrita.',
  },
];

const LEVELS = TRACKS.map((t) => t.level);
const isLevel = (value) => LEVELS.includes(value);

const DEFAULT_MODULES = {
  A1: [
    ['Primeiros passos', 'Cumprimentos, alfabeto, números e apresentações pessoais.'],
    ['Verbo to be e pronomes', 'Frases afirmativas, negativas e perguntas com to be.'],
    ['Rotina e presente simples', 'Falar sobre hábitos, horários e atividades diárias.'],
    ['Vocabulário essencial', 'Família, cores, comida, casa e lugares da cidade.'],
  ],
  A2: [
    ['Passado simples', 'Verbos regulares e irregulares para contar o que aconteceu.'],
    ['Comparativos e superlativos', 'Comparar pessoas, lugares e coisas.'],
    ['Futuro: will e going to', 'Planos, previsões e decisões.'],
    ['Viagens e situações práticas', 'Aeroporto, hotel, restaurante e pedir informações.'],
  ],
  B2: [
    ['Condicionais e hipóteses', 'Second, third e mixed conditionals; wish e if only.'],
    ['Voz passiva e estruturas avançadas', 'Passiva em todos os tempos, inversão e ênfase.'],
    ['Phrasal verbs e expressões idiomáticas', 'Expressões frequentes em contextos formais e informais.'],
    ['Escrita e argumentação', 'Ensaios, e-mails formais, conectivos e coesão.'],
  ],
};

module.exports = { TRACKS, LEVELS, isLevel, DEFAULT_MODULES };
