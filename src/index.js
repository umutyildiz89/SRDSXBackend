const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const dotenv = require("dotenv");
dotenv.config();

const { dbHealthCheck } = require("./db");

// Routes (mevcut)
const authRoutes = require("./routes/auth");
const salespersonsRoutes = require("./routes/salespersons");
const customersRoutes = require("./routes/customers");
const transactionsRoutes = require("./routes/transactions");
const reportsRoutes = require("./routes/reports");

// Yeni Routes (RET modülleri)
const retMembersRoutes = require("./routes/retMembers");         // /api/ret-members
const retAssignmentsRoutes = require("./routes/retAssignments"); // /api/ret-assignments

// Middleware
const requireAuth = require("./middleware/requireAuth");
const requireRole = require("./middleware/requireRole"); // rol kontrolü

const app = express();

// --- Cache/ETag kapatma (özellikle /ret-assignments/candidates için faydalı) ---
app.set("etag", false);

// CORS
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
const corsOptions = {
  origin: ALLOWED_ORIGIN,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Cache-Control",
    "Pragma",
    "Expires",
    "X-Requested-With",
    "X-Idempotency-Key",
    "x-idempotency-key"
  ],
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

// Health check
app.get("/api/health", async (req, res) => {
  try {
    const dbOk = await dbHealthCheck();
    return res.status(200).send(dbOk ? "ok" : "db-fail");
  } catch {
    return res.status(500).send("fail");
  }
});

// API Routes (mevcut)
app.use("/api/auth", authRoutes);
app.use("/api/reports", requireAuth, reportsRoutes);
app.use("/api/salespersons", requireAuth, salespersonsRoutes);
app.use("/api/customers", requireAuth, customersRoutes);
app.use("/api/transactions", requireAuth, transactionsRoutes);
app.use(
  '/api/gm',
  requireAuth,
  requireRole(['Genel Müdür', 'GENEL_MUDUR']),
  require('./routes/gm')
);


// Profil (me)
app.get("/api/users/me", requireAuth, (req, res) => {
  const { id, username, role } = req.user || {};
  return res.json({ id, username, role });
});

// ========= RET MODÜLLERİ =========
// Not: Hem TÜRKÇE hem SABİT(UPPERCASE) rol adlarını kabul edelim.

// RET Grubu (RET üyeleri) — Operasyon Müdürü
app.use(
  "/api/ret-members",
  requireAuth,
  requireRole(["Operasyon Müdürü", "OPERASYON_MUDURU"]),
  retMembersRoutes
);

// RET Atama — Genel Müdür
app.use(
  "/api/ret-assignments",
  requireAuth,
  requireRole(["Genel Müdür", "GENEL_MUDUR"]),
  retAssignmentsRoutes
);

// 404
app.use((req, res) => res.status(404).json({ message: "Not Found" }));

// Start
const PORT = Number(process.env.PORT || 5000);
app.listen(PORT, () => {
  console.log(
    `API server running on port ${PORT} (env: ${process.env.NODE_ENV || "development"})`
  );
});
