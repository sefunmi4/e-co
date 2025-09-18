const { pool } = require('../db');

async function create({ quest_id, user_id, comment_text, rating, rating_categories }) {
  const result = await pool.query(
    'INSERT INTO quest_comments (quest_id, user_id, comment_text, rating, rating_categories) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [quest_id, user_id, comment_text, rating, rating_categories]
  );
  const inserted = result.rows[0];
  const full = await pool.query(
    'SELECT qc.*, u.email AS user_email, qc.created_at AS created_date FROM quest_comments qc JOIN users u ON qc.user_id = u.id WHERE qc.id = $1',
    [inserted.id]
  );
  return full.rows[0];
}

async function list({ quest_id, page = 1, limit } = {}) {
  if (limit) {
    const offset = (page - 1) * limit;
    const result = await pool.query(
      'SELECT qc.*, u.email AS user_email, qc.created_at AS created_date FROM quest_comments qc JOIN users u ON qc.user_id = u.id WHERE quest_id = $1 ORDER BY qc.created_at DESC LIMIT $2 OFFSET $3',
      [quest_id, limit, offset]
    );
    return result.rows;
  } else {
    const result = await pool.query(
      'SELECT qc.*, u.email AS user_email, qc.created_at AS created_date FROM quest_comments qc JOIN users u ON qc.user_id = u.id WHERE quest_id = $1 ORDER BY qc.created_at DESC',
      [quest_id]
    );
    return result.rows;
  }
}

module.exports = { create, list };
