(async () => {
  const { api, requireUser, renderTopbar, esc } = Novera;
  const user = await requireUser();
  renderTopbar(user, 'nivelamento');

  const $ = (id) => document.getElementById(id);
  const sections = { intro: $('intro'), quiz: $('quiz'), result: $('result') };
  const show = (name) => Object.entries(sections).forEach(([k, el]) => { el.hidden = k !== name; });

  const LEVEL_DESC = {
    A1: 'Iniciante: você vai construir a base da língua — apresentações, verbo to be, rotina e vocabulário essencial.',
    A2: 'Básico: você já se vira no essencial. Agora é hora de dominar passado, futuro, comparações e situações práticas.',
    B2: 'Intermediário superior: você se comunica bem. Vamos refinar estruturas complexas, phrasal verbs e argumentação.',
  };

  const { questions, currentLevel, lastResult } = await api('/api/placement/questions');
  const answers = {};
  let index = 0;

  $('q-count').textContent = questions.length;
  if (currentLevel) {
    $('intro-title').textContent = 'Refazer o nivelamento';
    $('last-result').textContent = `Seu nível atual é ${currentLevel}. Ao refazer o teste, sua trilha será atualizada com o novo resultado.`;
  } else if (lastResult) {
    $('last-result').textContent = `Último resultado: ${lastResult.level} (${lastResult.score}/${lastResult.max_score} pontos).`;
  }
  show('intro');

  function renderQuestion() {
    const q = questions[index];
    $('q-position').textContent = `Questão ${index + 1} de ${questions.length}`;
    $('q-skill').textContent = q.skill;
    $('q-progress').style.width = `${(index / questions.length) * 100}%`;
    $('q-prompt').textContent = q.prompt;
    $('quiz-error').textContent = '';

    $('q-options').innerHTML = q.options.map((opt, i) => `
      <button type="button" role="radio" class="option ${answers[q.id] === i ? 'selected' : ''}"
              aria-checked="${answers[q.id] === i}" data-index="${i}">
        <span class="letter">${'ABCD'[i]}</span><span>${esc(opt)}</span>
      </button>`).join('');

    $('prev-btn').disabled = index === 0;
    $('next-btn').disabled = answers[q.id] === undefined;
    $('next-btn').textContent = index === questions.length - 1 ? 'Ver resultado' : 'Próxima';
  }

  $('q-options').addEventListener('click', (e) => {
    const btn = e.target.closest('.option');
    if (!btn) return;
    answers[questions[index].id] = Number(btn.dataset.index);
    renderQuestion();
  });

  $('start-btn').addEventListener('click', () => {
    index = 0;
    Object.keys(answers).forEach((k) => delete answers[k]);
    show('quiz');
    renderQuestion();
  });

  $('prev-btn').addEventListener('click', () => {
    if (index > 0) { index -= 1; renderQuestion(); }
  });

  $('next-btn').addEventListener('click', async () => {
    if (index < questions.length - 1) {
      index += 1;
      return renderQuestion();
    }
    $('next-btn').disabled = true;
    $('q-progress').style.width = '100%';
    try {
      const { result, levelApplied, currentLevel } = await api('/api/placement/submit', { method: 'POST', body: { answers } });
      renderResult(result, levelApplied, currentLevel);
    } catch (err) {
      $('quiz-error').textContent = err.message;
      $('next-btn').disabled = false;
    }
  });

  function renderResult(result, levelApplied, currentLevel) {
    $('r-level').innerHTML = `<span class="level-badge level-${result.level}">${result.level}</span>`;
    const keep = user.role === 'student' && !levelApplied && currentLevel;
    $('r-desc').textContent = keep
      ? `Seu resultado foi registrado e enviado para a sua professora. Você continua no nível ${currentLevel} — a mudança de nível é feita por ela.`
      : LEVEL_DESC[result.level];
    $('r-score').textContent = `Você acertou ${result.correct} de ${result.total} questões (${result.score}/${result.maxScore} pontos ponderados).`;
    $('r-bands').innerHTML = Object.entries(result.byBand).map(([band, b]) => `
      <div class="band"><span class="small muted">Questões ${band}</span><strong>${b.correct}/${b.total}</strong></div>`).join('');
    const staff = user.role !== 'student';
    $('go-track').href = staff ? Novera.homeFor(user) : `/trilha?nivel=${keep ? currentLevel : result.level}`;
    $('go-track').textContent = staff ? 'Voltar' : 'Ir para minha trilha';
    show('result');
    // Atualiza o selo de nível no topo (só quando o nivelamento definiu o nível).
    if (user.role === 'student' && levelApplied) renderTopbar({ ...user, level: result.level }, 'nivelamento');
  }

  $('retry-btn').addEventListener('click', () => show('intro'));
})();
