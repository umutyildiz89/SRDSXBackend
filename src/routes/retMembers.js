/**
 * RET Üyeleri Router
 * - Listeleme ve tek kayıt okuma: OPERASYON_MUDURU + GENEL_MUDUR
 * - Ekle / Güncelle / Sil: sadece OPERASYON_MUDURU
 *
 * Notlar:
 *  - ?search=...           → ad/e-posta/telefon araması (LIKE)
 *  - ?active=1|0|true|false → aktif/pasif filtre
 *  - ?limit=100&offset=0   → sayfalama (limit en fazla 200)
 */

const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");

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

// yardımcılar
const toInt = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const parseBool = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(s)) return true;
  if (["0", "false", "no", "off"].includes(s)) return false;
  return null; // geçersiz → filtreleme yok
};

// ==============================
// LİSTELE (GM + OP)
// ==============================
router.get(
  "/",
  requireAuth,
  requireRole(["OPERASYON_MUDURU", "GENEL_MUDUR"]),
  async (req, res) => {
    try {
      const search = (req.query.search || "").trim();
      const activeFilter = parseBool(req.query.active);
      const limit = clamp(toInt(req.query.limit, 100), 1, 200);
      const offset = Math.max(0, toInt(req.query.offset, 0));

      const where = [];
      const params = [];

      if (search) {
        const like = `%${search}%`;
        where.push(
          `(${COLS.full_name} LIKE ? OR ${COLS.email} LIKE ? OR ${COLS.phone} LIKE ?)`
        );
        params.push(like, like, like);
      }

      if (activeFilter !== null) {
        where.push(`${COLS.active} = ?`);
        params.push(activeFilter ? 1 : 0);
      }

      const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

      const rows = await q(
        `
        SELECT ${COLS.id}         AS id,
               ${COLS.full_name}  AS full_name,
               ${COLS.email}      AS email,
               ${COLS.phone}      AS phone,
               ${COLS.active}     AS active,
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
  }
);

// ==============================
// TEK KAYIT (GM + OP)
// ==============================
router.get(
  "/:id",
  requireAuth,
  requireRole(["OPERASYON_MUDURU", "GENEL_MUDUR"]),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: "Geçersiz id" });
      }

      const rows = await q(
        `SELECT ${COLS.id}         AS id,
                ${COLS.full_name}  AS full_name,
                ${COLS.email}      AS email,
                ${COLS.phone}      AS phone,
                ${COLS.active}     AS active,
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
  }
);

// ==============================
// EKLE (yalnızca OP)
// ==============================
router.post(
  "/",
  requireAuth,
  requireRole("OPERASYON_MUDURU"),
  async (req, res) => {
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
        `SELECT ${COLS.id}         AS id,
                ${COLS.full_name}  AS full_name,
                ${COLS.email}      AS email,
                ${COLS.phone}      AS phone,
                ${COLS.active}     AS active,
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
  }
);

// ==============================
// GÜNCELLE (yalnızca OP)
// ==============================
router.put(
  "/:id",
  requireAuth,
  requireRole("OPERASYON_MUDURU"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: "Geçersiz id" });
      }

      const { full_name, email, phone, active } = req.body || {};

      const sets = [];
      const params = [];

      if (typeof full_name !== "undefined") {
        if (!full_name || String(full_name).trim() === "") {
          return res.status(400).json({ message: "full_name boş olamaz" });
        }
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
        `SELECT ${COLS.id}         AS id,
                ${COLS.full_name}  AS full_name,
                ${COLS.email}      AS email,
                ${COLS.phone}      AS phone,
                ${COLS.active}     AS active,
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
  }
);

// ==============================
// SİL (yalnızca OP)
// ==============================
router.delete(
  "/:id",
  requireAuth,
  requireRole("OPERASYON_MUDURU"),
  async (req, res) => {
    try {
      const id = toInt(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ message: "Geçersiz id" });
      }

      const result = await q(`DELETE FROM ${TBL} WHERE ${COLS.id} = ?`, [id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Kayıt bulunamadı" });
      }

      res.json({ success: true });
    } catch (e) {
      console.error("DELETE /ret-members/:id error:", e);
      res.status(500).json({ message: "Server error" });
    }
  }
);

module.exports = router;
