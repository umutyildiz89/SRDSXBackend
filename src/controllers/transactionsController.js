// C:/Users/umut/OneDrive/Desktop/BUTCE/backend/src/controllers/transactionsController.js
const svc = require("../services/transactionsService");

// GET /api/transactions?from=&to=&type=&salesperson_id=&customer_id=
exports.list = async (req, res) => {
  try {
    const { from, to, type, salesperson_id, customer_id } = req.query || {};
    const filters = {
      from: from || undefined,
      to: to || undefined,
      type: type || undefined,
      salesperson_id: salesperson_id || undefined,
      customer_id: customer_id || undefined,
    };
    const rows = await svc.list(filters);
    return res.json(rows);
  } catch (e) {
    console.error("transactions.list error:", e);
    return res.status(500).json({ message: "İşlem listesi alınamadı" });
  }
};

// POST /api/transactions
exports.create = async (req, res) => {
  try {
    const payload = req.body || {};
    payload.created_by_user_id = req.user?.id ?? null; // requireAuth set eder
    const result = await svc.create(payload);
    return res.status(201).json(result);
  } catch (e) {
    console.error("transactions.create error:", e);
    const msg = e?.message || "İşlem eklenemedi";
    return res.status(400).json({ message: msg });
  }
};

// PUT /api/transactions/:id
exports.update = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });

    const payload = req.body || {};
    const result = await svc.update(id, payload);
    return res.json(result);
  } catch (e) {
    console.error("transactions.update error:", e);
    const msg = e?.message || "İşlem güncellenemedi";
    return res.status(400).json({ message: msg });
  }
};

// DELETE /api/transactions/:id
exports.softDelete = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });

    const result = await svc.remove(id);
    return res.json(result);
  } catch (e) {
    console.error("transactions.softDelete error:", e);
    return res.status(400).json({ message: "İşlem silinemedi" });
  }
};
