// backend/src/routes/customers.js
"use strict";

const express = require("express");
const router = express.Router();

// db.js -> { pool, query, dbHealthCheck }
// q bekleyen yerler için query'yi alias'lıyoruz
const { query, pool } = require("../db");
const q = (sql, params = []) => query(sql, params);

// ------- Yardımcılar -------
function isBlank(s) {
  return !s || String(s).trim() === "";
}

function logDbError(where, err) {
  // PlanetScale şifre/bağlantı hatalarını net görmek için ayrıntılı log
  console.error(`[${where}] DB ERROR ->`, {
    code: err && err.code,
    errno: err && err.errno,
    sqlState: err && err.sqlState,
    sqlMessage: err && err.sqlMessage,
    message: err && err.message,
    stack: err && err.stack,
  });
}

// Satışçı var mı + aktif mi + code dolu mu?
async function ensureSalespersonOk(id) {
  const rows = await q(
    `SELECT id, name, code, is_active
     FROM SALESPERSONS
     WHERE id = ?`,
    [Number(id)]
  );
  const sp = rows[0];
  if (!sp) throw new Error("SP_NOT_FOUND");
  if (!sp.is_active) throw new Error("SP_INACTIVE");
  if (isBlank(sp.code)) throw new Error("SP_CODE_EMPTY");
  return sp;
}

// ============ LISTE ============
// GET /api/customers
router.get("/", async (req, res) => {
  try {
    const rows = await q(
      `SELECT id, customer_code, name, phone, email, salesperson_id, created_by_user_id, is_active, created_at
       FROM CUSTOMERS
       ORDER BY id DESC
       LIMIT 200`
    );
    res.json(rows);
  } catch (e) {
    logDbError("GET /api/customers", e);
    const isDev = process.env.NODE_ENV !== "production";
    res.status(500).json({
      message: "Server error",
      ...(isDev ? { detail: e.message, code: e.code } : {}),
    });
  }
});

// ============ DETAY ============
// GET /api/customers/:id
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await q(
      `SELECT id, customer_code, name, phone, email, salesperson_id, created_by_user_id, is_active, created_at
       FROM CUSTOMERS WHERE id = ?`,
      [id]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ message: "Not Found" });
    res.json(row);
  } catch (e) {
    logDbError("GET /api/customers/:id", e);
    const isDev = process.env.NODE_ENV !== "production";
    res.status(500).json({
      message: "Server error",
      ...(isDev ? { detail: e.message, code: e.code } : {}),
    });
  }
});

// ============ OLUŞTUR ============
// POST /api/customers
// NOT: customer_code NOT NULL olduğundan, önce 6 haneli GEÇİCİ kodla insert,
// sonra insertId -> finalCode (000001 biçimi) ile UPDATE yapıyoruz.
router.post("/", async (req, res) => {
  let conn;
  try {
    const {
      name,
      phone = null,
      email = null,
      salesperson_id,
      is_active = 1,
    } = req.body || {};

    if (isBlank(name)) {
      return res.status(400).json({ message: "name zorunlu" });
    }
    if (!Number.isInteger(Number(salesperson_id))) {
      return res.status(400).json({ message: "salesperson_id zorunlu" });
    }

    // Satışçı kontrolü (aktif + code dolu)
    try {
      await ensureSalespersonOk(Number(salesperson_id));
    } catch (err) {
      if (err.message === "SP_NOT_FOUND")
        return res.status(400).json({ message: "Satışçı bulunamadı" });
      if (err.message === "SP_INACTIVE")
        return res.status(400).json({ message: "Satışçı pasif" });
      if (err.message === "SP_CODE_EMPTY")
        return res.status(400).json({ message: "Satışçı code boş olamaz" });
      throw err;
    }

    const created_by_user_id = req.user?.id || 1; // yoksa OPM (1)

    // Tek transaction'la güvenli ilerleyelim
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 6 haneli geçici kod üret (ör. 482913) — UNIQUE varsa çakışmaya karşı 3 deneme
    const genTempCode = () =>
      String(Math.floor(100000 + Math.random() * 900000));

    let insertId = null;
    let attempts = 0;
    while (insertId === null && attempts < 3) {
      const tempCode = genTempCode();
      try {
        const [ins] = await conn.execute(
          `INSERT INTO CUSTOMERS
             (customer_code, name, phone, email, salesperson_id, created_by_user_id, is_active, created_at)
           VALUES
             (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            tempCode,
            String(name).trim(),
            phone,
            email,
            Number(salesperson_id),
            created_by_user_id,
            is_active ? 1 : 0,
          ]
        );
        insertId = ins.insertId;
      } catch (e) {
        if (e && e.code === "ER_DUP_ENTRY") {
          attempts += 1;
          continue;
        }
        throw e;
      }
    }

    if (insertId === null) {
      await conn.rollback();
      return res
        .status(409)
        .json({ message: "Geçici customer_code üretilemedi." });
    }

    const finalCode = String(insertId).padStart(6, "0");

    // Final kodu set et
    await conn.execute(
      `UPDATE CUSTOMERS SET customer_code = ? WHERE id = ?`,
      [finalCode, insertId]
    );

    await conn.commit();

    // Son kaydı döndür
    const rows = await q(
      `SELECT id, customer_code, name, phone, email, salesperson_id, created_by_user_id, is_active, created_at
       FROM CUSTOMERS WHERE id = ?`,
      [insertId]
    );
    return res.status(201).json(rows[0]);
  } catch (e) {
    try {
      if (conn) await conn.rollback();
    } catch {}
    logDbError("POST /api/customers", e);
    if (e && (e.code === "ER_DUP_ENTRY" || e.sqlState === "23000")) {
      return res.status(409).json({ message: "customer_code zaten mevcut" });
    }
    const isDev = process.env.NODE_ENV !== "production";
    return res.status(500).json({
      message: "Server error",
      ...(isDev ? { detail: e.message, code: e.code } : {}),
    });
  } finally {
    try {
      if (conn) conn.release();
    } catch {}
  }
});

// ============ GÜNCELLE ============
// PUT /api/customers/:id
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, phone, email, is_active } = req.body || {};

    const rows = await q(`SELECT id FROM CUSTOMERS WHERE id = ?`, [id]);
    if (!rows[0]) return res.status(404).json({ message: "Not Found" });

    await q(
      `UPDATE CUSTOMERS
       SET name = COALESCE(?, name),
           phone = COALESCE(?, phone),
           email = COALESCE(?, email),
           is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [
        isBlank(name) ? null : String(name).trim(),
        isBlank(phone) ? null : phone,
        isBlank(email) ? null : email,
        typeof is_active === "number" ? (is_active ? 1 : 0) : null,
        id,
      ]
    );

    const out = await q(
      `SELECT id, customer_code, name, phone, email, salesperson_id, created_by_user_id, is_active, created_at
       FROM CUSTOMERS WHERE id = ?`,
      [id]
    );
    res.json(out[0]);
  } catch (e) {
    logDbError("PUT /api/customers/:id", e);
    const isDev = process.env.NODE_ENV !== "production";
    res.status(500).json({
      message: "Server error",
      ...(isDev ? { detail: e.message, code: e.code } : {}),
    });
  }
});

module.exports = router;
