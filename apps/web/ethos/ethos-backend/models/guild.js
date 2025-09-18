const { pool } = require('../db');
const guildMemberships = require('./guildMembership');

async function create({ name, description, owner_id }) {
  const result = await pool.query(
    'INSERT INTO guilds (name, description, owner_id) VALUES ($1, $2, $3) RETURNING *',
    [name, description, owner_id]
  );
  const guild = result.rows[0];
  if (guild && owner_id) {
    await guildMemberships.addApproved(guild.id, owner_id, 'owner');
  }
  return guild;
}

async function list() {
  const result = await pool.query('SELECT * FROM guilds ORDER BY id');
  return result.rows;
}

async function get(id) {
  const result = await pool.query('SELECT * FROM guilds WHERE id = $1', [id]);
  return result.rows[0];
}

async function update(id, fields) {
  const { name, description, owner_id } = fields;
  const result = await pool.query(
    'UPDATE guilds SET name = COALESCE($1, name), description = COALESCE($2, description), owner_id = COALESCE($3, owner_id) WHERE id = $4 RETURNING *',
    [name, description, owner_id, id]
  );
  return result.rows[0];
}

async function remove(id) {
  await pool.query('DELETE FROM guilds WHERE id = $1', [id]);
}

module.exports = { create, list, get, update, remove };
