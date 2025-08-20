const express = require("express");
const router = express.Router();

const requireRole = require("../middleware/requireRole");
const ctrl = require("../controllers/reportsController");

// /api/reports/* altında; index.js içinde requireAuth zaten uygulanıyor.
// Raporları sadece GENEL_MUDUR görsün:
router.get("/summary", requireRole(["GENEL_MUDUR"]), ctrl.summary);
router.get("/by-salesperson", requireRole(["GENEL_MUDUR"]), ctrl.bySalesperson);

// Yeni: Satışçı istatistikleri (hedef + bu ay / geçen ay adetleri)
router.get(
  "/salesperson-stats",
  requireRole(["GENEL_MUDUR"]),
  ctrl.salespersonStats
);

module.exports = router;
