'use strict';

/**
 * Aviso por e-mail para a escola quando alguém se cadastra (o cadastro fica aguardando aprovação).
 *
 * O e-mail é só um AVISO: a aprovação é feita no Controle Professor(a), com login. O e-mail não
 * tem link de "aprovar", porque leitores de e-mail e antivírus abrem links sozinhos.
 *
 * Um único envio: a cada cadastro, um e-mail sai do Gmail da escola para o próprio Gmail da
 * escola (autenticado pelo Google, então chega na caixa de entrada e não no spam).
 * Configurado só nas variáveis de ambiente da Vercel, nunca no código:
 *   GMAIL_USER          — o Gmail da escola (envia e recebe o aviso).
 *   GMAIL_APP_PASSWORD  — "senha de app" de 16 letras criada nessa conta (não é a senha normal).
 *   PUBLIC_URL          — endereço da plataforma, para o link do Controle Professor(a) (opcional).
 *
 * Sem configuração, não envia nada e o cadastro continua funcionando (aparece no Controle Professor).
 */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const env = (n) => (process.env[n] || '').trim();
const site = () => (env('PUBLIC_URL') || 'https://plataformanovera.vercel.app').replace(/\/+$/, '');

const provider = () => (env('GMAIL_USER') && env('GMAIL_APP_PASSWORD') ? 'gmail' : null);
// O aviso vai para o próprio Gmail da escola.
const recipient = () => env('GMAIL_USER');
const emailConfigured = () => Boolean(provider());

/** "no*****@gmail.com": mostra para a professora para onde vai, sem expor o endereço inteiro. */
function maskEmail(e) {
  const [user, domain] = String(e || '').split('@');
  if (!user || !domain) return '';
  return `${user.slice(0, 2)}${'*'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}

function emailStatus() {
  const p = provider();
  return { configured: Boolean(p), provider: p, to: p ? maskEmail(recipient()) : null };
}

let transport = null;
function gmailTransport() {
  if (!transport) {
    const nodemailer = require('nodemailer');
    transport = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: env('GMAIL_USER'), pass: env('GMAIL_APP_PASSWORD').replace(/\s+/g, '') },
      connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 10000,
    });
  }
  return transport;
}

/** Envia um e-mail para a escola. Lança erro com mensagem clara se falhar. */
async function sendToSchool({ subject, text, html }) {
  if (!provider()) return { sent: false, reason: 'não configurado' };
  try {
    await gmailTransport().sendMail({
      from: { name: 'Plataforma Novera', address: env('GMAIL_USER') },
      to: recipient(), subject, text, html,
    });
  } catch (err) {
    transport = null;
    if (err.code === 'EAUTH' || /Invalid login|Username and Password/i.test(err.message)) {
      throw new Error('O Gmail recusou o login: confira o GMAIL_USER e a senha de app (GMAIL_APP_PASSWORD) na Vercel.');
    }
    throw new Error(`Falha ao enviar pelo Gmail: ${err.message}`);
  }
  return { sent: true, provider: 'gmail' };
}

const wrap = (inner) => `<div style="font-family:Arial,sans-serif;font-size:15px;color:#222">${inner}</div>`;

async function notifyNewSignup({ name, email, username, level }) {
  const levelText = level === 'TEST' ? 'Não sabe (vai fazer o nivelamento)' : level;
  const when = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const url = `${site()}/professor`;
  const text = [
    'Novo cadastro aguardando aprovação na Plataforma Novera.', '',
    `Nome: ${name}`, `Login: ${username || ''}`, `E-mail: ${email}`, `Nível: ${levelText}`, `Data: ${when}`, '',
    'A pessoa só consegue entrar depois que você aprovar.',
    `Para aprovar ou recusar, entre no Controle Professor(a): ${url}`, '',
    'Se você não reconhece este cadastro, é só recusar. Este e-mail é automático.',
  ].join('\n');
  const html = wrap(`
      <h2 style="margin:0 0 12px">Novo cadastro aguardando aprovação</h2>
      <p><b>Nome:</b> ${esc(name)}<br><b>Login:</b> ${esc(username || '')}<br><b>E-mail:</b> ${esc(email)}<br><b>Nível:</b> ${esc(levelText)}<br><b>Data:</b> ${esc(when)}</p>
      <p>A pessoa só consegue entrar na plataforma depois que você aprovar.</p>
      <p>Para aprovar ou recusar, entre no <b>Controle Professor(a)</b> com o seu login:<br>
        <a href="${esc(url)}">${esc(url)}</a></p>
      <p style="color:#777;font-size:13px">Se você não reconhece este cadastro, é só recusar. Este e-mail é automático.</p>`);
  return sendToSchool({ subject: `Plataforma Novera: novo cadastro de ${String(name).slice(0, 60)}`, text, html });
}

/** E-mail de teste (botão no Controle Professor), para conferir se o aviso está chegando. */
function sendTestEmail(byName) {
  const when = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const text = `Teste do aviso por e-mail da Plataforma Novera, enviado por ${byName} em ${when}.\n\nSe este e-mail chegou, os avisos de novos cadastros também vão chegar.`;
  const html = wrap(`<h2 style="margin:0 0 12px">Teste do aviso por e-mail</h2>
    <p>Enviado por <b>${esc(byName)}</b> em ${esc(when)}.</p>
    <p>Se este e-mail chegou, os avisos de novos cadastros também vão chegar.</p>`);
  return sendToSchool({ subject: 'Plataforma Novera: teste do aviso por e-mail', text, html });
}

module.exports = { notifyNewSignup, sendTestEmail, emailConfigured, emailStatus, maskEmail };
