'use strict';

/**
 * Aviso por e-mail para a escola quando alguém se cadastra (o cadastro fica aguardando aprovação).
 *
 * O e-mail é só um AVISO: a aprovação é feita no Controle Professor(a), com login. O e-mail não
 * tem link de "aprovar", porque leitores de e-mail e antivírus abrem links sozinhos.
 *
 * Envio pelo Brevo (plano gratuito). Sem as variáveis abaixo, não envia nada e o cadastro
 * continua funcionando normalmente:
 *   BREVO_API_KEY  — chave da API do Brevo (SMTP & API → API Keys). Segredo: só na Vercel.
 *   NOTIFY_EMAIL   — quem recebe o aviso (ex.: o e-mail da escola).
 *   NOTIFY_FROM    — remetente verificado no Brevo (Senders). Pode ser o mesmo e-mail da escola.
 *   PUBLIC_URL     — endereço da plataforma, para o link do Controle Professor(a).
 */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const env = (n) => (process.env[n] || '').trim();

function emailConfigured() {
  return Boolean(env('BREVO_API_KEY') && env('NOTIFY_EMAIL') && env('NOTIFY_FROM'));
}

async function notifyNewSignup({ name, email, level }) {
  if (!emailConfigured()) return { sent: false, reason: 'não configurado' };
  const site = (env('PUBLIC_URL') || 'https://plataformanovera.vercel.app').replace(/\/+$/, '');
  const levelText = level === 'TEST' ? 'Não sabe (vai fazer o nivelamento)' : level;
  const when = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#222">
      <h2 style="margin:0 0 12px">Novo cadastro aguardando aprovação</h2>
      <p><b>Nome:</b> ${esc(name)}<br><b>E-mail:</b> ${esc(email)}<br><b>Nível:</b> ${esc(levelText)}<br><b>Data:</b> ${esc(when)}</p>
      <p>A pessoa só consegue entrar na plataforma depois que você aprovar.</p>
      <p>Para aprovar ou recusar, entre no <b>Controle Professor(a)</b> com o seu login:<br>
        <a href="${esc(site)}/professor">${esc(site)}/professor</a></p>
      <p style="color:#777;font-size:13px">Se você não reconhece este cadastro, é só recusar. Este e-mail é automático.</p>
    </div>`;
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env('BREVO_API_KEY'), 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: env('NOTIFY_FROM'), name: 'Plataforma Novera' },
      to: [{ email: env('NOTIFY_EMAIL') }],
      subject: `Novo cadastro para aprovar: ${String(name).slice(0, 60)}`,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Brevo respondeu ${res.status}`);
  return { sent: true };
}

module.exports = { notifyNewSignup, emailConfigured };
