// C:/Users/umut/OneDrive/Desktop/BUTCE/backend/src/controllers/salespersonsController.js
const service = require("../services/salespersonsService");

function toInt(v, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

async function list(req, res) {
  try {
    const rows = await service.list();
    const norm = rows.map(r => ({
      id: r.id,
      name: r.name,
      code: r.code,
      is_active: toInt(r.is_active, 0),
      created_by_user_id: r.created_by_user_id,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
    return res.json({ data: norm });
  } catch (e) {
    console.error("salespersons.list error:", e);
    return res.status(500).json({ message: "Satışçı listesi alınamadı" });
  }
}

async function create(req, res) {
  try {
    const { name, code, is_active } = req.body || {};
    if (!name || String(name).trim().length === 0) {
      return res.status(400).json({ message: "Ad gerekli" });
    }
    const created_by_user_id = req.user?.id || null;
    const result = await service.create({ name: String(name).trim(), code, is_active, created_by_user_id });
    return res.status(201).json({ id: result.id });
  } catch (e) {
    console.error("salespersons.create error:", e);
    return res.status(500).json({ message: "Satışçı eklenemedi" });
  }
}

async function update(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });

    const { name, code, is_active } = req.body || {};
    if (!name || String(name).trim().length === 0) {
      return res.status(400).json({ message: "Ad gerekli" });
    }

    await service.update(id, { name: String(name).trim(), code, is_active });
    return res.json({ id });
  } catch (e) {
    console.error("salespersons.update error:", e);
    return res.status(500).json({ message: "Satışçı güncellenemedi" });
  }
}

async function softDelete(req, res) {
  try {
    const id = toInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Geçersiz id" });

    await service.softDelete(id);
    return res.json({ id });
  } catch (e) {
    console.error("salespersons.softDelete error:", e);
    return res.status(500).json({ message: "Satışçı pasif edilemedi" });
  }
}

module.exports = { list, create, update, softDelete };
