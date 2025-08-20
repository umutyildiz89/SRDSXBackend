// backend/src/routes/retAssignments.js
"use strict";

const express = require("express");
const router = express.Router();

// Tek DB helper: query (db.js => { pool, query, dbHealthCheck } ile uyumlu)
const { query } = require("../db");

// Kısa yardımcılar
const q = async (sql, params = []) => query(sql, params);
const first = async (sql, params = []) => (await q(sql, params))[0] || null;

/**
 * ŞEMA — PlanetScale/Vitess: çekirdek tablolar UPPERCASE, ret_* tablolar lowercase.
 * USERS: şu an yalnızca 'username' alanını kullanıyoruz.
 */
const SCHEMA = {
  USERS_TABLE: "USERS",
  USERS_ID: "id",
  USERS_USERNAME: "username",

  CUSTOMERS_TABLE: "CUSTOMERS",
  CUSTOMERS_ID: "id",
  CUSTOMERS_NAME: "name",
  CUSTOMERS_EMAIL: "email",
  CUSTOMERS_PHONE: "phone",

  TRANSACTIONS_TABLE: "TRANSACTIONS",
  TRANSACTIONS_ID: "id",
  TRANSACTIONS_USER_ID: "salesperson_id",
  TRANSACTIONS_CUSTOMER_ID: "customer_id",
  TRANSACTIONS_CREATED_AT: "created_at",

  RET_MEMBERS_TABLE: "ret_members",
  RET_MEMBERS_ID: "id",
  RET_MEMBERS_NAME: "full_name",

  RET_ASSIGN_TABLE: "ret_assignments",
  RET_ASSIGN_ID: "id",
  RET_ASSIGN_CUSTOMER_ID: "customer_id",
  RET_ASSIGN_MEMBER_ID: "ret_member_id",
  RET_ASSIGN_ASSIGNED_BY: "assigned_by_user_id",
  RET_ASSIGN_NOTE: "note",
  RET_ASSIGN_CREATED_AT: "created_at",

  GM_VIEW: "gm_assignable_customers",
};

// ========== ATAMALAR LİSTESİ ==========
router.get("/", async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const memberId = req.query.member_id ? Number(req.query.member_id) : null;
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 200) : 100;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const where = [];
    const params = [];

    if (search) {
      const like = `%${search}%`;
      where.push(
        `(c.${SCHEMA.CUSTOMERS_NAME} LIKE ? OR c.${SCHEMA.CUSTOMERS_EMAIL} LIKE ? OR c.${SCHEMA.CUSTOMERS_PHONE} LIKE ?)`
      );
      params.push(like, like, like);
    }
    if (memberId) {
      where.push(`a.${SCHEMA.RET_ASSIGN_MEMBER_ID} = ?`);
      params.push(memberId);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sql = `
      SELECT
        a.${SCHEMA.RET_ASSIGN_ID} AS id,
        a.${SCHEMA.RET_ASSIGN_CUSTOMER_ID} AS customer_id,
        c.${SCHEMA.CUSTOMERS_NAME} AS customer_name,
        c.${SCHEMA.CUSTOMERS_EMAIL} AS customer_email,
        c.${SCHEMA.CUSTOMERS_PHONE} AS customer_phone,
        a.${SCHEMA.RET_ASSIGN_MEMBER_ID} AS ret_member_id,
        rm.${SCHEMA.RET_MEMBERS_NAME} AS ret_member_name,
        a.${SCHEMA.RET_ASSIGN_ASSIGNED_BY} AS assigned_by_user_id,
        u.${SCHEMA.USERS_USERNAME} AS assigned_by_user_name,
        a.${SCHEMA.RET_ASSIGN_NOTE} AS note,
        a.${SCHEMA.RET_ASSIGN_CREATED_AT} AS created_at
      FROM ${SCHEMA.RET_ASSIGN_TABLE} a
      JOIN ${SCHEMA.CUSTOMERS_TABLE} c ON c.${SCHEMA.CUSTOMERS_ID} = a.${SCHEMA.RET_ASSIGN_CUSTOMER_ID}
      JOIN ${SCHEMA.RET_MEMBERS_TABLE} rm ON rm.${SCHEMA.RET_MEMBERS_ID} = a.${SCHEMA.RET_ASSIGN_MEMBER_ID}
      JOIN ${SCHEMA.USERS_TABLE} u ON u.${SCHEMA.USERS_ID} = a.${SCHEMA.RET_ASSIGN_ASSIGNED_BY}
      ${whereSql}
      ORDER BY a.${SCHEMA.RET_ASSIGN_ID} DESC
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);
    const rows = await q(sql, params);
    res.json(rows);
  } catch (e) {
    console.error("GET /ret-assignments error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// ========== (Opsiyonel) ADAY MÜŞTERİLER: İlk işlem bazlı örnek ==========
router.get("/candidates", async (req, res) => {
  try {
    // 304 (cache) olmasın
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    const unassigned = req.query.unassigned === "0" ? "0" : "1";
    const search = (req.query.search || "").trim();
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 200) : 100;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const filters = [];
    const params = [];

    if (search) {
      const like = `%${search}%`;
      filters.push(
        `(c.${SCHEMA.CUSTOMERS_NAME} LIKE ? OR c.${SCHEMA.CUSTOMERS_EMAIL} LIKE ? OR c.${SCHEMA.CUSTOMERS_PHONE} LIKE ?)`
      );
      params.push(like, like, like);
    }
    if (unassigned === "1") {
      filters.push(`a.${SCHEMA.RET_ASSIGN_ID} IS NULL`);
    }
    const extra = filters.length ? ` AND ${filters.join(" AND ")}` : "";

    const sql = `
      SELECT
        c.${SCHEMA.CUSTOMERS_ID}      AS customer_id,
        c.${SCHEMA.CUSTOMERS_NAME}    AS customer_name,
        c.${SCHEMA.CUSTOMERS_EMAIL}   AS customer_email,
        c.${SCHEMA.CUSTOMERS_PHONE}   AS customer_phone,
        t.${SCHEMA.TRANSACTIONS_USER_ID} AS seller_user_id,
        NULL AS seller_name, -- Bu listede satışçı adını göstermiyoruz
        CASE WHEN a.${SCHEMA.RET_ASSIGN_ID} IS NULL THEN 0 ELSE 1 END AS already_assigned
      FROM ${SCHEMA.TRANSACTIONS_TABLE} t
      JOIN ${SCHEMA.CUSTOMERS_TABLE} c
        ON c.${SCHEMA.CUSTOMERS_ID} = t.${SCHEMA.TRANSACTIONS_CUSTOMER_ID}
      LEFT JOIN ${SCHEMA.RET_ASSIGN_TABLE} a
        ON a.${SCHEMA.RET_ASSIGN_CUSTOMER_ID} = c.${SCHEMA.CUSTOMERS_ID}
      WHERE NOT EXISTS (
        SELECT 1
        FROM ${SCHEMA.TRANSACTIONS_TABLE} t2
        WHERE t2.${SCHEMA.TRANSACTIONS_USER_ID} = t.${SCHEMA.TRANSACTIONS_USER_ID}
          AND (
               t2.${SCHEMA.TRANSACTIONS_CREATED_AT} < t.${SCHEMA.TRANSACTIONS_CREATED_AT}
            OR (t2.${SCHEMA.TRANSACTIONS_CREATED_AT} = t.${SCHEMA.TRANSACTIONS_CREATED_AT}
                AND t2.${SCHEMA.TRANSACTIONS_ID} < t.${SCHEMA.TRANSACTIONS_ID})
          )
      )
      ${extra}
      ORDER BY t.${SCHEMA.TRANSACTIONS_CREATED_AT} DESC
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);
    const rows = await q(sql, params);
    res.json(rows);
  } catch (e) {
    console.error("GET /ret-assignments/candidates error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// ========== GM: Aktif RET üyeleri (read-only) ==========
router.get("/ret-members", async (req, res) => {
  try {
    const rows = await q(
      `SELECT ${SCHEMA.RET_MEMBERS_ID} AS id, ${SCHEMA.RET_MEMBERS_NAME} AS full_name
       FROM ${SCHEMA.RET_MEMBERS_TABLE}
       WHERE active = 1
       ORDER BY ${SCHEMA.RET_MEMBERS_NAME} ASC`
    );
    res.json(rows);
  } catch (e) {
    console.error("GET /ret-assignments/ret-members error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

// ========== Yardımcılar ==========
async function getAssignmentById(id) {
  return await first(
    `
    SELECT
      a.${SCHEMA.RET_ASSIGN_ID} AS id,
      a.${SCHEMA.RET_ASSIGN_CUSTOMER_ID} AS customer_id,
      c.${SCHEMA.CUSTOMERS_NAME} AS customer_name,
      a.${SCHEMA.RET_ASSIGN_MEMBER_ID} AS ret_member_id,
      rm.${SCHEMA.RET_MEMBERS_NAME} AS ret_member_name,
      a.${SCHEMA.RET_ASSIGN_ASSIGNED_BY} AS assigned_by_user_id,
      u.${SCHEMA.USERS_USERNAME} AS assigned_by_user_name,
      a.${SCHEMA.RET_ASSIGN_NOTE} AS note,
      a.${SCHEMA.RET_ASSIGN_CREATED_AT} AS created_at
    FROM ${SCHEMA.RET_ASSIGN_TABLE} a
    JOIN ${SCHEMA.CUSTOMERS_TABLE} c ON c.${SCHEMA.CUSTOMERS_ID} = a.${SCHEMA.RET_ASSIGN_CUSTOMER_ID}
    JOIN ${SCHEMA.RET_MEMBERS_TABLE} rm ON rm.${SCHEMA.RET_MEMBERS_ID} = a.${SCHEMA.RET_ASSIGN_MEMBER_ID}
    JOIN ${SCHEMA.USERS_TABLE} u ON u.${SCHEMA.USERS_ID} = a.${SCHEMA.RET_ASSIGN_ASSIGNED_BY}
    WHERE a.${SCHEMA.RET_ASSIGN_ID} = ?
    `,
    [id]
  );
}
async function getAssignmentByCustomerId(customerId) {
  return await first(
    `
    SELECT
      a.${SCHEMA.RET_ASSIGN_ID} AS id,
      a.${SCHEMA.RET_ASSIGN_CUSTOMER_ID} AS customer_id,
      c.${SCHEMA.CUSTOMERS_NAME} AS customer_name,
      a.${SCHEMA.RET_ASSIGN_MEMBER_ID} AS ret_member_id,
      rm.${SCHEMA.RET_MEMBERS_NAME} AS ret_member_name,
      a.${SCHEMA.RET_ASSIGN_ASSIGNED_BY} AS assigned_by_user_id,
      u.${SCHEMA.USERS_USERNAME} AS assigned_by_user_name,
      a.${SCHEMA.RET_ASSIGN_NOTE} AS note,
      a.${SCHEMA.RET_ASSIGN_CREATED_AT} AS created_at
    FROM ${SCHEMA.RET_ASSIGN_TABLE} a
    JOIN ${SCHEMA.CUSTOMERS_TABLE} c ON c.${SCHEMA.CUSTOMERS_ID} = a.${SCHEMA.RET_ASSIGN_CUSTOMER_ID}
    JOIN ${SCHEMA.RET_MEMBERS_TABLE} rm ON rm.${SCHEMA.RET_MEMBERS_ID} = a.${SCHEMA.RET_ASSIGN_MEMBER_ID}
    JOIN ${SCHEMA.USERS_TABLE} u ON u.${SCHEMA.USERS_ID} = a.${SCHEMA.RET_ASSIGN_ASSIGNED_BY}
    WHERE a.${SCHEMA.RET_ASSIGN_CUSTOMER_ID} = ?
    `,
    [customerId]
  );
}

// ========== ATAMA OLUŞTUR (idempotent) ==========
router.post("/", async (req, res) => {
  try {
    const { customer_id, ret_member_id, note = null } = req.body || {};
    const cid = Number(customer_id);
    const rid = Number(ret_member_id);

    if (!Number.isInteger(cid) || !Number.isInteger(rid)) {
      return res.status(400).json({ error: "customer_id ve ret_member_id zorunludur." });
    }
    if (note && String(note).length > 1000) {
      return res.status(400).json({ error: "note en fazla 1000 karakter olabilir." });
    }

    const assigned_by_user_id = req.user?.id;
    if (!assigned_by_user_id) return res.status(401).json({ error: "Unauthorized" });

    // 1) RET üyesi aktif mi?
    const retMember = await first(
      `SELECT ${SCHEMA.RET_MEMBERS_ID} AS id
       FROM ${SCHEMA.RET_MEMBERS_TABLE}
       WHERE ${SCHEMA.RET_MEMBERS_ID} = ? AND active = 1`,
      [rid]
    );
    if (!retMember) {
      return res.status(400).json({ error: "Geçersiz veya pasif RET üyesi." });
    }

    // 2) Müşteri şu an atanabilir mi? (gm_assignable_customers view)
    const candidate = await first(`SELECT id FROM ${SCHEMA.GM_VIEW} WHERE id = ?`, [cid]);
    if (!candidate) {
      // Zaten atanmış olabilir — idempotent olarak mevcut kaydı döndür.
      const existing = await getAssignmentByCustomerId(cid);
      if (existing) {
        return res.status(200).json({ idempotent: true, data: existing });
      }
      return res.status(400).json({ error: "Müşteri şu an atamaya uygun değil." });
    }

    // 3) Zaten atanmış mı? (idempotent)
    const existing = await getAssignmentByCustomerId(cid);
    if (existing) {
      return res.status(200).json({ idempotent: true, data: existing });
    }

    // 4) Ekle (UNIQUE(customer_id) ile yarış durumunu handle ediyoruz)
    try {
      const result = await q(
        `INSERT INTO ${SCHEMA.RET_ASSIGN_TABLE}
          (${SCHEMA.RET_ASSIGN_CUSTOMER_ID}, ${SCHEMA.RET_ASSIGN_MEMBER_ID}, ${SCHEMA.RET_ASSIGN_ASSIGNED_BY}, ${SCHEMA.RET_ASSIGN_NOTE})
         VALUES (?,?,?,?)`,
        [cid, rid, assigned_by_user_id, note || null]
      );

      const created = await getAssignmentById(result.insertId);
      return res.status(201).json({ idempotent: false, data: created });
    } catch (err) {
      if (err && err.code === "ER_DUP_ENTRY") {
        const again = await getAssignmentByCustomerId(cid);
        return res.status(200).json({ idempotent: true, data: again });
      }
      console.error("INSERT ret_assignments error:", err);
      return res.status(500).json({ error: "Sunucu hatası (insert)." });
    }
  } catch (e) {
    console.error("POST /ret-assignments error:", e);
    res.status(500).json({ error: "Server error" });
  }
});

// ========== ATAMA SİL ==========
router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "Geçersiz id" });

    const result = await q(
      `DELETE FROM ${SCHEMA.RET_ASSIGN_TABLE} WHERE ${SCHEMA.RET_ASSIGN_ID} = ?`,
      [id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: "Kayıt bulunamadı" });
    res.json({ success: true });
  } catch (e) {
    console.error("DELETE /ret-assignments/:id error:", e);
    res.status(500).json({ error: "Server error" });
  }
});

// ========== ÖZET: Hangi RET üyesine kaç müşteri atanmış ==========
router.get("/summary", async (req, res) => {
  try {
    const rows = await q(
      `
      SELECT
        rm.id        AS ret_member_id,
        rm.full_name AS ret_member_name,
        COALESCE(COUNT(a.id), 0) AS assigned_count
      FROM ret_members rm
      LEFT JOIN ret_assignments a
        ON a.ret_member_id = rm.id
      WHERE rm.active = 1
      GROUP BY rm.id, rm.full_name
      ORDER BY assigned_count DESC, rm.full_name ASC
      `
    );
    res.json({ data: rows });
  } catch (e) {
    console.error("GET /ret-assignments/summary error:", e);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
