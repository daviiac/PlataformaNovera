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

  // Cadastro recebido: fica aguardando a aprovação da escola (não entra ainda).
  function showPending(form, message, login) {
    const done = document.createElement('div');
    done.className = 'signup-pending';
    done.setAttribute('role', 'status');
    done.innerHTML = '<h2>✅ Cadastro recebido!</h2><p></p><p class="signup-login">Seu login: <strong></strong></p><button type="button" class="btn btn-ghost btn-block">Voltar para o login</button>';
    done.querySelector('p').textContent = message;
    done.querySelector('.signup-login strong').textContent = login || '';
    done.querySelector('.signup-login').hidden = !login;
    done.querySelector('button').addEventListener('click', () => {
      done.remove();
      form.reset();
      showTab('login');
    });
    form.hidden = true;
    form.after(done);
    done.querySelector('button').focus();
  }

  async function submit(form, fn) {
    errorEl.textContent = '';
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    try {
      const data = Object.fromEntries(new FormData(form));
      const r = await fn(data);
      if (r.pending) return showPending(form, r.message, r.username);
      window.location.replace(homeFor(r.user));
    } catch (err) {
      let hint = '';
      const typed = String(form.querySelector('[name=identifier]')?.value || '');
      if (form === forms.login && err.status === 401 && typed.includes('@')) {
        hint = ' Entre com o seu login (o que você criou no cadastro), não com o e-mail.';
      } else if (form === forms.login && err.status === 401) {
        hint = ' Se você acabou de criar uma senha nova, apague a senha que o navegador preencheu sozinho e digite a nova.';
      } else if (form === forms.login && err.status === 429) {
        hint = ' Se esqueceu a senha, peça para sua professora redefinir: isso libera o acesso na hora.';
      }
      errorEl.textContent = err.message + hint;
      button.disabled = false;
    }
  }

  // Login sempre em letras minúsculas (não diferencia maiúsculas).
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
      if (!identifier || !password) throw new Error('Preencha login e senha.');
      return api('/api/auth/login', { method: 'POST', body: { identifier, password } });
    });
  });

  // ---------- Cadastro: todos os campos obrigatórios + senha forte com dicas ao vivo ----------
  const $ = (id) => document.getElementById(id);
  const reg = {
    name: $('reg-name'), username: $('reg-username'), email: $('reg-email'), level: $('reg-level'), password: $('reg-password'), confirm: $('reg-confirm'), terms: $('reg-terms'), guardian: $('reg-guardian'),
  };
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const USER_RE = /^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$/;
  // Login do cadastro sempre em minúsculas e sem espaço.
  reg.username.addEventListener('input', () => {
    const clean = reg.username.value.toLowerCase().replace(/\s+/g, '');
    if (clean !== reg.username.value) reg.username.value = clean;
  });

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
    if (!USER_RE.test(reg.username.value)) missing.push('login (3 a 30 letras minúsculas, números, . _ -)');
    if (!EMAIL_RE.test(email)) missing.push('e-mail válido');
    if (!reg.level.value) missing.push('nível');
    if (!result.ok) missing.push('senha forte');
    if (!match) missing.push('confirmação da senha');
    if (!reg.terms.checked) missing.push('aceitar os termos');
    if (!reg.guardian.checked) missing.push('confirmar a idade ou a autorização do responsável');
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
    submit(forms.register, ({ name, username, email, password, level }) => {
      const state = evaluate();
      if (!state.ok) throw new Error(`Falta: ${state.missing.join(', ')}.`);
      return api('/api/auth/register', { method: 'POST', body: { name, username, email, password, level, acceptTerms: reg.terms.checked, guardianConsent: reg.guardian.checked } });
    });
  });
})();
