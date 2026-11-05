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
  if (window.location.hash === '#cadastro') showTab('register');

  async function submit(form, fn) {
    errorEl.textContent = '';
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    try {
      const { user } = await fn(Object.fromEntries(new FormData(form)));
      window.location.replace(homeFor(user));
    } catch (err) {
      errorEl.textContent = err.message;
      button.disabled = false;
    }
  }

  forms.login.addEventListener('submit', (e) => {
    e.preventDefault();
    submit(forms.login, ({ identifier, password }) => {
      if (!identifier || !password) throw new Error('Preencha usuário/e-mail e senha.');
      return api('/api/auth/login', { method: 'POST', body: { identifier, password } });
    });
  });

  forms.register.addEventListener('submit', (e) => {
    e.preventDefault();
    submit(forms.register, ({ name, email, password, confirm }) => {
      if (!name || !email || !password) throw new Error('Preencha todos os campos.');
      if (password.length < 8) throw new Error('A senha deve ter pelo menos 8 caracteres.');
      if (password !== confirm) throw new Error('As senhas não conferem.');
      return api('/api/auth/register', { method: 'POST', body: { name, email, password } });
    });
  });
})();
