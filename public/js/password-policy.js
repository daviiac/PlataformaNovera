/*
 * Regras de senha forte da Novera — o MESMO arquivo roda no navegador (dicas ao vivo)
 * e no servidor (validação que não dá para burlar).
 */
(function (root) {
  const COMMON = [
    'password', 'senha', 'qwerty', 'abc123', '123456', '1234567', '12345678', '123456789', '1234567890',
    'iloveyou', 'admin', 'welcome', 'letmein', 'monkey', 'dragon', 'football', 'futebol', 'brasil', 'brazil',
    'novera', 'english', 'ingles', 'teste', 'test', 'mudar', 'changeme', 'passw0rd', 'master', 'flamengo',
    'corinthians', 'palmeiras', 'qazwsx', 'asdfgh', 'zxcvbn', '111111', '000000', 'aaaaaa',
  ];

  const MIN_LENGTH = 10;

  function sequences(s) {
    const lower = s.toLowerCase();
    const runs = ['abcdefghijklmnopqrstuvwxyz', '0123456789', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
    for (const run of runs) {
      for (let i = 0; i + 4 <= run.length; i += 1) {
        const piece = run.slice(i, i + 4);
        if (lower.includes(piece) || lower.includes([...piece].reverse().join(''))) return true;
      }
    }
    return false;
  }

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
      { id: 'length', label: `Pelo menos ${MIN_LENGTH} caracteres`, ok: pw.length >= MIN_LENGTH && pw.length <= 128 },
      { id: 'lower', label: 'Uma letra minúscula', ok: /[a-z]/.test(pw) },
      { id: 'upper', label: 'Uma letra maiúscula', ok: /[A-Z]/.test(pw) },
      { id: 'number', label: 'Um número', ok: /[0-9]/.test(pw) },
      { id: 'symbol', label: 'Um símbolo (ex.: ! @ # $ %)', ok: /[^A-Za-z0-9\s]/.test(pw) },
      { id: 'personal', label: 'Sem seu nome ou e-mail', ok: !personal.some((p) => lower.includes(p)) },
      { id: 'common', label: 'Nada óbvio (123456, senha, qwerty, sequências…)', ok: pw.length > 0 && !COMMON.some((c) => lower.includes(c)) && !sequences(pw) && !/(.)\1\1/.test(pw) },
    ];
    const passed = checks.filter((c) => c.ok).length;
    const ok = passed === checks.length;
    let strength = 'fraca';
    if (ok) strength = 'forte';
    else if (passed >= 5) strength = 'média';
    return { ok, strength, checks, passed, total: checks.length };
  }

  const api = { check, MIN_LENGTH };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PasswordPolicy = api;
}(typeof window !== 'undefined' ? window : globalThis));
