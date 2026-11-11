(async () => {
  const { api, currentUser, homeFor } = Novera;

  // Já logado? Vai direto para a área certa.
  const existing = await currentUser();
  if (existing) return window.location.replace(homeFor(existing));

  const tabs = document.querySelectorAll('.tabs button');
  const forms = { login: document.getElementById('login-form'), register: document.getElementById('register-form') };
  const errorEl = document.getElementById('auth-error');

  function showTab(name) {
    tabs.forEach((t) => {
      const active = t.dataset.tab === name;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', String(active));
    });
    Object.entries(forms).forEach(([key, form]) => { form.hidden = key !== name; });
    errorEl.textContent = '';
    forms[name].querySelector('input').focus();
  }
  tabs.forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));
  document.getElementById('forgot-btn').addEventListener('click', (e) => {
    const help = document.getElementById('forgot-help');
    help.hidden = !help.hidden;
    e.currentTarget.setAttribute('aria-expanded', String(!help.hidden));
  });
  if (window.location.hash === '#cadastro') showTab('register');

  async function submit(form, fn) {
    errorEl.textContent = '';
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    try {
      const { user } = await fn(Object.fromEntries(new FormData(form)));
      window.location.replace(homeFor(user));
    } catch (err) {
      let hint = '';
      const typed = String(form.querySelector('[name=identifier]')?.value || '');
      if (form === forms.login && (err.status === 401 || err.status === 429) && !typed.includes('@')) {
        hint = ' Alunos entram com o e-mail cadastrado (ex.: nome@gmail.com), não com o nome.';
      } else if (form === forms.login && err.status === 401) {
        hint = ' Se você acabou de criar uma senha nova, apague a senha que o navegador preencheu sozinho e digite a nova.';
      } else if (form === forms.login && err.status === 429) {
        hint = ' Se esqueceu a senha, peça para sua professora redefinir: isso libera o acesso na hora.';
      }
      errorEl.textContent = err.message + hint;
      button.disabled = false;
    }
  }

  // Login sempre em letras minúsculas (e-mail e usuário não diferenciam maiúsculas).
  const loginId = document.getElementById('login-identifier');
  loginId.addEventListener('input', () => {
    const lower = loginId.value.toLowerCase();
    if (lower !== loginId.value) {
      const pos = loginId.selectionStart;
      loginId.value = lower;
      loginId.setSelectionRange(pos, pos);
    }
  });

  forms.login.addEventListener('submit', (e) => {
    e.preventDefault();
    submit(forms.login, ({ identifier, password }) => {
      if (!identifier || !password) throw new Error('Preencha usuário/e-mail e senha.');
      return api('/api/auth/login', { method: 'POST', body: { identifier, password } });
    });
  });

  // ---------- Cadastro: todos os campos obrigatórios + senha forte com dicas ao vivo ----------
  const $ = (id) => document.getElementById(id);
  const reg = {
    name: $('reg-name'), email: $('reg-email'), level: $('reg-level'), password: $('reg-password'), confirm: $('reg-confirm'),
  };
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function evaluate() {
    const name = reg.name.value.trim();
    const email = reg.email.value.trim();
    const pw = reg.password.value;
    const result = PasswordPolicy.check(pw, { name, email });

    // Medidor e checklist
    const pct = Math.round((result.passed / result.total) * 100);
    const bar = $('pw-bar');
    bar.style.width = `${pw ? pct : 0}%`;
    bar.className = pw ? `pw-${result.strength.replace('é', 'e')}` : '';
    $('pw-label').textContent = !pw
      ? 'Crie uma senha forte'
      : result.ok ? 'Senha forte ✓' : `Senha ${result.strength} — melhore os itens abaixo`;
    $('pw-checks').innerHTML = result.checks.map((c) => `<li class="${c.ok ? 'ok' : ''}">${c.ok ? '✓' : '•'} ${Novera.esc(c.label)}</li>`).join('');
    $('pw-checks').hidden = !pw;

    const match = reg.confirm.value && reg.confirm.value === pw;
    $('pw-match').textContent = reg.confirm.value ? (match ? '✓ As senhas conferem' : 'As senhas ainda não conferem') : '';
    $('pw-match').className = `hint ${reg.confirm.value ? (match ? 'hint-ok' : 'hint-bad') : ''}`;

    const missing = [];
    if (name.length < 2) missing.push('nome');
    if (!EMAIL_RE.test(email)) missing.push('e-mail válido');
    if (!reg.level.value) missing.push('nível');
    if (!result.ok) missing.push('senha forte');
    if (!match) missing.push('confirmação da senha');
    $('reg-submit').disabled = missing.length > 0;
    $('reg-hint').textContent = missing.length ? `Falta: ${missing.join(', ')}.` : 'Tudo certo! Pode criar sua conta.';
    return { ok: missing.length === 0, missing };
  }
  Object.values(reg).forEach((el) => {
    el.addEventListener('input', evaluate);
    el.addEventListener('change', evaluate);
  });
  evaluate();

  forms.register.addEventListener('submit', (e) => {
    e.preventDefault();
    submit(forms.register, ({ name, email, password, level }) => {
      const state = evaluate();
      if (!state.ok) throw new Error(`Falta: ${state.missing.join(', ')}.`);
      return api('/api/auth/register', { method: 'POST', body: { name, email, password, level } });
    });
  });
})();
