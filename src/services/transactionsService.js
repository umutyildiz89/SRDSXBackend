// C:/Users/umut/OneDrive/Desktop/BUTCE/backend/src/services/transactionsService.js
const { query } = require("../db");

/**
 * Bazı ortamlarda query(sql, params) => [rows, fields]
 * Bazılarında => rows (dizi) veya result (obje)
 * Bu yardımcılar her iki durumu da normalize eder.
 */
function asRows(res) {
  if (Array.isArray(res) && Array.isArray(res[0])) return res[0];
  if (Array.isArray(res)) return res;
  return [];
}
function asResult(res) {
  if (Array.isArray(res)) return res[0];
  return res;
}

/**
 * Şema:
 * TRANSACTIONS(
 *   id, type('YATIRIM'|'CEKIM'), original_amount DECIMAL,
 *   currency VARCHAR(8), manual_rate_to_usd DECIMAL NULL,
 *   amount_usd DECIMAL, salesperson_id, customer_id,
 *   note, created_by_user_id, created_at, updated_at
 * )
 * SALESPERSONS(id, name, ...)
 * CUSTOMERS(id, customer_code, name, ...)
 */

// Listeleme (filtreli)
async function list(filters = {}) {
  const where = [];
  const params = [];

  // Tarih filtreleri (created_at DATE aralığı)
  if (filters.from) {
    where.push("DATE(t.created_at) >= ?");
    params.push(filters.from);
  }
  if (filters.to) {
    where.push("DATE(t.created_at) <= ?");
    params.push(filters.to);
  }

  // Tip
  if (filters.type && (filters.type === "YATIRIM" || filters.type === "CEKIM")) {
    where.push("t.type = ?");
    params.push(filters.type);
  }

  // Satışçı
  if (filters.salesperson_id) {
    where.push("t.salesperson_id = ?");
    params.push(Number(filters.salesperson_id));
  }

  // Müşteri
  if (filters.customer_id) {
    where.push("t.customer_id = ?");
    params.push(Number(filters.customer_id));
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const sql = `
    SELECT
      t.id,
      t.type,
      t.original_amount,
      t.currency,
      t.manual_rate_to_usd,
      t.amount_usd,
      t.salesperson_id,
      sp.name AS salesperson_name,
      t.customer_id,
      c.name AS customer_name,
      t.note,
      t.created_by_user_id,
      t.created_at,
      t.updated_at
    FROM TRANSACTIONS AS t
    LEFT JOIN SALESPERSONS AS sp ON sp.id = t.salesperson_id
    LEFT JOIN CUSTOMERS    AS c  ON c.id  = t.customer_id
    ${whereSql}
    ORDER BY t.created_at DESC, t.id DESC
  `;

  const res = await query(sql, params);
  return asRows(res);
}

// Tek kayıt
async function getById(id) {
  const sql = `
    SELECT
      t.id,
      t.type,
      t.original_amount,
      t.currency,
      t.manual_rate_to_usd,
      t.amount_usd,
      t.salesperson_id,
      sp.name AS salesperson_name,
      t.customer_id,
      c.name AS customer_name,
      t.note,
      t.created_by_user_id,
      t.created_at,
      t.updated_at
    FROM TRANSACTIONS AS t
    LEFT JOIN SALESPERSONS AS sp ON sp.id = t.salesperson_id
    LEFT JOIN CUSTOMERS    AS c  ON c.id  = t.customer_id
    WHERE t.id = ?
    LIMIT 1
  `;
  const res = await query(sql, [id]);
  const rows = asRows(res);
  return rows?.[0] || null;
}

// Ekleme
async function create(payload) {
  // amount_usd hesapla
  let amount_usd = Number(payload.original_amount);
  if (String(payload.currency).toUpperCase() !== "USD") {
    const rate = Number(payload.manual_rate_to_usd);
    if (!rate || rate <= 0) {
      throw new Error("USD dışı para birimi için 'manual_rate_to_usd' zorunludur.");
    }
    amount_usd = Number(payload.original_amount) * rate;
  }

  const sql = `
    INSERT INTO TRANSACTIONS
      (type, original_amount, currency, manual_rate_to_usd, amount_usd,
       salesperson_id, customer_id, note, created_by_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    String(payload.type),
    Number(payload.original_amount),
    String(payload.currency).toUpperCase(),
    payload.manual_rate_to_usd != null ? Number(payload.manual_rate_to_usd) : null,
    amount_usd,
    Number(payload.salesperson_id),
    Number(payload.customer_id),
    payload.note ?? null,
    payload.created_by_user_id ?? null,
  ];

  const res = await query(sql, params);
  const result = asResult(res);
  return { id: result?.insertId };
}

// Güncelleme
async function update(id, payload) {
  let amount_usd = Number(payload.original_amount);
  if (String(payload.currency).toUpperCase() !== "USD") {
    const rate = Number(payload.manual_rate_to_usd);
    if (!rate || rate <= 0) {
      throw new Error("USD dışı para birimi için 'manual_rate_to_usd' zorunludur.");
    }
    amount_usd = Number(payload.original_amount) * rate;
  }

  const sql = `
    UPDATE TRANSACTIONS
    SET
      type               = ?,
      original_amount    = ?,
      currency           = ?,
      manual_rate_to_usd = ?,
      amount_usd         = ?,
      salesperson_id     = ?,
      customer_id        = ?,
      note               = ?,
      updated_at         = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  const params = [
    String(payload.type),
    Number(payload.original_amount),
    String(payload.currency).toUpperCase(),
    payload.manual_rate_to_usd != null ? Number(payload.manual_rate_to_usd) : null,
    amount_usd,
    Number(payload.salesperson_id),
    Number(payload.customer_id),
    payload.note ?? null,
    Number(id),
  ];

  const res = await query(sql, params);
  const result = asResult(res);
  return { affectedRows: result?.affectedRows ?? 0 };
}

// Silme (soft delete yapmak istersen burada hard delete yerine flag atarsın)
async function remove(id) {
  const sql = `DELETE FROM TRANSACTIONS WHERE id = ?`;
  const res = await query(sql, [id]);
  const result = asResult(res);
  return { affectedRows: result?.affectedRows ?? 0 };
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
};
