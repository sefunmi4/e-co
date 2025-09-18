const { pool } = require('../db');

async function create({ quest_id, user_id, role_type, application_message, portfolio_links }) {
  const result = await pool.query(
    'INSERT INTO team_applications (quest_id, user_id, role_type, application_message, portfolio_links) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [quest_id, user_id, role_type, application_message, portfolio_links]
  );
  const inserted = result.rows[0];
  const full = await pool.query(
    'SELECT ta.*, u.email AS applicant_email, ta.created_at AS created_date FROM team_applications ta JOIN users u ON ta.user_id = u.id WHERE ta.id = $1',
    [inserted.id]
  );
  return full.rows[0];
}

async function list({ quest_id, status, user_id } = {}) {
  const conditions = [];
  const values = [];
  let idx = 1;
  if (quest_id) { conditions.push(`quest_id = $${idx++}`); values.push(quest_id); }
  if (status) { conditions.push(`status = $${idx++}`); values.push(status); }
  if (user_id) { conditions.push(`user_id = $${idx++}`); values.push(user_id); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT ta.*, u.email AS applicant_email, ta.created_at AS created_date FROM team_applications ta JOIN users u ON ta.user_id = u.id ${where} ORDER BY ta.created_at DESC`,
    values
  );
  return result.rows;
}

async function update(id, fields) {
  const { status } = fields;
  const result = await pool.query(
    'UPDATE team_applications SET status = COALESCE($1, status) WHERE id = $2 RETURNING id',
    [status, id]
  );
  const updated = result.rows[0];
  const full = await pool.query(
    'SELECT ta.*, u.email AS applicant_email, ta.created_at AS created_date FROM team_applications ta JOIN users u ON ta.user_id = u.id WHERE ta.id = $1',
    [updated.id]
  );
  return full.rows[0];
}

async function remove(id) {
  await pool.query('DELETE FROM team_applications WHERE id = $1', [id]);
}

module.exports = { create, list, update, remove };
