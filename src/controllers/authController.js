const jwt = require("jsonwebtoken");
const { z } = require("zod");
const userService = require("../services/userService");

const loginSchema = z.object({
  username: z.string().min(1, "username zorunlu"),
  password: z.string().min(1, "password zorunlu")
});

async function login(req, res) {
  try {
    const body = loginSchema.parse(req.body);
    const user = await userService.verifyUser(body.username, body.password);
    if (!user) return res.status(401).json({ message: "Geçersiz giriş" });

    const token = jwt.sign(
      { sub: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.status(200).json({ token });
  } catch (e) {
    if (e?.issues) {
      return res.status(400).json({ message: e.issues?.[0]?.message || "Geçersiz veri" });
    }
    return res.status(500).json({ message: e?.message || "Sunucu hatası" });
  }
}

module.exports = { login };
