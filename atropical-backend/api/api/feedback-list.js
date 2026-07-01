// GET /api/feedback-list?secret=XXXX
//
// Lista todos os feedbacks guardados, do mais recente para o mais antigo.
// Protegido por uma chave secreta simples (variável de ambiente
// FEEDBACK_SECRET) — só a equipa da A Tropical deve saber esta chave.

import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const secret = process.env.FEEDBACK_SECRET;
  if (secret && req.query.secret !== secret) {
    return res.status(401).json({ error: "Acesso não autorizado." });
  }

  try {
    const ids = await redis.lrange("feedback:index", 0, 199);
    if (!ids || ids.length === 0) {
      return res.status(200).json([]);
    }

    const entries = await Promise.all(
      ids.map(async (id) => {
        const raw = await redis.get(`feedback:${id}`);
        return raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null;
      })
    );

    return res.status(200).json(entries.filter(Boolean));
  } catch (err) {
    console.error("feedback-list: erro ao ler do Redis", err);
    return res.status(502).json({ error: "Erro ao ler os feedbacks." });
  }
}
