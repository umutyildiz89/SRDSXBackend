// C:/Users/umut/OneDrive/Desktop/BUTCE/backend/src/routes/transactions.js
// Express Router (CommonJS) — JSX YOK

const express = require("express");
const router = express.Router();

const requireRole = require("../middleware/requireRole");
const validateTransaction = require("../middleware/validateTransaction");
const ctrl = require("../controllers/transactionsController");

// Not: index.js içinde /api/transactions mount edilirken requireAuth zaten uygulanıyor.
// Bu yüzden burada tekrar requireAuth çağırmıyoruz.

// Listeleme (her iki rol görebilir)
router.get("/", ctrl.list);

// Ekleme (sadece OPERASYON_MUDURU) — USD dışı için validateTransaction kontrolü
router.post(
  "/",
  requireRole(["OPERASYON_MUDURU"]),
  validateTransaction,
  ctrl.create
);

// Güncelleme (sadece OPERASYON_MUDURU)
router.put(
  "/:id",
  requireRole(["OPERASYON_MUDURU"]),
  validateTransaction,
  ctrl.update
);

// Silme (sadece OPERASYON_MUDURU) — şu an hard delete
router.delete(
  "/:id",
  requireRole(["OPERASYON_MUDURU"]),
  ctrl.softDelete
);

module.exports = router;
