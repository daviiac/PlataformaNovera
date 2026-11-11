/* Criar senha nova depois de entrar com a senha provisória gerada pela professora. */
(async () => {
  const { api, requireUser, homeFor, esc, logout } = Novera;
  const user = await requireUser();
  if (!user.mustChangePassword) return window.location.replace(homeFor(user));

  const $ = (id) => document.getElementById(id);
  const pw = $('new-password');
  const confirm = $('new-confirm');
  $('newpw-intro').textContent = user.role === 'student'
    ? `Olá, ${user.name.split(' ')[0]}! Você entrou com a senha provisória que sua professora gerou. Para continuar, crie uma senha só sua — ninguém mais vai saber qual é.`
    : `Olá, ${user.name.split(' ')[0]}! Por segurança, contas de professor(a) e administrador precisam de uma senha forte. Crie uma senha nova para continuar.`;

  function evaluate() {
    const result = PasswordPolicy.check(pw.value, { name: user.name, email: user.email || user.username });
    const pct = Math.round((result.passed / result.total) * 100);
    $('pw-bar').style.width = `${pw.value ? pct : 0}%`;
    $('pw-bar').className = pw.value ? `pw-${result.strength.replace('é', 'e')}` : '';
    $('pw-label').textContent = !pw.value ? 'Crie uma senha forte'
      : result.ok ? 'Senha forte ✓' : `Senha ${result.strength} — melhore os itens abaixo`;
    $('pw-checks').innerHTML = result.checks.map((c) => `<li class="${c.ok ? 'ok' : ''}">${c.ok ? '✓' : '•'} ${esc(c.label)}</li>`).join('');
    $('pw-checks').hidden = !pw.value;
    const match = confirm.value && confirm.value === pw.value;
    $('pw-match').textContent = confirm.value ? (match ? '✓ As senhas conferem' : 'As senhas ainda não conferem') : '';
    $('pw-match').className = `hint ${confirm.value ? (match ? 'hint-ok' : 'hint-bad') : ''}`;
    const ok = result.ok && match;
    $('newpw-submit').disabled = !ok;
    return ok;
  }
  pw.addEventListener('input', evaluate);
  confirm.addEventListener('input', evaluate);
  evaluate();
  pw.focus();

  $('newpw-logout').addEventListener('click', logout);
  $('newpw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!evaluate()) return;
    $('newpw-error').textContent = '';
    $('newpw-submit').disabled = true;
    try {
      const { user: updated } = await api('/api/auth/change-password', { method: 'POST', body: { password: pw.value } });
      Novera.toast('Senha nova salva! ✓');
      window.location.replace(homeFor(updated));
    } catch (err) {
      $('newpw-error').textContent = err.message;
      $('newpw-submit').disabled = false;
    }
  });
})();
