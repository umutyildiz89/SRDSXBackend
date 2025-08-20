// C:/Users/umut/OneDrive/Desktop/BUTCE/backend/src/services/customersService.js
const { query } = require("../db");

/**
 * Bazı ortamlarda query(sql, params) => [rows, fields]
 * Bazılarında => rows (düz dizi) veya result (INSERT sonucu obje)
 * Aşağıdaki yardımcılar iki durumu da güvenli şekilde ele alır.
 */
function asRows(res) {
  // [rows, fields] -> rows
  if (Array.isArray(res) && Array.isArray(res[0])) return res[0];
  // rows -> rows
  if (Array.isArray(res)) return res;
  // bilinmeyen -> boş dizi
  return [];
}

function asResult(res) {
  // [result, fields] -> result
  if (Array.isArray(res)) return res[0];
  // result -> result
  return res;
}

/**
 * Müşteriler Servisi
 * Şema: CUSTOMERS(id, customer_code, name, phone, email, salesperson_id,
 *                 is_active, created_by_user_id, created_at, updated_at)
 *       SALESPERSONS(id, name, code, is_active, created_by_user_id, created_at, updated_at)
 */

// Liste
async function list() {
  const sql = `
    SELECT
      c.id,
      c.customer_code,
      c.name,
      c.phone,
      c.email,
      c.salesperson_id,
      COALESCE(sp.name, '-') AS salesperson_name,
      c.is_active,
      c.created_by_user_id,
      c.created_at,
      c.updated_at
    FROM CUSTOMERS AS c
    LEFT JOIN SALESPERSONS AS sp ON sp.id = c.salesperson_id
    ORDER BY c.id DESC
  `;
  const res = await query(sql);
  return asRows(res);
}

// Tek kayıt
async function getById(id) {
  const sql = `
    SELECT
      c.id,
      c.customer_code,
      c.name,
      c.phone,
      c.email,
      c.salesperson_id,
      COALESCE(sp.name, '-') AS salesperson_name,
      c.is_active,
      c.created_by_user_id,
      c.created_at,
      c.updated_at
    FROM CUSTOMERS AS c
    LEFT JOIN SALESPERSONS AS sp ON sp.id = c.salesperson_id
    WHERE c.id = ?
    LIMIT 1
  `;
  const res = await query(sql, [id]);
  const rows = asRows(res);
  return rows?.[0] || null;
}

// Ekle
async function create(payload) {
  const sql = `
    INSERT INTO CUSTOMERS
      (customer_code, name, phone, email, salesperson_id, is_active, created_by_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    payload.customer_code,
    payload.name,
    payload.phone ?? null,
    payload.email ?? null,
    payload.salesperson_id,
    Number(payload.is_active ?? 1),
    payload.created_by_user_id ?? null,
  ];

  const res = await query(sql, params);
  const result = asResult(res);
  return { id: result?.insertId };
}

// Güncelle
async function update(id, payload) {
  const sql = `
    UPDATE CUSTOMERS
    SET
      customer_code  = ?,
      name           = ?,
      phone          = ?,
      email          = ?,
      salesperson_id = ?,
      is_active      = ?,
      updated_at     = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  const params = [
    payload.customer_code,
    payload.name,
    payload.phone ?? null,
    payload.email ?? null,
    payload.salesperson_id,
    Number(payload.is_active ?? 1),
    id,
  ];

  const res = await query(sql, params);
  const result = asResult(res);
  return { affectedRows: result?.affectedRows ?? 0 };
}

// Pasif et (soft delete)
async function softDelete(id) {
  const sql = `
    UPDATE CUSTOMERS
    SET is_active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  const res = await query(sql, [id]);
  const result = asResult(res);
  return { affectedRows: result?.affectedRows ?? 0 };
}

module.exports = {
  list,
  getById,
  create,
  update,
  softDelete,
};
