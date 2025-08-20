"use strict";

const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
dotenv.config();

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  // PlanetScale için TLS
  ssl: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_LIMIT || 10),
  queueLimit: 0,
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000), // 10s
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function dbHealthCheck() {
  try {
    const rows = await query("SELECT 1 AS ok");
    return rows?.[0]?.ok === 1;
  } catch {
    return false;
  }
}

module.exports = { pool, query, dbHealthCheck };
