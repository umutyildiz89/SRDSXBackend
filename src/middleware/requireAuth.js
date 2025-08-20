const jwt = require("jsonwebtoken");

module.exports = function requireAuth(req, res, next) {
  try {
    const header = req.headers["authorization"] || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Yetkisiz" });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, username: payload.username, role: payload.role };
    next();
  } catch (e) {
    return res.status(401).json({ message: "Token geçersiz veya süresi dolmuş" });
  }
};
