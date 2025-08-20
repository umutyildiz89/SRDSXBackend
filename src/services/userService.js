// Şimdilik in-memory kullanıcılar (ileride USERS tablosu ile değiştireceğiz)
const users = [
  { id: 1, username: "op_manager", password: "123456", role: "OPERASYON_MUDURU" },
  { id: 2, username: "gm_manager", password: "123456", role: "GENEL_MUDUR" }
];

async function verifyUser(username, password) {
  const u = users.find((x) => x.username === username && x.password === password);
  return u || null;
}

module.exports = { verifyUser };
