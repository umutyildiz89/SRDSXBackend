// C:/Users/umut/OneDrive/Desktop/BUTCE/backend/src/controllers/customersController.js
const svc = require("../services/customersService");

function badRequest(res, message) {
  return res.status(400).json({ message });
}

exports.list = async (req, res) => {
  try {
    const rows = await svc.list();
    res.json({ data: rows });
  } catch (err) {
    console.error("customers.list error:", err);
    res.status(500).json({ message: "Liste alınamadı" });
  }
};

exports.get = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return badRequest(res, "Geçersiz id");
  try {
    const row = await svc.getById(id);
    if (!row) return res.status(404).json({ message: "Bulunamadı" });
    res.json({ data: row });
  } catch (err) {
    console.error("customers.get error:", err);
    res.status(500).json({ message: "Detay alınamadı" });
  }
};

exports.create = async (req, res) => {
  try {
    const userId = req.user?.id ?? null;
    const {
      customer_code,
      name,
      phone = null,
      email = null,
      salesperson_id,
      is_active = 1,
    } = req.body || {};

    if (!/^\d{6}$/.test(String(customer_code || "").trim()))
      return badRequest(res, "customer_code 6 hane olmalı");
    if (!String(name || "").trim()) return badRequest(res, "name zorunlu");
    if (!Number.isFinite(Number(salesperson_id)))
      return badRequest(res, "salesperson_id zorunlu");

    const result = await svc.create({
      customer_code: String(customer_code).trim(),
      name: String(name).trim(),
      phone: phone ? String(phone).trim() : null,
      email: email ? String(email).trim() : null,
      salesperson_id: Number(salesperson_id),
      is_active: Number(is_active ?? 1),
      created_by_user_id: userId,
    });

    res.status(201).json({ id: result.id });
  } catch (err) {
    console.error("customers.create error:", err);
    res.status(500).json({ message: "Oluşturulamadı" });
  }
};

exports.update = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return badRequest(res, "Geçersiz id");

  try {
    const {
      customer_code,
      name,
      phone = null,
      email = null,
      salesperson_id,
      is_active = 1,
    } = req.body || {};

    if (!/^\d{6}$/.test(String(customer_code || "").trim()))
      return badRequest(res, "customer_code 6 hane olmalı");
    if (!String(name || "").trim()) return badRequest(res, "name zorunlu");
    if (!Number.isFinite(Number(salesperson_id)))
      return badRequest(res, "salesperson_id zorunlu");

    const result = await svc.update(id, {
      customer_code: String(customer_code).trim(),
      name: String(name).trim(),
      phone: phone ? String(phone).trim() : null,
      email: email ? String(email).trim() : null,
      salesperson_id: Number(salesperson_id),
      is_active: Number(is_active ?? 1),
    });

    res.json({ ok: result.affectedRows > 0 });
  } catch (err) {
    console.error("customers.update error:", err);
    res.status(500).json({ message: "Güncellenemedi" });
  }
};

exports.softDelete = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return badRequest(res, "Geçersiz id");

  try {
    const result = await svc.softDelete(id);
    res.json({ ok: result.affectedRows > 0 });
  } catch (err) {
    console.error("customers.delete error:", err);
    res.status(500).json({ message: "Pasif edilemedi" });
  }
};
