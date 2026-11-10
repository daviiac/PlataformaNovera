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
  song('perfect', 'A1', 'Perfect', 'Ed Sheeran', '2Vv-BfVoq4g', 282,
    'Uma das músicas de amor mais famosas do mundo. Vocabulário de sentimentos e descrições.', [
      q('What is this song about?', ['Love for a partner', 'A trip to the beach', 'A football game']),
      q('The word "perfect" means…', ['Very good, with no problems', 'Very tired', 'Very angry']),
      q('In the song, the couple…', ['Dance together', 'Cook dinner', 'Play video games']),
      q('"Barefoot" means…', ['Without shoes', 'With a hat', 'In a car']),
      q('How does the singer feel about his partner?', ['He is in love', 'He is bored', 'He is scared']),
    ]),
  song('flowers', 'A1', 'Flowers', 'Miley Cyrus', 'G7KNmW9a75Y', 202,
    'Uma música sobre amor-próprio depois de um término. Sentimentos e expressões do dia a dia.', [
      q('What is the song about?', ['Loving yourself after a breakup', 'Planting a garden', 'Going back to school']),
      q('Flowers are…', ['Plants with colorful petals', 'Small animals', 'Cold drinks']),
      q('In the song, who buys flowers for the singer?', ['She buys them for herself', 'Her mother', 'Her teacher']),
      q('Complete: "She is happy ___ her own."', ['on', 'in', 'at']),
      q('How does she feel at the end of the song?', ['Strong and independent', 'Sad and lonely', 'Angry with her friends']),
    ]),
  song('die-with-a-smile', 'A1', 'Die With A Smile', 'Lady Gaga & Bruno Mars', 'kPa7bsKwL-c', 253,
    'Dueto romântico: amor, futuro e o vocabulário de sentimentos.', [
      q('Who sings this song?', ['Lady Gaga and Bruno Mars', 'Taylor Swift and Ed Sheeran', 'Adele and Drake']),
      q('What is the main topic of the song?', ['Being with the person you love until the end', 'Winning a lot of money', 'Traveling to space']),
      q('A "smile" is…', ['What you do with your mouth when you are happy', 'A type of food', 'A sad feeling']),
      q('If the world ends, the singers want to be…', ['Next to the person they love', 'At work', 'Alone at home']),
      q('This song is a…', ['Romantic duet', 'Rap battle', 'Song for children']),
    ]),
  song('apt', 'A1', 'APT.', 'ROSÉ & Bruno Mars', 'ekr2nIex040', 174,
    'Um hit animado de K-pop e pop. Convites, ritmo e palavras curtas.', [
      q('Who sings this song?', ['ROSÉ and Bruno Mars', 'BTS and Coldplay', 'Billie Eilish and Harry Styles']),
      q('"APT." is a short form of the word…', ['Apartment', 'April', 'Airport']),
      q('The rhythm of the song is…', ['Fast and happy', 'Very slow and sad', 'Silent']),
      q('The singers invite someone to…', ['Come and meet them', 'Study for a test', 'Clean the house']),
      q('ROSÉ is a member of which K-pop group?', ['BLACKPINK', 'BTS', 'One Direction']),
    ]),
  song('birds-of-a-feather', 'A1', 'Birds of a Feather', 'Billie Eilish', 'V9PVRfjEBTI', 231,
    'Uma declaração de amor delicada. Expressão idiomática e vocabulário de tempo.', [
      q('Who sings this song?', ['Billie Eilish', 'Miley Cyrus', 'Dua Lipa']),
      q('The expression "birds of a feather" is about people who…', ['Are similar and stay together', 'Are afraid of birds', 'Work on a farm']),
      q('What does the singer want?', ['To stay with the person she loves forever', 'To fly to another country', 'To buy a bird']),
      q('"Forever" means…', ['For all time', 'For one day', 'Never']),
      q('The feeling of the song is…', ['Romantic and sweet', 'Angry', 'Scary']),
    ]),
  song('as-it-was', 'A1', 'As It Was', 'Harry Styles', 'H5v3kku4y6Q', 166,
    'Ritmo animado com um tema sobre mudanças na vida. Passado e presente.', [
      q('Who sings this song?', ['Harry Styles', 'Ed Sheeran', 'Bruno Mars']),
      q('"As it was" means…', ['The way it was before', 'Very fast', 'In the future']),
      q('The song talks about…', ['Changes in life and feeling lonely', 'A birthday party', 'A cooking class']),
      q('The music is fast, but the topic is…', ['A little sad', 'Very funny', 'About animals']),
      q('Harry Styles was a member of the band…', ['One Direction', 'Coldplay', 'Maroon 5']),
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
  song('azizam', 'A1', 'Azizam', 'Ed Sheeran', 'MI9ZpIKgyf0', 208,
    'Uma música alegre e dançante sobre amor. Palavras carinhosas.', [
      q('"Azizam" is a Persian word that means…', ['My dear, my love', 'Goodbye', 'Thank you']),
      q('The song is about…', ['A happy love and dancing', 'A war', 'School exams']),
      q('The rhythm of the song is…', ['Happy and good for dancing', 'Very slow', 'Silent']),
      q('Ed Sheeran is from…', ['England', 'Brazil', 'Japan']),
      q('Which word is similar to "dear"?', ['Darling', 'Enemy', 'Stranger']),
    ]),
];

const A2 = [
  song('espresso', 'A2', 'Espresso', 'Sabrina Carpenter', 'eVli-tstM5E', 201,
    'Um hit cheio de confiança e humor. Comparações e expressões.', [
      q('Espresso is a type of…', ['Coffee', 'Tea', 'Juice']),
      q('She compares herself to espresso because…', ['She keeps someone awake thinking about her', 'She works in a café', 'She doesn\'t like coffee']),
      q('The singer sounds…', ['Confident and playful', 'Scared', 'Depressed']),
      q('"Can\'t stop thinking about someone" means…', ['To think about them all the time', 'To forget them', 'To hate them']),
      q('Sabrina Carpenter was a star on which Disney show?', ['Girl Meets World', 'Hannah Montana', 'High School Musical']),
    ]),
  song('too-sweet', 'A2', 'Too Sweet', 'Hozier', 'NTpbbQUBbuo', 249,
    'Duas pessoas com estilos de vida opostos. Hábitos e rotina.', [
      q('He says the other person is "too sweet" for him. This means…', ['They are too nice and healthy for his lifestyle', 'They eat too much candy', 'They are too young']),
      q('The singer prefers…', ['Staying up late at night', 'Waking up at 5 a.m. to run', 'Drinking only water']),
      q('A "night owl" is a person who…', ['Likes to stay awake late', 'Is afraid of the dark', 'Works in a zoo']),
      q('The other person\'s lifestyle is…', ['Healthy and organized', 'Chaotic', 'Dangerous']),
      q('Hozier is from…', ['Ireland', 'The USA', 'Australia']),
    ]),
  song('good-luck-babe', 'A2', 'Good Luck, Babe!', 'Chappell Roan', '1RKqOmSkGgM', 219,
    'Sentimentos que não dá para esconder. Expressões e intenções.', [
      q('"Good luck" is something you say to…', ['Wish someone success', 'Say hello', 'Apologize']),
      q('The singer thinks the other person…', ['Is hiding her real feelings', 'Is a great singer', 'Is moving to Paris']),
      q('According to the song, feelings…', ['Can\'t be stopped forever', 'Disappear quickly', 'Are not important']),
      q('The singer\'s voice in the chorus is…', ['Dramatic and powerful', 'A whisper', 'Like a robot']),
      q('Chappell Roan is known for…', ['Colorful, theatrical costumes and makeup', 'Playing football', 'Cooking shows']),
    ]),
  song('houdini', 'A2', 'Houdini', 'Dua Lipa', 'suAR1PYFNYA', 189,
    'Pop dançante sobre "desaparecer". Verbos e condições.', [
      q('Houdini was a famous…', ['Magician and escape artist', 'Football player', 'Painter']),
      q('In the song, she says she will…', ['Disappear if the person doesn\'t show they are worth it', 'Marry the person tomorrow', 'Move to the beach']),
      q('"To prove" means…', ['To show that something is true', 'To hide something', 'To buy something']),
      q('In the song, Dua Lipa is…', ['Confident and in control', 'Scared and confused', 'Bored']),
      q('This is a ___ song.', ['Dance-pop', 'Country', 'Opera']),
    ]),
  song('greedy', 'A2', 'greedy', 'Tate McRae', 'To4SWGZkEPk', 155,
    'Atitude e autoconfiança. Adjetivos de personalidade.', [
      q('"Greedy" means…', ['Wanting more than you need', 'Generous', 'Shy']),
      q('In the song, the singer feels…', ['Very confident about herself', 'Insecure', 'Sick']),
      q('Someone is interested in her, but she…', ['Is not easy to get', 'Asks him to marry her', 'Cries all day']),
      q('Tate McRae is also a talented…', ['Dancer', 'Chef', 'Pilot']),
      q('The music video is full of…', ['Dance choreography', 'Animals', 'Cooking']),
    ]),
  song('blinding-lights', 'A2', 'Blinding Lights', 'The Weeknd', '4NRXx6U8ABQ', 263,
    'Um dos maiores sucessos de todos os tempos. Noite, cidade e saudade.', [
      q('"Blinding lights" are lights that are…', ['So bright you can\'t see well', 'Very weak', 'Small candles']),
      q('The singer is…', ['Missing someone and looking for them', 'Studying for a test', 'Shopping for clothes']),
      q('When does most of the story happen?', ['At night', 'In the morning', 'At lunchtime']),
      q('The style of the song reminds us of music from the…', ['1980s', '1920s', '1950s']),
      q('"I can\'t sleep" means…', ['I am not able to sleep', 'I sleep a lot', 'I like to sleep']),
    ]),
  song('please-please-please', 'A2', 'Please Please Please', 'Sabrina Carpenter', 'cF1Na4AIecM', 263,
    'Um pedido com humor. Pedidos, verbos de emoção e ironia.', [
      q('The singer asks her partner…', ['Not to embarrass her', 'To buy her a car', 'To cook dinner']),
      q('"To embarrass someone" means…', ['To make them feel ashamed in front of others', 'To make them rich', 'To make them hungry']),
      q('Why does she say "please" many times?', ['She is asking very strongly', 'She is angry with her mother', 'It is a mistake']),
      q('The tone of the song is…', ['Funny and a little worried', 'Very scary', 'Sad and slow']),
      q('Which actor appears in the music video?', ['Barry Keoghan', 'Tom Holland', 'Zac Efron']),
    ]),
  song('drivers-license', 'A2', 'drivers license', 'Olivia Rodrigo', 'ZmDBbnmKpqQ', 247,
    'A música que lançou Olivia Rodrigo. Passado, lembranças e sentimentos.', [
      q('The singer just got her…', ['Driver\'s license', 'Diploma', 'Passport']),
      q('She feels…', ['Heartbroken', 'Excited about a trip', 'Angry with her parents']),
      q('While she drives alone, she…', ['Remembers her ex', 'Listens to the news', 'Talks to her friends']),
      q('"Heartbroken" means…', ['Very sad after a relationship ends', 'Very healthy', 'Very busy']),
      q('This song became a huge hit in…', ['2021', '2011', '2001']),
    ]),
  song('lose-control', 'A2', 'Lose Control', 'Teddy Swims', '9gWIIIr2Asw', 210,
    'Apresentação ao vivo de um grande sucesso. Emoções fortes e voz potente.', [
      q('"To lose control" means…', ['Not to be able to control yourself', 'To win a game', 'To fall asleep']),
      q('Without his partner, the singer…', ['Feels he loses control', 'Feels calm', 'Sleeps better']),
      q('The song mixes pop with…', ['Soul', 'Heavy metal', 'Reggaeton']),
      q('The singer\'s voice is…', ['Strong and raspy', 'Like a child\'s', 'Like a robot']),
      q('This video is…', ['A live performance', 'A cartoon', 'A video game']),
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
  song('abracadabra', 'B2', 'Abracadabra', 'Lady Gaga', 'vBynw9Isr28', 270,
    'Pop eletrônico e teatral. Vocabulário de magia e expressões figuradas.', [
      q('"Abracadabra" is a word traditionally said by…', ['Magicians performing a trick', 'Doctors during surgery', 'Pilots before take-off']),
      q('The music video focuses mainly on…', ['Intense choreography and dramatic costumes', 'A cooking competition', 'A road trip']),
      q('Which genre best describes the song?', ['Dance-pop with electronic beats', 'Acoustic folk', 'Smooth jazz']),
      q('If you are "under a spell", you are…', ['Controlled by magic or strongly attracted to something', 'Spelling a word', 'Sleeping deeply']),
      q('This song is from Lady Gaga\'s album…', ['Mayhem', 'Chromatica', 'Joanne']),
    ]),
  song('pink-pony-club', 'B2', 'Pink Pony Club', 'Chappell Roan', 'GR3Liudev18', 281,
    'Sair da cidade natal para viver um sonho. Narrativa, família e liberdade.', [
      q('The narrator leaves her hometown to…', ['Follow her dream of performing in Los Angeles', 'Study medicine', 'Join the army']),
      q('Where is her hometown?', ['Tennessee', 'Texas', 'New York']),
      q('How does her mother react to her choice?', ['She disapproves of it', 'She is very proud', 'She moves with her']),
      q('At its core, the song is about…', ['Freedom and being true to yourself', 'Saving money', 'Learning to drive']),
      q('A "small-town girl" is someone who…', ['Grew up in a small place', 'Is very short', 'Works in a toy shop']),
    ]),
  song('what-was-i-made-for', 'B2', 'What Was I Made For?', 'Billie Eilish', 'cW8VLC9nnTo', 249,
    'Identidade e propósito. Vocabulário abstrato e interpretação.', [
      q('The song was written for the movie…', ['Barbie (2023)', 'Wicked', 'Frozen II']),
      q('The narrator is questioning…', ['Her identity and purpose', 'The price of a dress', 'Her travel plans']),
      q('"Purpose" means…', ['The reason why something exists or is done', 'A kind of fish', 'A loud noise']),
      q('The mood of the song is…', ['Reflective and melancholic', 'Aggressive', 'Silly']),
      q('Which award did this song win?', ['The Oscar for Best Original Song', 'The FIFA World Cup', 'The Nobel Prize']),
    ]),
  song('fortnight', 'B2', 'Fortnight', 'Taylor Swift ft. Post Malone', 'q3zqJs7JUCQ', 250,
    'Uma relação curta e complicada. Vocabulário britânico e narrativa.', [
      q('"A fortnight" means…', ['Two weeks', 'Four nights', 'One year']),
      q('Taylor Swift sings this song with…', ['Post Malone', 'Ed Sheeran', 'Drake']),
      q('The story is about…', ['A short, complicated relationship that left scars', 'A family holiday', 'A sports competition']),
      q('The music video is mostly in…', ['Black and white', 'Neon colors', 'Cartoon animation']),
      q('This song is from the album…', ['The Tortured Poets Department', 'Folklore', '1989']),
    ]),
  song('vampire', 'B2', 'vampire', 'Olivia Rodrigo', 'RlPNh_PBZb4', 245,
    'Uma metáfora forte sobre ser usada por alguém. Linguagem figurada.', [
      q('Why does she call the person a "vampire"?', ['He used her and took advantage of her', 'He only goes out at night', 'He loves horror films']),
      q('"To take advantage of someone" means…', ['To use them unfairly for your own benefit', 'To help them', 'To forget them']),
      q('The song starts like a ballad and then…', ['Builds into a powerful climax', 'Turns into a rap', 'Stops suddenly']),
      q('This song is from the album…', ['GUTS', 'SOUR', 'Lover']),
      q('Used figuratively, a "bloodsucker" is a person who…', ['Exploits others', 'Donates blood', 'Works in a hospital']),
    ]),
  song('manchild', 'B2', 'Manchild', 'Sabrina Carpenter', 'aSugSGCC12I', 237,
    'Ironia e humor sobre um homem imaturo. Adjetivos e tom.', [
      q('A "manchild" is…', ['An adult man who behaves like a child', 'A very tall boy', 'A babysitter']),
      q('The tone of the song is…', ['Ironic and humorous', 'Tragic', 'Romantic and serious']),
      q('She complains that the man…', ['Can\'t take care of himself', 'Works too much', 'Is too organized']),
      q('"Immature" means…', ['Not behaving like an adult', 'Very old', 'Very intelligent']),
      q('The song mixes pop with…', ['Country influences', 'Heavy metal', 'Techno']),
    ]),
  song('back-to-friends', 'B2', 'back to friends', 'sombr', 'c8zq4kAn_O0', 202,
    'Quando não dá para voltar a ser só amigos. Phrasal verbs e emoções.', [
      q('Why can\'t they go back to being friends?', ['Because they had a romantic relationship', 'Because they live far away', 'Because they had a fight about money']),
      q('"To go back to" means…', ['To return to a previous situation', 'To walk backwards', 'To go to the back of a room']),
      q('The mood of the song is…', ['Nostalgic and painful', 'Cheerful and silly', 'Calm and relaxing']),
      q('This song became popular mainly on…', ['TikTok', 'The radio in the 1990s', 'TV news']),
      q('Which phrasal verb means "end a relationship"?', ['Break up', 'Make up', 'Wake up']),
    ]),
  song('the-emptiness-machine', 'B2', 'The Emptiness Machine', 'Linkin Park', 'SRXH9AbT280', 201,
    'O retorno do Linkin Park. Metáforas sobre manipulação e pertencimento.', [
      q('The "emptiness machine" is a metaphor for…', ['Something that takes everything from you and leaves you empty', 'A broken washing machine', 'A video game']),
      q('This was the band\'s first single with the vocalist…', ['Emily Armstrong', 'Hayley Williams', 'Amy Lee']),
      q('The narrator feels…', ['Manipulated after giving up himself to belong', 'Proud of a victory', 'Excited about a holiday']),
      q('"To belong" means…', ['To be accepted as part of a group', 'To be very long', 'To borrow something']),
      q('The genre of the song is…', ['Alternative rock', 'Bossa nova', 'Country']),
    ]),
  song('anti-hero', 'B2', 'Anti-Hero', 'Taylor Swift', 'b1kbLwvqugk', 310,
    'Autocrítica com humor. Vocabulário de personalidade e insegurança.', [
      q('An "anti-hero" is…', ['A main character who lacks typical heroic qualities', 'A villain from a comic', 'A superhero\'s assistant']),
      q('In the song, the singer…', ['Criticizes herself and admits her flaws', 'Celebrates a victory', 'Describes a vacation']),
      q('The music video shows…', ['Different versions of Taylor interacting with each other', 'A football match', 'A cooking show']),
      q('"Insecurity" means…', ['A lack of confidence', 'A security guard', 'A strong feeling of joy']),
      q('This song is from the album…', ['Midnights', 'Red', 'Reputation']),
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
