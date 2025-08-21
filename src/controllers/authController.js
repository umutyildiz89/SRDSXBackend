const jwt = require("jsonwebtoken");
const { z } = require("zod");
const userService = require("../services/userService");

const loginSchema = z.object({
  username: z.string().min(1, "username zorunlu"),
  password: z.string().min(1, "password zorunlu"),
});

async function login(req, res) {
  try {
    const body = loginSchema.parse(req.body);

    // Kullanıcı doğrulama (DB içinde verifyUser hata fırlatırsa catch'e düşer)
    const user = await userService.verifyUser(body.username.trim(), body.password);
    if (!user) {
      return res.status(401).json({ message: "Geçersiz giriş" });
    }

    // Zorunlu ENV kontrolü — eksikse anlamlı 500
    if (!process.env.JWT_SECRET) {
      console.error("[AUTH] JWT_SECRET tanımlı değil!");
      return res.status(500).json({ message: "Sunucu yapılandırma hatası (JWT_SECRET)" });
    }

    // Token üret
    const payload = { sub: user.id, username: user.username, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "8h" });

    // Frontend role'i ayrıca istiyor → response'a ekliyoruz (imza bozulmadan)
    return res.status(200).json({
      token,
      role: user.role,
      username: user.username,
    });
  } catch (e) {
    // Zod validation error
    if (e?.issues) {
      return res.status(400).json({ message: e.issues?.[0]?.message || "Geçersiz veri" });
    }
    // Diğer hataları görünür yap (sadece dev log)
    console.error("[AUTH] login error:", e && (e.stack || e.message || e));
    return res.status(500).json({ message: e?.message || "Sunucu hatası" });
  }
}

module.exports = { login };
