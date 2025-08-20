// C:/Users/umut/OneDrive/Desktop/BUTCE/backend/src/services/salespersonsService.js
const { query } = require("../db");

// Not: Tablo adı kesinlikle SALESPERSONS
const TABLE = "SALESPERSONS";

async function list() {
  const sql = `
    SELECT id, name, code, is_active, created_by_user_id, created_at, updated_at
    FROM ${TABLE}
    ORDER BY id DESC
  `;
  return await query(sql, []);
}

async function create({ name, code, is_active, created_by_user_id }) {
  const sql = `
    INSERT INTO ${TABLE} (name, code, is_active, created_by_user_id)
    VALUES (?, ?, ?, ?)
  `;
  const params = [name, code || null, Number(is_active ?? 1), created_by_user_id || null];
  const result = await query(sql, params);
  return { id: result.insertId };
}

async function update(id, { name, code, is_active }) {
  const sql = `
    UPDATE ${TABLE}
    SET name = ?, code = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  const params = [name, code || null, Number(is_active ?? 1), id];
  await query(sql, params);
  return { id };
}

async function softDelete(id) {
  const sql = `
    UPDATE ${TABLE}
    SET is_active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  await query(sql, [id]);
  return { id };
}

module.exports = { list, create, update, softDelete };
