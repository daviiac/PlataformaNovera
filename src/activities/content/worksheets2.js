'use strict';

/** Mais 15 worksheets originais da Novera (5 por nível), no mesmo formato de 4 páginas. */
const learn = (title, instruction, cards) => ({ kind: 'learn', title, instruction, cards });
const choose = (title, instruction, items) => ({ kind: 'choose', title, instruction, items });
const match = (title, instruction, pairs) => ({ kind: 'match', title, instruction, pairs });
const fill = (title, instruction, bank, sentences) => ({ kind: 'fill', title, instruction, bank, sentences });

module.exports = [
  // ====================================================================== A1
  {
    slug: 'ws-my-family', level: 'A1', title: 'My Family',
    description: 'Membros da família e o verbo to be — 4 páginas.',
    data: { theme: 'sunrise', cover: '👨‍👩‍👧', pages: [
      learn('Meet the family', 'Read and repeat the family words.', [
        { emoji: '👩', word: 'mother', example: 'My mother is a doctor.' },
        { emoji: '👨', word: 'father', example: 'My father is funny.' },
        { emoji: '👧', word: 'sister', example: 'My sister is ten years old.' },
        { emoji: '👦', word: 'brother', example: 'My brother likes soccer.' },
        { emoji: '👵', word: 'grandmother', example: 'My grandmother makes cakes.' },
        { emoji: '👴', word: 'grandfather', example: 'My grandfather reads the news.' },
      ]),
      choose('Who is it?', 'Choose the correct word.', [
        { emoji: '👵', options: ['aunt', 'grandmother', 'sister'], answer: 1 },
        { emoji: '👦', options: ['brother', 'father', 'uncle'], answer: 0 },
        { emoji: '👩', prompt: 'She is my father\'s wife.', options: ['my cousin', 'my mother', 'my daughter'], answer: 1 },
        { emoji: '👨‍👦', prompt: 'He is my mother\'s brother.', options: ['my uncle', 'my son', 'my grandfather'], answer: 0 },
      ]),
      match('Questions and answers', 'Match the question to the answer.', [
        { left: 'What\'s your sister\'s name?', right: 'Her name is Lia.' },
        { left: 'How old is your brother?', right: 'He is twelve.' },
        { left: 'Is your mother a teacher?', right: 'No, she is a nurse.' },
        { left: 'Do you have cousins?', right: 'Yes, I have three.' },
      ]),
      fill('Complete about the family', 'Use the words in the box.', ['is', 'are', 'has', 'have', 'name'], [
        'My father [is] very tall.',
        'My parents [are] from Recife.',
        'My sister [has] a cat.',
        'I [have] two brothers.',
        'My grandmother\'s [name] is Rosa.',
      ]),
    ] },
  },
  {
    slug: 'ws-rooms-of-the-house', level: 'A1', title: 'Rooms of the House',
    description: 'Cômodos, objetos e there is / there are — 4 páginas.',
    data: { theme: 'sky', cover: '🏠', pages: [
      learn('Rooms and things', 'Learn the rooms and what you find there.', [
        { emoji: '🛋️', word: 'living room', example: 'There is a sofa in the living room.' },
        { emoji: '🍳', word: 'kitchen', example: 'We cook in the kitchen.' },
        { emoji: '🛏️', word: 'bedroom', example: 'I sleep in my bedroom.' },
        { emoji: '🛁', word: 'bathroom', example: 'There is a bathtub in the bathroom.' },
        { emoji: '🌳', word: 'garden', example: 'The dog plays in the garden.' },
        { emoji: '🚗', word: 'garage', example: 'The car is in the garage.' },
      ]),
      choose('Where is it?', 'Choose the right room.', [
        { emoji: '🧽', prompt: 'You wash the dishes in the…', options: ['bedroom', 'kitchen', 'garage'], answer: 1 },
        { emoji: '🪥', prompt: 'You brush your teeth in the…', options: ['bathroom', 'garden', 'living room'], answer: 0 },
        { emoji: '📺', prompt: 'The family watches TV in the…', options: ['garage', 'bathroom', 'living room'], answer: 2 },
        { emoji: '😴', prompt: 'You sleep in the…', options: ['bedroom', 'kitchen', 'garden'], answer: 0 },
      ]),
      match('Objects and rooms', 'Match each object to its room.', [
        { left: '🛏️ bed', right: 'bedroom' },
        { left: '🧊 fridge', right: 'kitchen' },
        { left: '🚿 shower', right: 'bathroom' },
        { left: '🌷 flowers', right: 'garden' },
      ]),
      fill('There is or there are?', 'Use the words in the box.', ['is', 'are', 'isn\'t', 'aren\'t', 'Is'], [
        'There [is] a big table in the kitchen.',
        'There [are] two bedrooms upstairs.',
        'There [isn\'t] a garage in my house.',
        'There [aren\'t] any chairs in the garden.',
        '[Is] there a lamp in the living room?',
      ]),
    ] },
  },
  {
    slug: 'ws-food-i-like', level: 'A1', title: 'Food I Like',
    description: 'Comidas, bebidas e like / don\'t like — 4 páginas.',
    data: { theme: 'warm', cover: '🍕', pages: [
      learn('Food and drinks', 'Learn the words and say what you like.', [
        { emoji: '🍕', word: 'pizza', example: 'I like pizza.' },
        { emoji: '🥗', word: 'salad', example: 'She eats salad for lunch.' },
        { emoji: '🍎', word: 'apple', example: 'An apple a day is good.' },
        { emoji: '🍚', word: 'rice', example: 'We eat rice and beans.' },
        { emoji: '🥛', word: 'milk', example: 'He drinks milk in the morning.' },
        { emoji: '🍰', word: 'cake', example: 'I don\'t like chocolate cake.' },
      ]),
      choose('Like or don\'t like?', 'Choose the correct sentence.', [
        { emoji: '😋🍕', options: ['I like pizza.', 'I likes pizza.', 'I liking pizza.'], answer: 0 },
        { emoji: '😖🥦', options: ['She don\'t like broccoli.', 'She doesn\'t like broccoli.', 'She not like broccoli.'], answer: 1 },
        { emoji: '🙂🥛', options: ['Do you like milk?', 'Does you like milk?', 'You like milk does?'], answer: 0 },
        { emoji: '😋🍎', options: ['He like apples.', 'He likes apples.', 'He liking apples.'], answer: 1 },
      ]),
      match('Meals of the day', 'Match the meal to the time.', [
        { left: '🌅 breakfast', right: 'in the morning' },
        { left: '☀️ lunch', right: 'at noon' },
        { left: '🍪 snack', right: 'in the afternoon' },
        { left: '🌙 dinner', right: 'in the evening' },
      ]),
      fill('Complete the sentences', 'Use the words in the box.', ['like', 'likes', 'don\'t', 'doesn\'t', 'eat'], [
        'I [like] orange juice.',
        'My brother [likes] hamburgers.',
        'We [don\'t] eat meat on Fridays.',
        'She [doesn\'t] drink coffee.',
        'They [eat] fruit every day.',
      ]),
    ] },
  },
  {
    slug: 'ws-animals-pets', level: 'A1', title: 'Animals and Pets',
    description: 'Animais, can / can\'t e descrições — 4 páginas.',
    data: { theme: 'sky', cover: '🐶', pages: [
      learn('Animals', 'Learn the animals and what they can do.', [
        { emoji: '🐶', word: 'dog', example: 'A dog can run fast.' },
        { emoji: '🐱', word: 'cat', example: 'A cat can climb trees.' },
        { emoji: '🐟', word: 'fish', example: 'A fish can swim.' },
        { emoji: '🐦', word: 'bird', example: 'A bird can fly.' },
        { emoji: '🐢', word: 'turtle', example: 'A turtle can\'t run fast.' },
        { emoji: '🐰', word: 'rabbit', example: 'A rabbit can jump.' },
      ]),
      choose('What can it do?', 'Choose the correct sentence.', [
        { emoji: '🐟', options: ['It can fly.', 'It can swim.', 'It can climb.'], answer: 1 },
        { emoji: '🐦', options: ['It can fly.', 'It can\'t fly.', 'It can talk.'], answer: 0 },
        { emoji: '🐢', options: ['It runs very fast.', 'It is very slow.', 'It can fly.'], answer: 1 },
        { emoji: '🐰', options: ['It can jump.', 'It can swim deep.', 'It can fly high.'], answer: 0 },
      ]),
      match('Describe the animal', 'Match the animal to the description.', [
        { left: '🐘 elephant', right: 'big and grey' },
        { left: '🦒 giraffe', right: 'tall, with a long neck' },
        { left: '🐭 mouse', right: 'small and fast' },
        { left: '🦁 lion', right: 'strong, with a big mane' },
      ]),
      fill('My pet', 'Use the words in the box.', ['have', 'name', 'can', 'is', 'loves'], [
        'I [have] a dog.',
        'His [name] is Toby.',
        'He [is] brown and white.',
        'He [can] catch a ball.',
        'He [loves] the park.',
      ]),
    ] },
  },
  {
    slug: 'ws-clothes-colors', level: 'A1', title: 'Clothes and Colors',
    description: 'Roupas, cores e present continuous — 4 páginas.',
    data: { theme: 'sunrise', cover: '👕', pages: [
      learn('What are you wearing?', 'Learn the clothes and the colors.', [
        { emoji: '👕', word: 'T-shirt', example: 'He is wearing a blue T-shirt.' },
        { emoji: '👖', word: 'jeans', example: 'I am wearing black jeans.' },
        { emoji: '👗', word: 'dress', example: 'She is wearing a red dress.' },
        { emoji: '🧥', word: 'coat', example: 'Wear a coat. It\'s cold!' },
        { emoji: '👟', word: 'sneakers', example: 'My sneakers are white.' },
        { emoji: '🧢', word: 'cap', example: 'He is wearing a green cap.' },
      ]),
      choose('Colors', 'Choose the correct color.', [
        { emoji: '🍌', prompt: 'A banana is…', options: ['yellow', 'purple', 'blue'], answer: 0 },
        { emoji: '🍅', prompt: 'A tomato is…', options: ['green', 'red', 'black'], answer: 1 },
        { emoji: '🌊', prompt: 'The sea is…', options: ['blue', 'orange', 'pink'], answer: 0 },
        { emoji: '🍃', prompt: 'A leaf is…', options: ['white', 'brown', 'green'], answer: 2 },
      ]),
      match('Weather and clothes', 'What do you wear?', [
        { left: '☀️ hot day', right: 'shorts and a T-shirt' },
        { left: '❄️ cold day', right: 'a coat and a scarf' },
        { left: '🌧️ rainy day', right: 'a raincoat and boots' },
        { left: '🎉 party', right: 'a nice dress or shirt' },
      ]),
      fill('Present continuous', 'Use the words in the box.', ['am', 'is', 'are', 'wearing', 'isn\'t'], [
        'I [am] wearing a yellow jacket.',
        'She [is] wearing red shoes.',
        'They [are] wearing school uniforms.',
        'He is [wearing] a black cap.',
        'Tom [isn\'t] wearing a coat today.',
      ]),
    ] },
  },
  // ====================================================================== A2
  {
    slug: 'ws-last-weekend', level: 'A2', title: 'Last Weekend',
    description: 'Passado simples: regulares, irregulares e perguntas — 4 páginas.',
    data: { theme: 'warm', cover: '📅', pages: [
      learn('What did you do?', 'Read the past forms.', [
        { emoji: '🎬', word: 'went to the cinema', meaning: 'go → went', example: 'I went to the cinema on Saturday.' },
        { emoji: '🍝', word: 'cooked dinner', meaning: 'cook → cooked', example: 'My dad cooked dinner for us.' },
        { emoji: '🛍️', word: 'bought a gift', meaning: 'buy → bought', example: 'She bought a gift for her mom.' },
        { emoji: '📞', word: 'called a friend', meaning: 'call → called', example: 'I called my best friend.' },
        { emoji: '🏖️', word: 'swam in the sea', meaning: 'swim → swam', example: 'We swam in the sea.' },
        { emoji: '📖', word: 'read a book', meaning: 'read → read', example: 'He read a mystery book.' },
      ]),
      choose('Choose the correct past', 'Mark the correct sentence.', [
        { emoji: '🚲', options: ['I rided my bike.', 'I rode my bike.', 'I ride my bike yesterday.'], answer: 1 },
        { emoji: '🍰', options: ['We eated cake.', 'We ate cake.', 'We did ate cake.'], answer: 1 },
        { emoji: '❓', options: ['Did you saw the game?', 'Did you see the game?', 'You did see the game?'], answer: 1 },
        { emoji: '🙅', options: ['She didn\'t went out.', 'She didn\'t go out.', 'She not went out.'], answer: 1 },
      ]),
      match('Questions and answers', 'Match each question to its answer.', [
        { left: 'Where did you go?', right: 'I went to the beach.' },
        { left: 'Who did you meet?', right: 'I met my cousins.' },
        { left: 'What did you eat?', right: 'We ate fish and rice.' },
        { left: 'How was the weather?', right: 'It was sunny and hot.' },
      ]),
      fill('My weekend', 'Use the past forms in the box.', ['was', 'visited', 'took', 'didn\'t', 'had'], [
        'On Saturday I [visited] my grandparents.',
        'We [had] lunch in their garden.',
        'My grandfather [took] us to the market.',
        'It [was] a perfect day.',
        'On Sunday I [didn\'t] leave the house.',
      ]),
    ] },
  },
  {
    slug: 'ws-travel-plans', level: 'A2', title: 'Travel Plans',
    description: 'Planos de viagem com going to e vocabulário de viagem — 4 páginas.',
    data: { theme: 'sky', cover: '🧳', pages: [
      learn('Planning a trip', 'Learn useful travel words.', [
        { emoji: '🎫', word: 'book a ticket', meaning: 'reservar uma passagem', example: 'I am going to book a ticket online.' },
        { emoji: '🏨', word: 'stay at a hotel', meaning: 'ficar num hotel', example: 'We are going to stay at a small hotel.' },
        { emoji: '🧳', word: 'pack a suitcase', meaning: 'fazer a mala', example: 'She is going to pack her suitcase tonight.' },
        { emoji: '🗺️', word: 'go sightseeing', meaning: 'fazer turismo', example: 'They are going to go sightseeing in Rome.' },
        { emoji: '📸', word: 'take pictures', meaning: 'tirar fotos', example: 'I am going to take a lot of pictures.' },
        { emoji: '💱', word: 'exchange money', meaning: 'trocar dinheiro', example: 'He is going to exchange money at the airport.' },
      ]),
      choose('Going to', 'Choose the correct sentence.', [
        { emoji: '✈️', options: ['I going to travel.', 'I am going to travel.', 'I am go to travel.'], answer: 1 },
        { emoji: '🏨', options: ['Are you going to stay at a hotel?', 'Do you going to stay at a hotel?', 'You are going stay at a hotel?'], answer: 0 },
        { emoji: '🚗', options: ['They is going to rent a car.', 'They are going to rent a car.', 'They are going rent a car.'], answer: 1 },
        { emoji: '🙅', options: ['She isn\'t going to fly.', 'She doesn\'t going to fly.', 'She not going to fly.'], answer: 0 },
      ]),
      match('At the airport', 'Match the word to its meaning.', [
        { left: 'boarding pass', right: 'the document you need to get on the plane' },
        { left: 'gate', right: 'where you wait to board' },
        { left: 'luggage', right: 'your bags and suitcases' },
        { left: 'delayed', right: 'later than planned' },
      ]),
      fill('Our trip to Chile', 'Use the words in the box.', ['going', 'are', 'is', 'book', 'visit'], [
        'Next July we [are] going to travel to Chile.',
        'My sister is [going] to plan the route.',
        'We are going to [book] the flights this week.',
        'Dad [is] going to drive in Santiago.',
        'We are going to [visit] a vineyard.',
      ]),
    ] },
  },
  {
    slug: 'ws-comparing-cities', level: 'A2', title: 'Comparing Cities',
    description: 'Comparativos e superlativos com cidades — 4 páginas.',
    data: { theme: 'violet', cover: '🏙️', pages: [
      learn('Compare!', 'Read the rules and examples.', [
        { emoji: '📏', word: 'bigger than', meaning: 'adjetivo curto + -er', example: 'São Paulo is bigger than Curitiba.' },
        { emoji: '💰', word: 'more expensive than', meaning: 'adjetivo longo: more', example: 'London is more expensive than Lisbon.' },
        { emoji: '🏆', word: 'the biggest', meaning: 'superlativo curto', example: 'It is the biggest city in Brazil.' },
        { emoji: '🌟', word: 'the most beautiful', meaning: 'superlativo longo', example: 'This is the most beautiful beach.' },
        { emoji: '👍', word: 'better / the best', meaning: 'good (irregular)', example: 'The food here is better.' },
        { emoji: '👎', word: 'worse / the worst', meaning: 'bad (irregular)', example: 'Traffic is the worst at 6 p.m.' },
      ]),
      choose('Choose the correct form', 'Mark the correct sentence.', [
        { emoji: '🌡️', options: ['Manaus is hoter than Porto Alegre.', 'Manaus is hotter than Porto Alegre.', 'Manaus is more hot than Porto Alegre.'], answer: 1 },
        { emoji: '🏔️', options: ['It is the most high mountain.', 'It is the highest mountain.', 'It is the higher mountain.'], answer: 1 },
        { emoji: '🚇', options: ['The subway is fast than the bus.', 'The subway is faster than the bus.', 'The subway is more faster than the bus.'], answer: 1 },
        { emoji: '🍽️', options: ['It\'s the best restaurant in town.', 'It\'s the goodest restaurant in town.', 'It\'s the better restaurant in town.'], answer: 0 },
      ]),
      match('City or countryside?', 'Match each sentence to the best ending.', [
        { left: 'The city is noisier', right: 'than the countryside.' },
        { left: 'The countryside is quieter', right: 'than the city.' },
        { left: 'Life in the city is busier', right: 'and more stressful.' },
        { left: 'The air in the countryside is', right: 'cleaner and fresher.' },
      ]),
      fill('Complete with the correct form', 'Use the words in the box.', ['cheaper', 'safer', 'most', 'busiest', 'than'], [
        'Small towns are often [safer] than big cities.',
        'The bus is [cheaper] than a taxi.',
        'Avenida Paulista is one of the [busiest] streets in Brazil.',
        'Rio is the [most] famous city in Brazil.',
        'My city is smaller [than] yours.',
      ]),
    ] },
  },
  {
    slug: 'ws-health-advice', level: 'A2', title: 'Health Problems and Advice',
    description: 'Problemas de saúde e conselhos com should — 4 páginas.',
    data: { theme: 'warm', cover: '🩺', pages: [
      learn('What\'s the matter?', 'Learn health problems and advice.', [
        { emoji: '🤕', word: 'a headache', meaning: 'dor de cabeça', example: 'You should take a break.' },
        { emoji: '🤧', word: 'a cold', meaning: 'resfriado', example: 'You should drink hot tea.' },
        { emoji: '🤒', word: 'a fever', meaning: 'febre', example: 'You should see a doctor.' },
        { emoji: '🦷', word: 'a toothache', meaning: 'dor de dente', example: 'You should go to the dentist.' },
        { emoji: '😫', word: 'a backache', meaning: 'dor nas costas', example: 'You shouldn\'t carry heavy bags.' },
        { emoji: '😴', word: 'tired', meaning: 'cansado', example: 'You should sleep eight hours.' },
      ]),
      choose('Good advice', 'Choose the best advice.', [
        { emoji: '🤒', prompt: 'I have a fever.', options: ['You should play soccer.', 'You should rest and drink water.', 'You should eat ice cream.'], answer: 1 },
        { emoji: '🦷', prompt: 'My tooth hurts.', options: ['You should go to the dentist.', 'You should eat more candy.', 'You should go to the gym.'], answer: 0 },
        { emoji: '😴', prompt: 'I\'m always tired.', options: ['You shouldn\'t sleep.', 'You should go to bed earlier.', 'You should drink more coffee at night.'], answer: 1 },
        { emoji: '🤕', prompt: 'I have a headache.', options: ['You should turn off the screen for a while.', 'You should listen to loud music.', 'You should skip lunch.'], answer: 0 },
      ]),
      match('At the doctor\'s', 'Match the doctor\'s question to the answer.', [
        { left: 'What\'s the matter?', right: 'I have a terrible cough.' },
        { left: 'How long have you felt like this?', right: 'Since Monday.' },
        { left: 'Do you have a fever?', right: 'Yes, a little.' },
        { left: 'Are you allergic to anything?', right: 'Yes, to penicillin.' },
      ]),
      fill('Should or shouldn\'t?', 'Use the words in the box.', ['should', 'shouldn\'t', 'feel', 'hurts', 'matter'], [
        'What\'s the [matter]? You look pale.',
        'My stomach [hurts] after lunch.',
        'You [should] drink more water.',
        'You [shouldn\'t] eat so much fast food.',
        'I hope you [feel] better soon!',
      ]),
    ] },
  },
  {
    slug: 'ws-directions-in-town', level: 'A2', title: 'Directions in Town',
    description: 'Lugares da cidade e como dar direções — 4 páginas.',
    data: { theme: 'sky', cover: '🧭', pages: [
      learn('Giving directions', 'Learn the expressions.', [
        { emoji: '⬆️', word: 'go straight ahead', meaning: 'siga em frente', example: 'Go straight ahead for two blocks.' },
        { emoji: '⬅️', word: 'turn left', meaning: 'vire à esquerda', example: 'Turn left at the bank.' },
        { emoji: '➡️', word: 'turn right', meaning: 'vire à direita', example: 'Turn right at the traffic lights.' },
        { emoji: '↔️', word: 'across from', meaning: 'em frente a (do outro lado)', example: 'The café is across from the park.' },
        { emoji: '🏢', word: 'next to', meaning: 'ao lado de', example: 'The pharmacy is next to the bakery.' },
        { emoji: '🏛️', word: 'between', meaning: 'entre', example: 'The museum is between the school and the hotel.' },
      ]),
      choose('Where do you go?', 'Choose the best place.', [
        { emoji: '💊', prompt: 'I need some medicine.', options: ['the pharmacy', 'the library', 'the stadium'], answer: 0 },
        { emoji: '📚', prompt: 'I want to borrow a book.', options: ['the bakery', 'the library', 'the bank'], answer: 1 },
        { emoji: '💵', prompt: 'I need to take out money.', options: ['the post office', 'the bank', 'the gym'], answer: 1 },
        { emoji: '🚆', prompt: 'I want to catch a train.', options: ['the station', 'the hospital', 'the museum'], answer: 0 },
      ]),
      match('Polite questions', 'Match the question to the answer.', [
        { left: 'Excuse me, where is the bus stop?', right: 'It\'s on the corner, next to the café.' },
        { left: 'Is the museum far from here?', right: 'No, it\'s a five-minute walk.' },
        { left: 'How do I get to the station?', right: 'Go straight and turn left.' },
        { left: 'Is there a bank near here?', right: 'Yes, across from the school.' },
      ]),
      fill('Complete the directions', 'Use the words in the box.', ['straight', 'left', 'across', 'corner', 'between'], [
        'Go [straight] ahead until the traffic lights.',
        'Then turn [left] onto Rose Street.',
        'The hotel is [across] from the park.',
        'The bakery is on the [corner].',
        'The cinema is [between] the bank and the gym.',
      ]),
    ] },
  },
  // ====================================================================== B2
  {
    slug: 'ws-environment-issues', level: 'B2', title: 'Environmental Issues',
    description: 'Vocabulário ambiental, voz passiva e soluções — 4 páginas.',
    data: { theme: 'sky', cover: '🌍', pages: [
      learn('Key vocabulary', 'Read the definitions and examples.', [
        { emoji: '🏭', word: 'carbon emissions', meaning: 'emissões de carbono', example: 'Carbon emissions must be reduced by half.' },
        { emoji: '🌳', word: 'deforestation', meaning: 'desmatamento', example: 'Deforestation is driven by cattle farming.' },
        { emoji: '♻️', word: 'sustainable', meaning: 'sustentável', example: 'We need more sustainable packaging.' },
        { emoji: '🌡️', word: 'global warming', meaning: 'aquecimento global', example: 'Global warming is causing extreme weather.' },
        { emoji: '⚡', word: 'renewable energy', meaning: 'energia renovável', example: 'Renewable energy is becoming cheaper.' },
        { emoji: '🗑️', word: 'landfill', meaning: 'aterro sanitário', example: 'Most plastic still ends up in landfills.' },
      ]),
      choose('Passive or active?', 'Choose the correct passive sentence.', [
        { emoji: '🌲', options: ['Millions of trees cut down every year.', 'Millions of trees are cut down every year.', 'Millions of trees are cutting down every year.'], answer: 1 },
        { emoji: '🏛️', options: ['A new law has been approved.', 'A new law has approved.', 'A new law have been approved.'], answer: 0 },
        { emoji: '🔬', options: ['The study was carried out by experts.', 'The study carried out by experts.', 'The study was carry out by experts.'], answer: 0 },
        { emoji: '☀️', options: ['Solar panels will installed next year.', 'Solar panels will be installed next year.', 'Solar panels will be install next year.'], answer: 1 },
      ]),
      match('Problems and solutions', 'Match each problem to a solution.', [
        { left: 'Plastic pollution in the oceans', right: 'banning single-use plastics' },
        { left: 'Air pollution in big cities', right: 'investing in public transport' },
        { left: 'Water shortages', right: 'fixing leaks and reusing water' },
        { left: 'Loss of biodiversity', right: 'creating protected areas' },
      ]),
      fill('Complete the report', 'Use the words in the box.', ['been', 'being', 'by', 'were', 'will'], [
        'Last year, more than 2 million hectares [were] lost to fires.',
        'Several measures have [been] taken since then.',
        'New areas are [being] monitored by satellites.',
        'The data was collected [by] an independent agency.',
        'Results [will] be published in March.',
      ]),
    ] },
  },
  {
    slug: 'ws-job-interview', level: 'B2', title: 'Job Interview Language',
    description: 'Expressões de entrevista, pontos fortes e perguntas difíceis — 4 páginas.',
    data: { theme: 'violet', cover: '💼', pages: [
      learn('Useful expressions', 'Learn how to talk about yourself professionally.', [
        { emoji: '🎯', word: 'I\'m a fast learner', meaning: 'aprendo rápido', example: 'I\'m a fast learner and I adapt quickly.' },
        { emoji: '🤝', word: 'team player', meaning: 'trabalha bem em equipe', example: 'I consider myself a team player.' },
        { emoji: '📈', word: 'track record', meaning: 'histórico de resultados', example: 'I have a solid track record in sales.' },
        { emoji: '⏱️', word: 'meet deadlines', meaning: 'cumprir prazos', example: 'I always meet deadlines, even under pressure.' },
        { emoji: '🧩', word: 'problem-solving skills', meaning: 'habilidade de resolver problemas', example: 'My problem-solving skills helped the team.' },
        { emoji: '🌱', word: 'room for growth', meaning: 'espaço para crescer', example: 'I\'m looking for a role with room for growth.' },
      ]),
      choose('The best answer', 'Choose the most professional answer.', [
        { emoji: '❓', prompt: 'Why do you want this job?', options: ['Because I need money.', 'Because the role matches my experience and goals.', 'I don\'t really know.'], answer: 1 },
        { emoji: '⚠️', prompt: 'What is your main weakness?', options: ['I have no weaknesses.', 'I used to struggle with delegating, so I started using clear checklists.', 'I\'m lazy.'], answer: 1 },
        { emoji: '🔭', prompt: 'Where do you see yourself in five years?', options: ['Leading projects in this area.', 'In your chair.', 'On a beach.'], answer: 0 },
        { emoji: '💬', prompt: 'Do you have any questions for us?', options: ['No.', 'How is success measured in this role?', 'When can I go on vacation?'], answer: 1 },
      ]),
      match('Formal equivalents', 'Match the informal phrase to the formal one.', [
        { left: 'I\'m good at talking to people.', right: 'I have strong communication skills.' },
        { left: 'I did a lot of projects.', right: 'I have led several projects.' },
        { left: 'I want more money.', right: 'I\'m looking for a competitive package.' },
        { left: 'My last boss was terrible.', right: 'I\'m looking for a different management style.' },
      ]),
      fill('Complete the answer', 'Use the words in the box.', ['have', 'been', 'responsible', 'led', 'achieved'], [
        'I [have] worked in marketing for six years.',
        'For the last two years, I have [been] managing a team of five.',
        'I was [responsible] for the company\'s social media strategy.',
        'I [led] a campaign that increased sales by 20%.',
        'We [achieved] our targets three quarters in a row.',
      ]),
    ] },
  },
  {
    slug: 'ws-conditionals-real-life', level: 'B2', title: 'Conditionals in Real Life',
    description: 'Zero, first, second e third conditionals em situações reais — 4 páginas.',
    data: { theme: 'warm', cover: '🔀', pages: [
      learn('Four conditionals', 'Read the structure and the example.', [
        { emoji: '🧪', word: 'Zero', meaning: 'if + present, present (fatos)', example: 'If you heat ice, it melts.' },
        { emoji: '📆', word: 'First', meaning: 'if + present, will (futuro provável)', example: 'If it rains, we will stay home.' },
        { emoji: '💭', word: 'Second', meaning: 'if + past, would (imaginário)', example: 'If I won the lottery, I would travel.' },
        { emoji: '⏪', word: 'Third', meaning: 'if + past perfect, would have (passado irreal)', example: 'If I had studied, I would have passed.' },
        { emoji: '🙏', word: 'I wish', meaning: 'desejo / arrependimento', example: 'I wish I had more time.' },
        { emoji: '🚫', word: 'Unless', meaning: 'a menos que', example: 'Unless you hurry, you\'ll miss the bus.' },
      ]),
      choose('Which conditional?', 'Choose the correct sentence.', [
        { emoji: '🌧️', options: ['If it will rain, I take an umbrella.', 'If it rains, I\'ll take an umbrella.', 'If it rained, I will take an umbrella.'], answer: 1 },
        { emoji: '💸', options: ['If I had money, I would buy a house.', 'If I have money, I would buy a house.', 'If I would have money, I buy a house.'], answer: 0 },
        { emoji: '🚌', options: ['If she left earlier, she wouldn\'t have missed the bus.', 'If she had left earlier, she wouldn\'t have missed the bus.', 'If she has left earlier, she won\'t miss the bus.'], answer: 1 },
        { emoji: '🧊', options: ['If you freeze water, it becomes ice.', 'If you froze water, it would become ice yesterday.', 'If you will freeze water, it becomes ice.'], answer: 0 },
      ]),
      match('Complete the thought', 'Match the beginnings and endings.', [
        { left: 'If I were the president,', right: 'I would invest more in education.' },
        { left: 'If you mix blue and yellow,', right: 'you get green.' },
        { left: 'If we don\'t book now,', right: 'there won\'t be any seats left.' },
        { left: 'If I had known about the party,', right: 'I would have gone.' },
      ]),
      fill('Complete the sentences', 'Use the words in the box.', ['were', 'would', 'had', 'unless', 'will'], [
        'If I [were] you, I would apologize.',
        'She [would] travel more if she had time.',
        'If they [had] asked, I would have helped.',
        'We won\'t finish on time [unless] everyone helps.',
        'If you call him now, he [will] answer.',
      ]),
    ] },
  },
  {
    slug: 'ws-technology-collocations', level: 'B2', title: 'Technology Collocations',
    description: 'Combinações de palavras sobre tecnologia e vida digital — 4 páginas.',
    data: { theme: 'violet', cover: '💻', pages: [
      learn('Words that go together', 'Learn natural technology collocations.', [
        { emoji: '⬇️', word: 'download an update', meaning: 'baixar uma atualização', example: 'Download the update before the meeting.' },
        { emoji: '🔐', word: 'change your password', meaning: 'trocar a senha', example: 'You should change your password regularly.' },
        { emoji: '☁️', word: 'back up your files', meaning: 'fazer backup', example: 'Always back up your files to the cloud.' },
        { emoji: '📶', word: 'a weak signal', meaning: 'sinal fraco', example: 'There is a weak signal in the basement.' },
        { emoji: '🔋', word: 'run out of battery', meaning: 'acabar a bateria', example: 'My phone ran out of battery.' },
        { emoji: '🛡️', word: 'protect your privacy', meaning: 'proteger sua privacidade', example: 'These settings help protect your privacy.' },
      ]),
      choose('Choose the natural collocation', 'Mark the most natural option.', [
        { emoji: '🔐', options: ['make a password', 'set a password', 'do a password'], answer: 1 },
        { emoji: '📧', options: ['send an email', 'throw an email', 'post an email to'], answer: 0 },
        { emoji: '🌐', options: ['surf the internet', 'swim the internet', 'drive the internet'], answer: 0 },
        { emoji: '📱', options: ['charge your phone', 'fill your phone', 'feed your phone'], answer: 0 },
      ]),
      match('Digital problems', 'Match the problem to the solution.', [
        { left: 'My laptop is very slow.', right: 'Close some programs and restart it.' },
        { left: 'I forgot my password.', right: 'Click "Forgot password" to reset it.' },
        { left: 'I deleted an important file.', right: 'Restore it from your backup.' },
        { left: 'I get too many notifications.', right: 'Turn them off in the settings.' },
      ]),
      fill('Complete the advice', 'Use the words in the box.', ['back', 'run', 'install', 'two-factor', 'settings'], [
        'Don\'t forget to [back] up your photos every month.',
        'Always [install] updates from official stores only.',
        'Turn on [two-factor] authentication for your bank app.',
        'Check the privacy [settings] of every new app.',
        'Carry a charger so you don\'t [run] out of battery.',
      ]),
    ] },
  },
  {
    slug: 'ws-reported-speech', level: 'B2', title: 'Reported Speech',
    description: 'Discurso indireto: mudanças de tempo verbal e de palavras — 4 páginas.',
    data: { theme: 'sunrise', cover: '🗣️', pages: [
      learn('Direct → reported', 'Study how the verbs change.', [
        { emoji: '1️⃣', word: 'present → past', meaning: '"I am tired."', example: 'She said she was tired.' },
        { emoji: '2️⃣', word: 'past → past perfect', meaning: '"I lost my keys."', example: 'He said he had lost his keys.' },
        { emoji: '3️⃣', word: 'will → would', meaning: '"I will call you."', example: 'She said she would call me.' },
        { emoji: '4️⃣', word: 'can → could', meaning: '"I can help."', example: 'He said he could help.' },
        { emoji: '❓', word: 'questions', meaning: '"Where do you live?"', example: 'She asked me where I lived.' },
        { emoji: '📍', word: 'here → there, today → that day', meaning: 'mudanças de tempo e lugar', example: 'He said he would come the next day.' },
      ]),
      choose('Choose the reported sentence', 'Mark the correct option.', [
        { emoji: '💬', prompt: '"I love this city," said Ana.', options: ['Ana said she loves this city.', 'Ana said she loved that city.', 'Ana said I loved this city.'], answer: 1 },
        { emoji: '💬', prompt: '"We will finish tomorrow," they said.', options: ['They said they would finish the next day.', 'They said they will finish tomorrow.', 'They said we would finish tomorrow.'], answer: 0 },
        { emoji: '❓', prompt: '"Are you ready?" he asked.', options: ['He asked if I was ready.', 'He asked was I ready.', 'He asked if am I ready.'], answer: 0 },
        { emoji: '💬', prompt: '"I have seen that movie," she said.', options: ['She said she has seen that movie.', 'She said she had seen that movie.', 'She said she saw this movie.'], answer: 1 },
      ]),
      match('Reporting verbs', 'Match the direct speech to the reporting verb.', [
        { left: '"You should rest."', right: 'She advised me to rest.' },
        { left: '"I didn\'t take it!"', right: 'He denied taking it.' },
        { left: '"I\'ll help you, I promise."', right: 'She promised to help me.' },
        { left: '"Let\'s go to the beach."', right: 'He suggested going to the beach.' },
      ]),
      fill('Report what they said', 'Use the words in the box.', ['was', 'had', 'would', 'if', 'could'], [
        '"I\'m busy." → He said he [was] busy.',
        '"I finished the report." → She said she [had] finished the report.',
        '"I\'ll be late." → Tom said he [would] be late.',
        '"Can you swim?" → She asked [if] I could swim.',
        '"I can drive." → He said he [could] drive.',
      ]),
    ] },
  },
];
