// backend/src/routes/retMembers.js
const express = require("express");
const router = express.Router();

const db = require("../db");
const pool = db.pool || db;

const q = async (sql, params = []) => {
  const [rows] = await pool.query(sql, params);
  return rows;
};

// Tablo ve sütun adları
const TBL = "ret_members";
const COLS = {
  id: "id",
  full_name: "full_name",
  email: "email",
  phone: "phone",
  active: "active",
  created_at: "created_at",
};

// Listele (search + limit + offset)
router.get("/", async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 200) : 100;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const where = [];
    const params = [];

    if (search) {
      const like = `%${search}%`;
      where.push(
        `(${COLS.full_name} LIKE ? OR ${COLS.email} LIKE ? OR ${COLS.phone} LIKE ?)`
      );
      params.push(like, like, like);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const rows = await q(
      `
      SELECT ${COLS.id} AS id,
             ${COLS.full_name} AS full_name,
             ${COLS.email} AS email,
             ${COLS.phone} AS phone,
             ${COLS.active} AS active,
             ${COLS.created_at} AS created_at
      FROM ${TBL}
      ${whereSql}
      ORDER BY ${COLS.id} DESC
      LIMIT ? OFFSET ?
    `,
      [...params, limit, offset]
    );

    res.json(rows);
  } catch (e) {
    console.error("GET /ret-members error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// Tek kayıt getir (opsiyonel ama faydalı)
router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Geçersiz id" });

    const rows = await q(
      `SELECT ${COLS.id} AS id,
              ${COLS.full_name} AS full_name,
              ${COLS.email} AS email,
              ${COLS.phone} AS phone,
              ${COLS.active} AS active,
              ${COLS.created_at} AS created_at
       FROM ${TBL}
       WHERE ${COLS.id} = ?`,
      [id]
    );

    if (rows.length === 0) return res.status(404).json({ message: "Kayıt bulunamadı" });
    res.json(rows[0]);
  } catch (e) {
    console.error("GET /ret-members/:id error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// Ekle
router.post("/", async (req, res) => {
  try {
    const { full_name, email = null, phone = null, active = true } = req.body || {};
    if (!full_name || String(full_name).trim() === "") {
      return res.status(400).json({ message: "full_name zorunlu" });
    }

    const body = [
      String(full_name).trim(),
      email ? String(email).trim() : null,
      phone ? String(phone).trim() : null,
      active ? 1 : 0,
    ];

    const result = await q(
      `INSERT INTO ${TBL} (${COLS.full_name}, ${COLS.email}, ${COLS.phone}, ${COLS.active})
       VALUES (?, ?, ?, ?)`,
      body
    );

    const inserted = await q(
      `SELECT ${COLS.id} AS id,
              ${COLS.full_name} AS full_name,
              ${COLS.email} AS email,
              ${COLS.phone} AS phone,
              ${COLS.active} AS active,
              ${COLS.created_at} AS created_at
       FROM ${TBL}
       WHERE ${COLS.id} = ?`,
      [result.insertId]
    );

    res.status(201).json(inserted[0]);
  } catch (e) {
    console.error("POST /ret-members error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// Güncelle (kısmi)
router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Geçersiz id" });

    const { full_name, email, phone, active } = req.body || {};

    const sets = [];
    const params = [];

    if (typeof full_name !== "undefined") {
      if (!full_name || String(full_name).trim() === "")
        return res.status(400).json({ message: "full_name boş olamaz" });
      sets.push(`${COLS.full_name} = ?`);
      params.push(String(full_name).trim());
    }
    if (typeof email !== "undefined") {
      sets.push(`${COLS.email} = ?`);
      params.push(email ? String(email).trim() : null);
    }
    if (typeof phone !== "undefined") {
      sets.push(`${COLS.phone} = ?`);
      params.push(phone ? String(phone).trim() : null);
    }
    if (typeof active !== "undefined") {
      sets.push(`${COLS.active} = ?`);
      params.push(active ? 1 : 0);
    }

    if (sets.length === 0) {
      return res.status(400).json({ message: "Güncellenecek alan yok" });
    }

    await q(`UPDATE ${TBL} SET ${sets.join(", ")} WHERE ${COLS.id} = ?`, [...params, id]);

    const rows = await q(
      `SELECT ${COLS.id} AS id,
              ${COLS.full_name} AS full_name,
              ${COLS.email} AS email,
              ${COLS.phone} AS phone,
              ${COLS.active} AS active,
              ${COLS.created_at} AS created_at
       FROM ${TBL}
       WHERE ${COLS.id} = ?`,
      [id]
    );

    if (rows.length === 0) return res.status(404).json({ message: "Kayıt bulunamadı" });
    res.json(rows[0]);
  } catch (e) {
    console.error("PUT /ret-members/:id error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// Sil
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Geçersiz id" });

    const result = await q(`DELETE FROM ${TBL} WHERE ${COLS.id} = ?`, [id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: "Kayıt bulunamadı" });

    res.json({ success: true });
  } catch (e) {
    console.error("DELETE /ret-members/:id error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
