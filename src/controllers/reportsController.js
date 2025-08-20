const svc = require("../services/reportsService");

// ?from=YYYY-MM-DD&to=YYYY-MM-DD
exports.summary = async (req, res) => {
  try {
    const { from, to } = req.query || {};
    const data = await svc.summary({ from, to });
    return res.json(data);
  } catch (e) {
    console.error("reports.summary error:", e);
    return res.status(500).json({ message: "Rapor özet alınamadı" });
  }
};

// ?from=YYYY-MM-DD&to=YYYY-MM-DD
exports.bySalesperson = async (req, res) => {
  try {
    const { from, to } = req.query || {};
    const rows = await svc.bySalesperson({ from, to });
    return res.json({ rows });
  } catch (e) {
    console.error("reports.bySalesperson error:", e);
    return res.status(500).json({ message: "Satışçı kırılımı alınamadı" });
  }
};

// ?salesperson_id=XX&from=YYYY-MM-DD&to=YYYY-MM-DD
// Bu ay yatırım adedi, geçen ay yatırım adedi, hedef (default 20)
exports.salespersonStats = async (req, res) => {
  try {
    const { salesperson_id, from, to } = req.query || {};
    if (!salesperson_id) {
      return res.status(400).json({ message: "salesperson_id zorunlu" });
    }

    const data = await svc.salespersonStats({
      salesperson_id: Number(salesperson_id),
      from,
      to
    });
    return res.json(data);
  } catch (e) {
    console.error("reports.salespersonStats error:", e);
    return res.status(500).json({ message: "Satışçı istatistikleri alınamadı" });
  }
};
