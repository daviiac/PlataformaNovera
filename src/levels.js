'use strict';

/**
 * Controle de níveis.
 *  - Equipe (admin e professor): acessa todos os níveis.
 *  - Aluno: acessa o nível atual e os anteriores (A1 < A2 < B2), inclusive níveis em
 *    que já esteve. Os PRÓXIMOS níveis só abrem quando a professora muda o nível
 *    do aluno no Controle Professor(a).
 */
const db = require('./db');

const ORDER = ['A1', 'A2', 'B2'];
const rank = (l) => ORDER.indexOf(l);

async function levelHistory(userId) {
  return db.query(`
    SELECT lc.from_level, lc.to_level, lc.created_at, u.name AS changed_by_name, u.role AS changed_by_role
    FROM level_changes lc LEFT JOIN users u ON u.id = lc.changed_by
    WHERE lc.user_id = $1 ORDER BY lc.created_at DESC, lc.id DESC
  `, [userId]);
}

/** Níveis liberados para o usuário (array em ordem). */
async function unlockedLevels(user) {
  if (!user) return [];
  if (user.role !== 'student') return ORDER.slice();
  if (!user.level) return [];
  const hist = await db.query('SELECT from_level, to_level FROM level_changes WHERE user_id = $1', [user.id]);
  let max = rank(user.level);
  for (const h of hist) max = Math.max(max, rank(h.from_level), rank(h.to_level));
  return ORDER.slice(0, max + 1);
}

/** Middleware: bloqueia nível ainda não liberado (o nível vem de req.params.level ou da função). */
function requireUnlocked(getLevel = (req) => req.params.level) {
  return async (req, res, next) => {
    try {
      const level = String(getLevel(req) || '').toUpperCase();
      const unlocked = await unlockedLevels(req.user);
      if (ORDER.includes(level) && !unlocked.includes(level)) {
        return res.status(403).json({ error: 'Este nível será liberado pela sua professora.', code: 'LEVEL_LOCKED' });
      }
      req.unlockedLevels = unlocked;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { ORDER, rank, levelHistory, unlockedLevels, requireUnlocked };
