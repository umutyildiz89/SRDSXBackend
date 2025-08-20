// backend/src/routes/gm.js
"use strict";

const express = require("express");
const router = express.Router();

// DB: query'yi q olarak alias'lıyoruz
const { query } = require("../db");
const q = (sql, params = []) => query(sql, params);

// Gerçek auth & role middleware'leri
const requireAuth = require("../middleware/requireAuth");
const requireRole = require("../middleware/requireRole");

/**
 * GET /api/gm/assignable
 * GM’nin atayabileceği müşteriler: gm_assignable_customers VIEW’ından döner
 * Opsiyonel: ?limit=...&offset=...
 */
router.get(
  "/assignable",
  requireAuth,
  requireRole(["Genel Müdür", "GENEL_MUDUR"]),
  async (req, res) => {
    try {
      // cache kapat
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");

      const limit = Math.min(parseInt(req.query.limit || "200", 10), 1000);
      const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);

      const rows = await q(
        `
        SELECT
          id,
          customer_code,
          name,
          phone,
          email,
          salesperson_name,
          salesperson_code,
          created_at
        FROM gm_assignable_customers
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
        `,
        [limit, offset]
      );

      return res.status(200).json({ data: rows });
    } catch (err) {
      console.error("GET /api/gm/assignable error:", err);
      return res
        .status(500)
        .json({ error: "Sunucu hatası. Lütfen tekrar deneyin." });
    }
  }
);

module.exports = router;
