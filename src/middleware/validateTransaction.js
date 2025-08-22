// backend/src/middleware/validateTransaction.js
const { z } = require("zod");

// boş ya da 0 değerleri RET anlamında null'a çevir
const toNullish = (v) => {
  if (v === undefined || v === null) return null;
  if (v === "" || v === "0" || v === 0) return null;
  return v;
};

const baseSchema = z.object({
  customer_id: z.preprocess((v) => Number(v), z.number().int().positive()),
  type: z
    .string()
    .transform((s) => String(s).trim().toUpperCase())
    .refine((s) => ["YATIRIM", "ÇEKİM", "CEKIM", "YATIRIM_IPTAL"].includes(s), {
      message: "type geçersiz",
    }),
  currency: z
    .string()
    .transform((s) => String(s).trim().toUpperCase())
    .refine((s) => ["USD", "TRY", "EUR"].includes(s), { message: "currency zorunlu" }),
  original_amount: z.preprocess((v) => Number(v), z.number().positive({ message: "original_amount > 0 olmalı" })),
  // RET için null/optional
  salesperson_id: z
    .preprocess(toNullish, z.number().int().positive().nullable().optional()),
  // İsteğe bağlı alanlar (bazı client'lar gönderiyor olabilir)
  amount: z.preprocess((v) => (v === undefined || v === null ? undefined : Number(v)), z.number().nonnegative().optional()),
  amount_usd: z.preprocess((v) => (v === undefined || v === null ? undefined : Number(v)), z.number().nonnegative().optional()),
});

module.exports = function validateTransaction(req, res, next) {
  try {
    const parsed = baseSchema.parse(req.body || {});
    // Normalize: "CEKIM" → "ÇEKİM"
    if (parsed.type === "CEKIM") parsed.type = "ÇEKİM";

    // Controller'ın beklediği snake_case alan isimlerini garanti edelim
    const normalized = {
      customer_id: parsed.customer_id,
      type: parsed.type,
      currency: parsed.currency,
      original_amount: parsed.original_amount,
      salesperson_id: parsed.salesperson_id ?? null,
    };

    // İsteğe bağlı gönderilenleri koru
    if (parsed.amount !== undefined) normalized.amount = parsed.amount;
    if (parsed.amount_usd !== undefined) normalized.amount_usd = parsed.amount_usd;

    req.body = normalized;
    next();
  } catch (e) {
    const msg = e?.issues?.[0]?.message || e?.message || "Geçersiz veri";
    return res.status(400).json({ message: msg });
  }
};
