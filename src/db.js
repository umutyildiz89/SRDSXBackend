// backend/src/db.js
"use strict";

const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
dotenv.config();

const {
  DATABASE_URL,
  DB_HOST,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  DB_SSL,
  DB_POOL_LIMIT,
  DB_CONNECT_TIMEOUT_MS,
  NODE_ENV,
} = process.env;

function mask(s) {
  if (!s) return s;
  const str = String(s);
  if (str.length <= 6) return "***";
  return str.slice(0, 3) + "***" + str.slice(-3);
}

function boolEnv(v, def = true) {
  if (v === undefined || v === null || String(v).trim() === "") return def;
  const s = String(v).toLowerCase();
  return !(s === "0" || s === "false" || s === "no");
}

const poolOptionsCommon = {
  waitForConnections: true,
  connectionLimit: Number(DB_POOL_LIMIT || 10),
  queueLimit: 0,
  connectTimeout: Number(DB_CONNECT_TIMEOUT_MS || 10000),
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};

let pool;

(async () => {
  try {
    if (DATABASE_URL && DATABASE_URL.trim()) {
      // 1) Tek satır URL ile bağlanma
      const url = new URL(DATABASE_URL);
      console.log("[DB] DATABASE_URL kullanılıyor. host =", url.hostname);

      pool = mysql.createPool({
        uri: DATABASE_URL,
        ...poolOptionsCommon,
        // PlanetScale TLS
        ssl: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
      });
    } else {
      // 2) Ayrı env değişkenleri ile bağlanma
      if (!DB_HOST || !DB_USER || !DB_PASSWORD || !DB_NAME) {
        console.error(
          "[DB] Eksik env. Gerekli: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME"
        );
        process.exit(1);
      }

      console.log("[DB] Ayrı env değişkenleri kullanılıyor.");
      console.log("[DB] host =", DB_HOST);
      console.log("[DB] user =", DB_USER);
      console.log("[DB] password =", mask(DB_PASSWORD));
      console.log("[DB] database =", DB_NAME);

      if (DB_HOST === DB_USER) {
        console.warn(
          "[DB] UYARI: DB_HOST ile DB_USER aynı görünüyor. Host yanlış girilmiş olabilir!"
        );
      }

      const useSsl = boolEnv(DB_SSL, true);

      pool = mysql.createPool({
        host: DB_HOST,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        ...poolOptionsCommon,
        ssl: useSsl ? { rejectUnauthorized: true, minVersion: "TLSv1.2" } : undefined,
      });
    }

    // İlk ping / sağlık kontrolü
    const [rows] = await pool.execute("SELECT 1 AS ok");
    if (rows?.[0]?.ok === 1) {
      console.log("[DB] bağlantı OK ✅");
    } else {
      console.warn("[DB] bağlantı şüpheli…");
    }
  } catch (err) {
    console.error("[DB] Bağlantı hatası ❌ ->", {
      code: err.code,
      errno: err.errno,
      sqlState: err.sqlState,
      message: err.message,
    });
    // ENOTFOUND => host hatalı (DNS)
    // ER_ACCESS_DENIED_ERROR => kullanıcı/şifre hatalı
    process.exit(1);
  }
})();

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function dbHealthCheck() {
  try {
    const rows = await query("SELECT 1 AS ok");
    return rows?.[0]?.ok === 1;
  } catch (e) {
    return false;
  }
}

module.exports = { pool, query, dbHealthCheck };
