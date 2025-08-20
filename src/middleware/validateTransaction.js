// Validate ve normalize eden middleware
module.exports = function validateTransaction(req, res, next) {
  try {
    const b = req.body || {};

    // type kontrolü
    const type = String(b.type || "").toUpperCase();
    if (type !== "YATIRIM" && type !== "CEKIM") {
      return res.status(400).json({ message: "type 'YATIRIM' veya 'CEKIM' olmalı" });
    }

    // currency normalize
    const currency = String(b.currency || "").toUpperCase();
    if (!currency) {
      return res.status(400).json({ message: "currency zorunlu" });
    }

    // virgül/nokta normalize + sayıya çevirme
    const strToNum = (v) => {
      if (v === null || v === undefined) return null;
      const s = String(v).replace(",", ".").trim();
      if (s === "") return null;
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    };

    const originalAmount = strToNum(b.original_amount);
    if (!(originalAmount > 0)) {
      return res.status(400).json({ message: "original_amount > 0 olmalı" });
    }

    let manualRate = null;
    if (currency !== "USD") {
      manualRate = strToNum(b.manual_rate_to_usd);
      if (!(manualRate > 0)) {
        return res.status(400).json({
          message: "USD dışı para birimi için manual_rate_to_usd > 0 olmalı",
        });
      }
    }

    const salespersonId = Number(b.salesperson_id);
    const customerId = Number(b.customer_id);
    if (!Number.isFinite(salespersonId) || salespersonId <= 0) {
      return res.status(400).json({ message: "salesperson_id geçersiz" });
    }
    if (!Number.isFinite(customerId) || customerId <= 0) {
      return res.status(400).json({ message: "customer_id geçersiz" });
    }

    // normalize edilmiş değerleri body'e geri yaz
    req.body.type = type;
    req.body.currency = currency;
    req.body.original_amount = originalAmount;
    req.body.manual_rate_to_usd = manualRate; // USD ise null
    req.body.salesperson_id = salespersonId;
    req.body.customer_id = customerId;
    req.body.note = b.note ? String(b.note) : null;

    return next();
  } catch (e) {
    console.error("validateTransaction error:", e);
    return res.status(400).json({ message: "Geçersiz istek" });
  }
};
