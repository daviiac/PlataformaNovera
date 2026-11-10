/*
 * Regras de senha forte da Novera — o MESMO arquivo roda no navegador (dicas ao vivo)
 * e no servidor (validação que não dá para burlar).
 */
(function (root) {
  const MAX_LENGTH = 128;

  /**
   * @param {string} password
   * @param {{ name?: string, email?: string }} ctx dados pessoais que não podem aparecer na senha
   */
  function check(password, ctx = {}) {
    const pw = String(password || '');
    const lower = pw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const personal = [
      ...String(ctx.name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/),
      ...String(ctx.email || '').toLowerCase().split('@')[0].split(/[^a-z0-9]+/),
    ].filter((p) => p.length >= 3);

    const checks = [
      { id: 'lower', label: 'Uma letra minúscula', ok: /[a-z]/.test(pw) },
      { id: 'upper', label: 'Uma letra maiúscula', ok: /[A-Z]/.test(pw) },
      { id: 'number', label: 'Um número', ok: /[0-9]/.test(pw) },
      { id: 'symbol', label: 'Um símbolo (ex.: ! @ # $ %)', ok: /[^A-Za-z0-9\s]/.test(pw) },
      { id: 'personal', label: 'Sem seu nome ou e-mail', ok: pw.length > 0 && !personal.some((p) => lower.includes(p)) },
    ];
    const passed = checks.filter((c) => c.ok).length;
    const ok = passed === checks.length && pw.length <= MAX_LENGTH;
    let strength = 'fraca';
    if (ok) strength = 'forte';
    else if (passed >= 4) strength = 'média';
    return { ok, strength, checks, passed, total: checks.length };
  }

  const api = { check, MAX_LENGTH };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PasswordPolicy = api;
}(typeof window !== 'undefined' ? window : globalThis));
