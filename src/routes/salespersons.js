// C:/Users/umut/OneDrive/Desktop/BUTCE/backend/src/routes/salespersons.js
const express = require("express");
const router = express.Router();
const requireRole = require("../middleware/requireRole");
const ctrl = require("../controllers/salespersonsController");

// Liste — her iki rol
router.get("/", ctrl.list);

// Ekle — sadece OPERASYON_MUDURU
router.post("/", requireRole(["OPERASYON_MUDURU"]), ctrl.create);

// Güncelle — sadece OPERASYON_MUDURU
router.put("/:id", requireRole(["OPERASYON_MUDURU"]), ctrl.update);

// Pasif et — sadece OPERASYON_MUDURU
router.delete("/:id", requireRole(["OPERASYON_MUDURU"]), ctrl.softDelete);

module.exports = router;
