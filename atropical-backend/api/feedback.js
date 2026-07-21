// POST /api/feedback
// Body: { tripName, reservaCode, passengerName, rating, comment, consentMarketing }
import { Redis } from "@upstash/redis";
import { Resend } from "resend";

const redis = Redis.fromEnv();
const resend = new Resend(process.env.RESEND_API_KEY);

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
  } catch (err) {
    console.error("feedback: erro ao guardar no Redis", err);
    return res.status(502).json({ error: "Erro ao guardar o feedback." });
  }

  // Envio de email — falha aqui não deve bloquear a resposta ao cliente,
  // já que o feedback já ficou guardado no Redis com sucesso
  try {
    await resend.emails.send({
      from: "Feedback A Tropical <feedback@feedbacks.atropical.pt>",
      to: "marketing@turitropical.com",
      subject: `Novo feedback — ${tripName} (${rating}★)`,
      html: `
        <h2>Novo feedback recebido</h2>
        <p><strong>Viagem:</strong> ${escapeHtml(tripName)}</p>
        <p><strong>Código de reserva:</strong> ${escapeHtml(entry.reservaCode) || "—"}</p>
        <p><strong>Passageiro:</strong> ${escapeHtml(entry.passengerName) || "—"}</p>
        <p><strong>Avaliação:</strong> ${rating} / 5</p>
        <p><strong>Comentário:</strong><br>${escapeHtml(entry.comment) || "(sem comentário)"}</p>
        <p><strong>Consentimento marketing:</strong> ${entry.consentMarketing ? "Sim" : "Não"}</p>
        <p style="color:#888; font-size:12px;">Recebido em ${new Date(entry.createdAt).toLocaleString("pt-PT")}</p>
      `,
    });
  } catch (err) {
    console.error("feedback: erro ao enviar email", err);
    // não retorna erro ao cliente — o feedback já está guardado
  }

  return res.status(200).json({ ok: true, id: entry.id });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
