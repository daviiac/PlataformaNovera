'use strict';

/**
 * Música — quizzes nos clipes OFICIAIS do YouTube (canais dos artistas/gravadoras).
 *
 * As perguntas são originais da Novera: vocabulário, tema da música, sentimentos,
 * expressões e curiosidades. A letra NÃO é reproduzida (direitos autorais): o aluno
 * ouve a música no clipe e responde às perguntas que aparecem durante o vídeo.
 *
 * Os tempos das perguntas são distribuídos ao longo do clipe (20%, 38%, 56%, 74% e 90%).
 */
const POINTS = [0.2, 0.38, 0.56, 0.74, 0.9];
const q = (prompt, options, answer = 0) => ({ prompt, options, answer });

function song(slug, level, title, artist, youtubeId, duration, description, questions) {
  return {
    slug: `music-${slug}`,
    level,
    title: `${title} — ${artist}`,
    description,
    data: {
      mode: 'quiz',
      artist,
      youtubeId,
      questions: questions.map((it, i) => ({ ...it, time: Math.round(duration * POINTS[i % POINTS.length]) })),
    },
  };
}

/** Embaralha as alternativas de forma fixa (a correta não fica sempre em primeiro). */
function shuffle(list) {
  return list.map((a, ai) => ({
    ...a,
    data: {
      ...a.data,
      questions: a.data.questions.map((it, qi) => {
        const shift = (ai + qi) % it.options.length;
        const options = [...it.options.slice(shift), ...it.options.slice(0, shift)];
        return { ...it, options, answer: (it.answer - shift + it.options.length) % it.options.length };
      }),
    },
  }));
}

const A1 = [
  song('under-the-sea', 'A1', 'Under the Sea', 'Samuel E. Wright (The Little Mermaid)', 'GC_mV1IpjWA', 207,
    'Do filme A Pequena Sereia: a vida no fundo do mar. Animais marinhos e vocabulário de lugares.', [
      q('Where does this song take place?', ['Under the sea', 'In a big city', 'In the desert']),
      q('Who sings the song in the movie?', ['Sebastian, a crab', 'A big dog', 'A princess on a horse']),
      q('A "crab" is…', ['A sea animal with claws', 'A kind of bird', 'A type of fruit']),
      q('Sebastian thinks life under the sea is…', ['Better than life on land', 'Boring and sad', 'Very dangerous']),
      q('In the video, the sea animals…', ['Play music and dance', 'Sleep all the time', 'Go to school']),
    ]),
  song('yellow-submarine', 'A1', 'Yellow Submarine', 'The Beatles', 'm2uTFF_3MaA', 165,
    'Clássico dos Beatles em desenho animado. Cores, o mar e a vida com os amigos.', [
      q('What color is the submarine?', ['Yellow', 'Red', 'Blue']),
      q('A "submarine" is…', ['A boat that goes under the water', 'A plane', 'A train']),
      q('The video is…', ['A colorful cartoon', 'A football game', 'A cooking show']),
      q('In the song, the friends live…', ['Together in the submarine', 'In a castle', 'In a school']),
      q('The mood of the song is…', ['Happy and fun', 'Sad', 'Scary']),
    ]),
  song('die-with-a-smile', 'A1', 'Die With A Smile', 'Lady Gaga & Bruno Mars', 'kPa7bsKwL-c', 253,
    'Dueto romântico: amor, futuro e o vocabulário de sentimentos.', [
      q('Who sings this song?', ['Lady Gaga and Bruno Mars', 'Taylor Swift and Ed Sheeran', 'Adele and Drake']),
      q('What is the main topic of the song?', ['Being with the person you love until the end', 'Winning a lot of money', 'Traveling to space']),
      q('A "smile" is…', ['What you do with your mouth when you are happy', 'A type of food', 'A sad feeling']),
      q('If the world ends, the singers want to be…', ['Next to the person they love', 'At work', 'Alone at home']),
      q('This song is a…', ['Romantic duet', 'Rap battle', 'Song for children']),
    ]),
  song('happy', 'A1', 'Happy', 'Pharrell Williams', 'y6Sxv-sUYtM', 247,
    'Uma das músicas mais alegres do mundo. Sentimentos e palavras do dia a dia.', [
      q('What feeling is this song about?', ['Happiness', 'Sadness', 'Fear']),
      q('"Happy" is the opposite of…', ['Sad', 'Tall', 'Fast']),
      q('In the music video, people are…', ['Dancing in the street', 'Sleeping', 'Studying in a library']),
      q('"Clap along" means…', ['Clap your hands with the music', 'Close your eyes', 'Run away']),
      q('This song is from the movie…', ['Despicable Me 2', 'Frozen', 'Toy Story']),
    ]),
  song('birds-of-a-feather', 'A1', 'Birds of a Feather', 'Billie Eilish', 'V9PVRfjEBTI', 231,
    'Uma declaração de amor delicada. Expressão idiomática e vocabulário de tempo.', [
      q('Who sings this song?', ['Billie Eilish', 'Miley Cyrus', 'Dua Lipa']),
      q('The expression "birds of a feather" is about people who…', ['Are similar and stay together', 'Are afraid of birds', 'Work on a farm']),
      q('What does the singer want?', ['To stay with the person she loves forever', 'To fly to another country', 'To buy a bird']),
      q('"Forever" means…', ['For all time', 'For one day', 'Never']),
      q('The feeling of the song is…', ['Romantic and sweet', 'Angry', 'Scary']),
    ]),
  song('bare-necessities', 'A1', 'The Bare Necessities', 'The Jungle Book', 'c6e3ITsjLRI', 245,
    'Do filme Mogli: viver com simplicidade e sem preocupação. Animais, comida e a natureza.', [
      q('Who sings this song in the movie?', ['Baloo, a big bear', 'A tiger', 'A fish']),
      q('Where do Baloo and Mowgli live?', ['In the jungle', 'In a big city', 'On a ship']),
      q('"Necessities" are…', ['Things you really need', 'Things you hate', 'Expensive toys']),
      q('The message of the song is…', ['Relax and enjoy the simple things', 'Work all day and night', 'Buy many things']),
      q('In the video, Baloo eats…', ['Fruit, like bananas', 'Pizza', 'Ice cream']),
    ]),
  song('ordinary', 'A1', 'Ordinary', 'Alex Warren', 'u2ah9tWTkmk', 187,
    'Uma balada sobre um amor que deixa a vida especial. Adjetivos e opostos.', [
      q('What is the song about?', ['A love that makes life feel special', 'A boring day at work', 'A car race']),
      q('"Ordinary" means…', ['Normal, common', 'Amazing', 'Dangerous']),
      q('For the singer, his love is…', ['Special, not ordinary', 'Boring', 'A big problem']),
      q('The singer\'s voice is…', ['Strong and emotional', 'Like a robot', 'Very quiet all the time']),
      q('Which word is the opposite of "ordinary"?', ['Extraordinary', 'Normal', 'Usual']),
    ]),
  song('beautiful-things', 'A1', 'Beautiful Things', 'Benson Boone', 'Oa_RSwwpPaA', 193,
    'Gratidão e medo de perder o que é importante. Sentimentos e família.', [
      q('The "beautiful things" in the song are…', ['The good things in his life, like love and family', 'Expensive cars', 'Old clothes']),
      q('What is the singer afraid of?', ['Losing the good things he has', 'Dogs', 'The dark']),
      q('"Afraid" means…', ['Scared', 'Happy', 'Hungry']),
      q('The song starts slow and then…', ['Becomes loud and intense', 'Stops', 'Becomes a rap']),
      q('Benson Boone is famous for doing ___ on stage.', ['Backflips', 'Cooking shows', 'Paintings']),
    ]),
  song('golden', 'A1', 'Golden', 'HUNTR/X (KPop Demon Hunters)', 'yebNIHKAC4A', 199,
    'O hit do filme KPop Demon Hunters. Cores, brilho e confiança.', [
      q('This song is from the movie…', ['KPop Demon Hunters', 'Frozen', 'Moana']),
      q('"Golden" is a color like…', ['Gold', 'Grass', 'The sea']),
      q('The song is about…', ['Shining and becoming who you really are', 'Losing a phone', 'Cleaning the house']),
      q('In the movie, the singers are…', ['A K-pop girl group that fights demons', 'Teachers', 'Doctors']),
      q('"To shine" means…', ['To give light, to be bright', 'To sleep', 'To cry']),
    ]),
  song('friend-in-me', 'A1', 'You\'ve Got a Friend in Me', 'Toy Story (Disney Junior)', 'TewGnflYXl4', 80,
    'Do filme Toy Story: o valor da amizade. Vocabulário de brinquedos e o verbo "have got".', [
      q('What is the song about?', ['Friendship', 'Food', 'The weather']),
      q('Woody and Buzz are…', ['Toys', 'Teachers', 'Doctors']),
      q('Complete: "You ___ got a friend."', ['have', 'has', 'having']),
      q('A good friend…', ['Helps you when you have a problem', 'Never talks to you', 'Takes your toys']),
      q('The mood of the song is…', ['Happy and friendly', 'Angry', 'Scary']),
    ]),
];

const A2 = [
  song('cant-stop-the-feeling', 'A2', 'Can\'t Stop the Feeling!', 'Justin Timberlake', 'ru0K8uYEZWw', 286,
    'Do filme Trolls: uma música para dançar. Sentimentos, verbos de movimento e "can\'t".', [
      q('This song is from the animated movie…', ['Trolls', 'Cars', 'Shrek']),
      q('The song makes people want to…', ['Dance', 'Sleep', 'Cry']),
      q('"Can\'t stop" means…', ['Not able to stop', 'Want to start', 'Need to leave']),
      q('In the video, people dance…', ['In everyday places, like a diner and a shop', 'Under the sea', 'In an airplane']),
      q('The mood of the song is…', ['Joyful and energetic', 'Dark and angry', 'Quiet and sleepy']),
    ]),
  song('a-whole-new-world', 'A2', 'A Whole New World', 'Mena Massoud & Naomi Scott (Aladdin)', 'eitDnP0_83k', 190,
    'Do filme Aladdin: uma viagem num tapete mágico. Adjetivos, lugares e o mundo.', [
      q('How do Aladdin and Jasmine travel in the song?', ['On a magic carpet', 'By train', 'On a horse']),
      q('"A whole new world" means…', ['A completely different place or experience', 'A small house', 'An old map']),
      q('Jasmine feels…', ['Free and amazed', 'Bored', 'Angry']),
      q('The song happens…', ['At night, under the stars', 'At lunchtime in a school', 'In the rain']),
      q('This song is a…', ['Romantic duet', 'Rap battle', 'Rock song with screaming']),
    ]),
  song('dynamite', 'A2', 'Dynamite', 'BTS', 'gdZLi9oWNZg', 223,
    'O primeiro hit do BTS todo em inglês. Energia, cores e vocabulário de festa.', [
      q('Which group sings this song?', ['BTS', 'BLACKPINK', 'One Direction']),
      q('BTS is from…', ['South Korea', 'Japan', 'The USA']),
      q('"Dynamite" was BTS\'s first song fully in…', ['English', 'Spanish', 'French']),
      q('The style of the song is…', ['Disco pop, happy and colorful', 'Heavy metal', 'Opera']),
      q('"Shining" means…', ['Giving off a bright light', 'Very cold', 'Hiding']),
    ]),
  song('build-a-snowman', 'A2', 'Do You Want to Build a Snowman?', 'Frozen', 'xz4zU-XCsP0', 58,
    'Do filme Frozen: Anna quer brincar com a irmã. Perguntas com "do you want to…?" e brincadeiras.', [
      q('Who sings this song?', ['Anna, Elsa\'s sister', 'Olaf', 'Kristoff']),
      q('Anna wants to…', ['Play with her sister', 'Go to sleep', 'Study math']),
      q('Complete: "Do you want ___ build a snowman?"', ['to', 'for', 'at']),
      q('A "snowman" is made of…', ['Snow', 'Sand', 'Paper']),
      q('Why is Anna sad?', ['Her sister doesn\'t open the door', 'She lost her shoes', 'It is too hot']),
    ]),
  song('what-makes-you-beautiful', 'A2', 'What Makes You Beautiful', 'One Direction', 'QJO3ROT-A4E', 206,
    'Um clássico do pop. Adjetivos, elogios e autoconfiança.', [
      q('Which band sings this song?', ['One Direction', 'Coldplay', 'BTS']),
      q('The song tells a girl that…', ['She is beautiful but doesn\'t know it', 'She is late for school', 'She has to move away']),
      q('"Insecure" means…', ['Not confident', 'Very rich', 'Very loud']),
      q('The music video was filmed…', ['On a beach', 'In a hospital', 'On the moon']),
      q('The opposite of "beautiful" is…', ['Ugly', 'Kind', 'Young']),
    ]),
  song('try-everything', 'A2', 'Try Everything', 'Shakira', 'c6rP-YP4c5I', 202,
    'Do filme Zootopia: nunca desistir. Verbos e expressões de incentivo.', [
      q('This song is from the movie…', ['Zootopia', 'Moana', 'Coco']),
      q('The message of the song is…', ['Keep trying, even when you make mistakes', 'Never leave your house', 'Always win at everything']),
      q('"Make a mistake" means…', ['Do something wrong', 'Make food', 'Make a friend']),
      q('"Give up" means…', ['Stop trying', 'Get up early', 'Give a gift']),
      q('In Zootopia, Shakira\'s character is…', ['Gazelle, a pop star', 'A police officer', 'A teacher']),
    ]),
  song('into-the-unknown', 'A2', 'Into the Unknown', 'Idina Menzel & AURORA (Frozen 2)', 'cGlJS-5c_XY', 185,
    'Do filme Frozen 2: Elsa ouve uma voz misteriosa. Vocabulário de aventura e o futuro.', [
      q('Who sings this song?', ['Elsa', 'Anna', 'Olaf']),
      q('"The unknown" means…', ['Something you don\'t know yet', 'Your best friend', 'Your house']),
      q('Elsa hears…', ['A mysterious voice', 'A phone ringing', 'A dog barking']),
      q('At first, Elsa wants to…', ['Ignore the voice and stay safe', 'Go shopping', 'Sleep']),
      q('Elsa\'s magic power is…', ['Ice and snow', 'Fire', 'Flying']),
    ]),
  song('drivers-license', 'A2', 'drivers license', 'Olivia Rodrigo', 'ZmDBbnmKpqQ', 247,
    'A música que lançou Olivia Rodrigo. Passado, lembranças e sentimentos.', [
      q('The singer just got her…', ['Driver\'s license', 'Diploma', 'Passport']),
      q('She feels…', ['Heartbroken', 'Excited about a trip', 'Angry with her parents']),
      q('While she drives alone, she…', ['Remembers her ex', 'Listens to the news', 'Talks to her friends']),
      q('"Heartbroken" means…', ['Very sad after a relationship ends', 'Very healthy', 'Very busy']),
      q('This song became a huge hit in…', ['2021', '2011', '2001']),
    ]),
  song('how-far-ill-go', 'A2', 'How Far I\'ll Go', 'Auli\'i Cravalho', 'cPAbx5kgCJo', 156,
    'Do filme Moana: o desejo de explorar o mundo. Natureza e o futuro com "will".', [
      q('This song is from the movie…', ['Moana', 'Frozen', 'Encanto']),
      q('Moana loves…', ['The ocean', 'The desert', 'Snow']),
      q('In the song, she wants to…', ['Sail beyond her island and explore', 'Stay at home forever', 'Go to school in a big city']),
      q('An "island" is…', ['Land with water all around it', 'A tall mountain', 'A big city']),
      q('"Far" is the opposite of…', ['Near', 'Fast', 'High']),
    ]),
  song('feelslikeimfallinginlove', 'A2', 'feelslikeimfallinginlove', 'Coldplay', 'V3IVdLo-2NM', 261,
    'Coldplay otimista. Expressões com "fall" e sentimentos.', [
      q('The title means…', ['It feels like I\'m falling in love', 'I fell down the stairs', 'I don\'t love anyone']),
      q('"To fall in love" means…', ['To start loving someone', 'To fall on the floor', 'To stop loving someone']),
      q('The mood of the song is…', ['Hopeful and happy', 'Angry', 'Scary']),
      q('Coldplay is a band from…', ['The United Kingdom', 'Canada', 'Mexico']),
      q('The lead singer of Coldplay is…', ['Chris Martin', 'Harry Styles', 'Bruno Mars']),
    ]),
];

const B2 = [
  song('counting-stars', 'B2', 'Counting Stars', 'OneRepublic', 'hT_nvWreIhg', 283,
    'Sonhos versus dinheiro e dúvidas sobre o certo e o errado. Expressões e contrastes.', [
      q('"Losing sleep" means…', ['Not sleeping well because of worries or thoughts', 'Sleeping too much', 'Losing your bed']),
      q('"Counting stars" instead of "counting dollars" suggests that…', ['Dreams matter more than money', 'Money is the only thing that matters', 'Astronomy is a good job']),
      q('The narrator feels torn between…', ['What is right and what feels good', 'Two different cities', 'Two jobs']),
      q('The music video takes place…', ['In a basement, while people sing in a church upstairs', 'On a farm', 'In a school classroom']),
      q('OneRepublic is a band from…', ['The USA', 'Ireland', 'Australia']),
    ]),
  song('speechless', 'B2', 'Speechless', 'Naomi Scott (Aladdin)', 'mw5VIEIvuMI', 206,
    'Do filme Aladdin: Jasmine se recusa a ficar calada. Vocabulário de coragem, voz e liberdade.', [
      q('"Speechless" means…', ['Unable to speak', 'Very talkative', 'Very fast']),
      q('In the song, Jasmine decides that she…', ['Won\'t be silenced anymore', 'Will leave the city forever', 'Wants to be quiet']),
      q('The video shows Naomi Scott…', ['Recording the song with an orchestra', 'Playing football', 'Cooking']),
      q('"To be silenced" means…', ['To be forced to stop talking', 'To sing louder', 'To fall asleep']),
      q('The main theme of the song is…', ['Courage and using your voice', 'A summer holiday', 'Losing a game']),
    ]),
  song('what-was-i-made-for', 'B2', 'What Was I Made For?', 'Billie Eilish', 'cW8VLC9nnTo', 249,
    'Identidade e propósito. Vocabulário abstrato e interpretação.', [
      q('The song was written for the movie…', ['Barbie (2023)', 'Wicked', 'Frozen II']),
      q('The narrator is questioning…', ['Her identity and purpose', 'The price of a dress', 'Her travel plans']),
      q('"Purpose" means…', ['The reason why something exists or is done', 'A kind of fish', 'A loud noise']),
      q('The mood of the song is…', ['Reflective and melancholic', 'Aggressive', 'Silly']),
      q('Which award did this song win?', ['The Oscar for Best Original Song', 'The FIFA World Cup', 'The Nobel Prize']),
    ]),
  song('brave', 'B2', 'Brave', 'Sara Bareilles', 'QUQsqBqxoR4', 238,
    'Coragem para dizer o que pensa. Expressões sobre falar, calar e se mostrar.', [
      q('The song encourages listeners to…', ['Speak up and say what they really think', 'Stay silent', 'Copy other people']),
      q('"Brave" means…', ['Courageous, not afraid', 'Lazy', 'Rude']),
      q('In the music video, people…', ['Dance freely in public places', 'Run a marathon', 'Paint a house']),
      q('"To speak your mind" means…', ['To say what you really think', 'To read in silence', 'To forget everything']),
      q('The tone of the song is…', ['Supportive and empowering', 'Angry and violent', 'Bored']),
    ]),
  song('fix-you', 'B2', 'Fix You', 'Coldplay', 'k4V3Mo61fJM', 294,
    'Consolar alguém num momento difícil. Vocabulário de emoções e apoio.', [
      q('The song is about…', ['Comforting someone who is going through a hard time', 'Repairing a car', 'Winning a race']),
      q('Here, "fix" means…', ['To help someone feel better', 'To break something', 'To paint something']),
      q('"Comfort" means…', ['To make someone feel less sad', 'To make fun of someone', 'To ignore someone']),
      q('The song starts with…', ['A soft organ', 'Bagpipes', 'A harmonica']),
      q('The song grows from quiet to…', ['A big emotional ending with guitars and drums', 'Total silence', 'A rap section']),
    ]),
  song('unwritten', 'B2', 'Unwritten', 'Natasha Bedingfield', 'b7k0a5hYnSI', 225,
    'A vida como um livro ainda em branco. Metáforas, prefixo "un-" e futuro.', [
      q('"Unwritten" means…', ['Not written yet', 'Badly written', 'Written in another language']),
      q('In the song, life is compared to…', ['A book', 'A car', 'A song contest']),
      q('The main idea is that…', ['Your future is a blank page that you can create', 'You must follow old rules', 'Writing is boring']),
      q('The song encourages you to…', ['Live in the moment and take chances', 'Stay inside all day', 'Never change']),
      q('In 2023 the song became popular again because of the movie…', ['Anyone But You', 'Frozen', 'Top Gun']),
    ]),
  song('hall-of-fame', 'B2', 'Hall of Fame', 'The Script ft. will.i.am', 'mk48xRzuNvA', 233,
    'Acreditar em si mesmo para chegar longe. Motivação, metas e vocabulário de conquistas.', [
      q('A "hall of fame" is…', ['A place that honors the greatest people in an area', 'A big kitchen', 'A school corridor']),
      q('The message of the song is…', ['You can be great if you believe in yourself and work hard', 'Fame is dangerous', 'Only rich people succeed']),
      q('"Determination" means…', ['Not giving up until you reach your goal', 'Being very tired', 'Being afraid']),
      q('The Script is a band from…', ['Ireland', 'Australia', 'Canada']),
      q('will.i.am is also a member of…', ['The Black Eyed Peas', 'Coldplay', 'Maroon 5']),
    ]),
  song('let-it-go', 'B2', 'Let It Go', 'Idina Menzel', 'L0MK7qz13bU', 223,
    'Do filme Frozen: parar de se esconder e se sentir livre. Phrasal verbs e emoções.', [
      q('This song is from the movie…', ['Frozen', 'Moana', 'Tangled']),
      q('Elsa sings it when she…', ['Stops hiding her powers and feels free', 'Gets married', 'Loses a competition']),
      q('"Let it go" means…', ['Stop worrying about something and move on', 'Catch something', 'Go to sleep']),
      q('Elsa\'s powers are related to…', ['Ice and snow', 'Fire', 'Water']),
      q('"Conceal" means…', ['To hide', 'To show', 'To freeze']),
    ]),
  song('colors-of-the-wind', 'B2', 'Colors of the Wind', 'Pocahontas', 'nI9BkfcZAMA', 58,
    'Do filme Pocahontas: respeito à natureza e às outras culturas. Metáforas e vocabulário abstrato.', [
      q('The main message of the song is…', ['Respect nature and other people', 'Cities are better than forests', 'Money is the most important thing']),
      q('Pocahontas says that every rock, tree and creature…', ['Has a life and a spirit', 'Belongs to someone', 'Is worthless']),
      q('"The colors of the wind" is…', ['A metaphor for things you can only see with an open mind', 'A real rainbow', 'A painting technique']),
      q('Pocahontas sings to…', ['John Smith, an English explorer', 'Her teacher', 'A king']),
      q('The song criticizes people who…', ['Think they own the land they walk on', 'Love animals', 'Sing in the forest']),
    ]),
  song('viva-la-vida', 'B2', 'Viva La Vida', 'Coldplay', 'dvgZkm1xWPE', 243,
    'Um rei que perdeu o poder. Narrativa no passado e metáforas históricas.', [
      q('The narrator used to be…', ['A king who ruled the world', 'A farmer', 'A sailor']),
      q('Now he…', ['Has lost his power', 'Is richer than ever', 'Is getting married']),
      q('"Viva la vida" is Spanish for…', ['Long live life', 'Goodbye forever', 'I love you']),
      q('The song is famous for its…', ['Strings (violins) and big drums', 'Electric guitar solos only', 'Lack of instruments']),
      q('The main theme is…', ['The fall from power and regret', 'A summer holiday', 'Learning to cook']),
    ]),
];

module.exports = shuffle([...A1, ...A2, ...B2]);
