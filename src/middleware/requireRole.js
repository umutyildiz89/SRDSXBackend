// backend/src/middleware/requireRole.js
function normalizeRole(input) {
  if (!input) return "";
  // Trim + büyük harf + boşluk->altçizgi
  let r = String(input).trim().toUpperCase().replace(/\s+/g, "_");
  // Türkçe karakterleri sadeleştir
  r = r
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ş/g, "S")
    .replace(/İ/g, "I")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C");

  // Yaygın varyasyonları tek tipe indir
  if (r === "GENEL_MUDUR" || r === "GENEL_MUDÜR") r = "GENEL_MUDUR";
  if (r === "OPERASYON_MUDURU" || r === "OPERASYON_MÜDÜRÜ") r = "OPERASYON_MUDURU";

  return r;
}

module.exports = function requireRole(allowedRoles = []) {
  // Tek string gelirse diziye çevir
  const list = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const allowedSet = new Set(list.map(normalizeRole));

  return function (req, res, next) {
    const raw = req.user?.role;
    if (!raw) return res.status(403).json({ message: "Rol yok" });

    const role = normalizeRole(raw);
    // İzin listesi boşsa ([]) herkes geçer; doluysa kontrol et
    if (allowedSet.size && !allowedSet.has(role)) {
      return res.status(403).json({ message: "Yetki yok" });
    }

    // İstersen ileride kullanmak için normalize edilmiş rolü ekleyebilirsin
    req.userRoleNormalized = role;
    next();
  };
};

// Test/yeniden kullanım için export
module.exports.normalizeRole = normalizeRole;
