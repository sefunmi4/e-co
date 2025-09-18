const { pool } = require('../db');

async function create({ quest_id, user_id }) {
  const result = await pool.query(
    'INSERT INTO quest_likes (quest_id, user_id) VALUES ($1, $2) RETURNING id',
    [quest_id, user_id]
  );
  const inserted = result.rows[0];
  const full = await pool.query(
    'SELECT ql.*, u.email AS user_email, ql.created_at AS created_date FROM quest_likes ql JOIN users u ON ql.user_id = u.id WHERE ql.id = $1',
    [inserted.id]
  );
  return full.rows[0];
}

async function list({ quest_id, user_id, user_email } = {}) {
  const conditions = [];
  const values = [];
  let idx = 1;
  if (quest_id) { conditions.push(`quest_id = $${idx++}`); values.push(quest_id); }
  if (user_id) { conditions.push(`user_id = $${idx++}`); values.push(user_id); }
  if (user_email) { conditions.push(`user_id = (SELECT id FROM users WHERE email = $${idx++})`); values.push(user_email); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT ql.*, u.email AS user_email, ql.created_at AS created_date FROM quest_likes ql JOIN users u ON ql.user_id = u.id ${where} ORDER BY ql.id`,
    values
  );
  return result.rows;
}

async function remove(id, user_id) {
  await pool.query('DELETE FROM quest_likes WHERE id = $1 AND user_id = $2', [id, user_id]);
}

module.exports = { create, list, remove };
