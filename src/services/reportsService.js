const { query } = require("../db");

function asRows(res) {
  if (Array.isArray(res) && Array.isArray(res[0])) return res[0];
  if (Array.isArray(res)) return res;
  return [];
}
function oneRow(res) {
  const rows = asRows(res);
  return rows?.[0] || null;
}

function buildDateWhere({ from, to }, alias = "t") {
  const where = [];
  const params = [];
  if (from) {
    where.push(`DATE(${alias}.created_at) >= ?`);
    params.push(from);
  }
  if (to) {
    where.push(`DATE(${alias}.created_at) <= ?`);
    params.push(to);
  }
  const sql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return { sql, params };
}

// Toplam yatırım/çekim/net (USD)
async function summary({ from, to } = {}) {
  const { sql: whereSql, params } = buildDateWhere({ from, to }, "t");
  const q = `
    SELECT
      COALESCE(SUM(CASE WHEN t.type = 'YATIRIM' THEN t.amount_usd ELSE 0 END), 0) AS total_invest_usd,
      COALESCE(SUM(CASE WHEN t.type = 'CEKIM'   THEN t.amount_usd ELSE 0 END), 0) AS total_withdraw_usd,
      COALESCE(
        SUM(CASE WHEN t.type = 'YATIRIM' THEN t.amount_usd ELSE 0 END), 0
      ) - COALESCE(
        SUM(CASE WHEN t.type = 'CEKIM'   THEN t.amount_usd ELSE 0 END), 0
      ) AS net_flow_usd
    FROM TRANSACTIONS AS t
    ${whereSql}
  `;
  const row = await query(q, params);
  return oneRow(row) || { total_invest_usd: 0, total_withdraw_usd: 0, net_flow_usd: 0 };
}

// Satışçı kırılımı (USD)
async function bySalesperson({ from, to } = {}) {
  const { sql: whereSql, params } = buildDateWhere({ from, to }, "t");
  const q = `
    SELECT
      sp.id   AS salesperson_id,
      COALESCE(sp.name, '-') AS salesperson_name,
      COALESCE(SUM(CASE WHEN t.type = 'YATIRIM' THEN t.amount_usd ELSE 0 END), 0) AS invest_usd,
      COALESCE(SUM(CASE WHEN t.type = 'CEKIM'   THEN t.amount_usd ELSE 0 END), 0) AS withdraw_usd,
      COALESCE(
        SUM(CASE WHEN t.type = 'YATIRIM' THEN t.amount_usd ELSE 0 END), 0
      ) - COALESCE(
        SUM(CASE WHEN t.type = 'CEKIM'   THEN t.amount_usd ELSE 0 END), 0
      ) AS net_usd
    FROM TRANSACTIONS AS t
    LEFT JOIN SALESPERSONS AS sp ON sp.id = t.salesperson_id
    ${whereSql}
    GROUP BY sp.id, sp.name
    ORDER BY net_usd DESC, invest_usd DESC
  `;
  const rows = await query(q, params);
  return asRows(rows);
}

// Belirli satışçı istatistikleri (adet bazlı)
async function salespersonStats({ salesperson_id, from, to }) {
  // Bu ay yatırım adedi
  const { sql: whereSql, params } = buildDateWhere({ from, to }, "t");
  params.push(salesperson_id);

  const qThisMonth = `
    SELECT COUNT(*) AS invest_count
    FROM TRANSACTIONS AS t
    WHERE t.type = 'YATIRIM'
      ${whereSql ? whereSql.replace(/^WHERE/i, "AND") : ""}
      AND t.salesperson_id = ?
  `;
  const thisMonthRow = oneRow(await query(qThisMonth, params)) || { invest_count: 0 };

  // Geçen ay yatırım adedi
  let prevFrom, prevTo;
  if (from && to) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    fromDate.setMonth(fromDate.getMonth() - 1);
    toDate.setMonth(toDate.getMonth() - 1);
    prevFrom = fromDate.toISOString().slice(0, 10);
    prevTo = toDate.toISOString().slice(0, 10);
  }
  const { sql: prevWhereSql, params: prevParams } = buildDateWhere(
    { from: prevFrom, to: prevTo },
    "t"
  );
  prevParams.push(salesperson_id);
  const qPrevMonth = `
    SELECT COUNT(*) AS invest_count
    FROM TRANSACTIONS AS t
    WHERE t.type = 'YATIRIM'
      ${prevWhereSql ? prevWhereSql.replace(/^WHERE/i, "AND") : ""}
      AND t.salesperson_id = ?
  `;
  const prevMonthRow = oneRow(await query(qPrevMonth, prevParams)) || { invest_count: 0 };

  // Hedef (default 20) — satışçı tablosunda varsa override
  const qTarget = `SELECT target_invest_count FROM SALESPERSONS WHERE id = ? LIMIT 1`;
  const targetRow = oneRow(await query(qTarget, [salesperson_id]));
  const target = targetRow?.target_invest_count ?? 20;

  return {
    salesperson_id,
    current_invest_count: thisMonthRow.invest_count || 0,
    prev_invest_count: prevMonthRow.invest_count || 0,
    target
  };
}

module.exports = {
  summary,
  bySalesperson,
  salespersonStats
};
