// backend/src/routes/transactions.js
// Express Router (CommonJS) — JSX YOK

const express = require("express");
const router = express.Router();

const requireRole = require("../middleware/requireRole");
const validateTransaction = require("../middleware/validateTransaction");
const ctrl = require("../controllers/transactionsController");
const { query } = require("../db");

// Not: index.js içinde /api/transactions mount edilirken requireAuth zaten uygulanıyor.
// Bu yüzden burada tekrar requireAuth çağırmıyoruz.

/**
 * RET normalizasyonu:
 * - salesperson_id: 0 / "0" / "" / null / undefined => RET (alanı kaldır -> DB'de NULL)
 * - currency: uppercase
 * - original_amount: yoksa originalAmount/amount_usd/amountUsd/amount'dan türet
 */
function normalizeRet(req, _res, next) {
  try {
    const b = req.body || {};

    // salesperson normalize
    const spRaw = b.salesperson_id ?? b.salespersonId;
    if (
      spRaw === undefined ||
      spRaw === null ||
      spRaw === "" ||
      Number(spRaw) === 0
    ) {
      // RET: alanı tamamen kaldır -> validator "zorunlu" görmesin, DB default NULL yazsın
      delete b.salesperson_id;
      delete b.salespersonId;
    } else {
      const n = Number(spRaw);
      if (Number.isFinite(n)) b.salesperson_id = n;
    }

    // currency normalize (USD/TRY/EUR…)
    if (typeof b.currency === "string") {
      b.currency = b.currency.toUpperCase();
    }

    // original_amount normalize
    if (b.original_amount == null || b.original_amount === "") {
      const cands = [b.originalAmount, b.amount_usd, b.amountUsd, b.amount];
      for (const v of cands) {
        if (v != null && v !== "") {
          b.original_amount = Number(v);
          break;
        }
      }
    }

    req.body = b;
    next();
  } catch (e) {
    next(e);
  }
}

/** =========================
 *  GET /api/transactions
 *  (Mevcut davranışı controller'a bırakıyoruz)
 *  ========================= */
router.get("/", ctrl.list);

/** =========================
 *  GET /api/transactions/summary
 *  Retention/Customers'ın beklediği özet (404'u bitirir)
 *  Destek: ?groupBy=customer_id  [&type=YATIRIM]
 *  ========================= */
router.get(
  "/summary",
  requireRole(["OPERASYON_MUDURU", "GENEL_MUDUR"]),
  async (req, res) => {
    try {
      const groupBy = String(req.query.groupBy || "").toLowerCase();
      const type = (req.query.type || "").trim();

      if (groupBy && groupBy !== "customer_id") {
        return res
          .status(400)
          .json({ message: "groupBy=customer_id desteklenir" });
      }

      const where = [];
      const params = [];
      if (type) {
        where.push("t.type = ?");
        params.push(type);
      }

      const sql = `
        SELECT
          t.customer_id,
          COUNT(*) AS txn_count,
          SUM(COALESCE(t.amount_usd, t.original_amount, t.amount)) AS total_usd
        FROM transactions t
        ${where.length ? "WHERE " + where.join(" AND ") : ""}
        GROUP BY t.customer_id
      `;

      const rows = await query(sql, params);
      const shaped = rows.map((r) => ({
        customer_id: Number(r.customer_id),
        txn_count: Number(r.txn_count || 0),
        total_usd: Number(r.total_usd || 0),
      }));
      res.json(shaped);
    } catch (e) {
      res.status(500).json({ message: e.message || "Özet hatası" });
    }
  }
);

/** =========================
 *  POST /api/transactions
 *  GM + OP izinli (RET testini kolaylaştırmak için)
 *  RET ise salesperson_id alanını göndermene gerek yok; gönderirsen 0/""/null kabul.
 *  ========================= */
router.post(
  "/",
  requireRole(["OPERASYON_MUDURU", "GENEL_MUDUR"]),
  normalizeRet,          // ← 0/""/null → RET (alanı kaldır)
  validateTransaction,   // ← mevcut şemana çarpmadan geçsin
  ctrl.create
);

/** =========================
 *  PUT /api/transactions/:id
 *  (Güncelleme: sadece OP, istersen GM de eklenir)
 *  ========================= */
router.put(
  "/:id",
  requireRole(["OPERASYON_MUDURU"]),
  normalizeRet,          // update sırasında da RET togglesı desteklensin
  validateTransaction,
  ctrl.update
);

/** =========================
 *  DELETE /api/transactions/:id
 *  (Silme: sadece OP)
 *  ========================= */
router.delete(
  "/:id",
  requireRole(["OPERASYON_MUDURU"]),
  ctrl.softDelete
);

module.exports = router;
