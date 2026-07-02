// POST /api/feedback
// Body: { tripName, reservaCode, passengerName, rating, comment, consentMarketing }

import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { tripName, reservaCode, passengerName, rating, comment, consentMarketing } = req.body ?? {};
  if (!tripName || !rating) {
    return res.status(400).json({ error: "Falta tripName ou rating." });
  }

  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tripName,
    reservaCode: reservaCode ?? "",
    passengerName: passengerName ?? "",
    rating,
    comment: comment ?? "",
    consentMarketing: consentMarketing === true,
    createdAt: new Date().toISOString(),
  };

  try {
    await redis.set(`feedback:${entry.id}`, JSON.stringify(entry));
    await redis.lpush("feedback:index", entry.id);
    return res.status(200).json({ ok: true, id: entry.id });
  } catch (err) {
    console.error("feedback: erro ao guardar no Redis", err);
    return res.status(502).json({ error: "Erro ao guardar o feedback." });
  }
}
