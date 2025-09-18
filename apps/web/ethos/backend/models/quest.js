const { pool } = require('../db');

async function create({ title, description, user_id, guild_id }) {
  const result = await pool.query(
    'INSERT INTO quests (title, description, user_id, guild_id) VALUES ($1, $2, $3, $4) RETURNING *',
    [title, description, user_id, guild_id]
  );
  return result.rows[0];
}

async function list(filters = {}) {
  const conditions = [];
  const values = [];
  let idx = 1;
  if (filters.guild_id) {
    conditions.push(`guild_id = $${idx++}`);
    values.push(filters.guild_id);
  }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const result = await pool.query(`SELECT * FROM quests ${where} ORDER BY id`, values);
  return result.rows;
}

async function get(id) {
  const result = await pool.query('SELECT * FROM quests WHERE id = $1', [id]);
  return result.rows[0];
}

async function update(id, fields) {
  const { title, description, user_id, guild_id } = fields;
  const result = await pool.query(
    'UPDATE quests SET title = COALESCE($1, title), description = COALESCE($2, description), user_id = COALESCE($3, user_id), guild_id = COALESCE($4, guild_id) WHERE id = $5 RETURNING *',
    [title, description, user_id, guild_id, id]
  );
  return result.rows[0];
}

async function remove(id) {
  await pool.query('DELETE FROM quests WHERE id = $1', [id]);
}

module.exports = { create, list, get, update, remove };
