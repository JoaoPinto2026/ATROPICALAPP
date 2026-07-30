// GET /api/booking?id={bookingId}
// Vai buscar a reserva completa à Optitravel e extrai info do tour leader via IA

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const OPTITRAVEL_BASE_URL = process.env.OPTITRAVEL_BASE_URL; // staging ou produção
const OPTITRAVEL_TOKEN = process.env.OPTITRAVEL_TOKEN;

const TOUR_LEADER_SYSTEM_PROMPT = `Vais receber o texto de Observações/Alertas de um file de viagem.
A tua tarefa é detetar se o texto menciona um Tour Leader (guia/acompanhante
da viagem) atribuído, e extrair o nome e contacto telefónico, se existirem.

Responde APENAS com um objeto JSON válido, sem texto adicional, neste formato exato:
{
  "hasTourLeader": boolean,
  "tourLeaderName": string ou null,
  "tourLeaderPhone": string ou null
}

Regras:
- Se não houver qualquer menção a tour leader, guia ou acompanhante, hasTourLeader deve ser false e os outros campos null.
- O telefone deve ser normalizado para formato internacional E.164 quando possível (ex: +351912345678). Se não for possível determinar o indicativo do país, assume Portugal (+351).
- Ignora números que sejam claramente de outro contexto (ex: telefone do cliente, do hotel).
- Se o nome for mencionado mas não o telefone, ou vice-versa, extrai o que houver e deixa o outro campo null.`;

async function extractTourLeader(observacoes) {
  const empty = { hasTourLeader: false, tourLeaderName: null, tourLeaderPhone: null };
  if (!observacoes || observacoes.trim() === "") return empty;

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: TOUR_LEADER_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: `Texto das Observações:\n"""\n${observacoes}\n"""` },
      ],
    });
    const text = message.content[0].text.trim();
    return JSON.parse(text);
  } catch (err) {
    console.error("booking: erro ao extrair tour leader via IA", err);
    return empty; // fallback seguro
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { id } = req.query;
  if (!id) {
    return res.status(400).json({ error: "Falta o parâmetro id (bookingId)." });
  }

  try {
    const optiResponse = await fetch(`${OPTITRAVEL_BASE_URL}/bookings/${id}`, {
      headers: { Authorization: `Bearer ${OPTITRAVEL_TOKEN}` },
    });

    if (!optiResponse.ok) {
      return res.status(optiResponse.status).json({ error: "Erro ao obter reserva da Optitravel." });
    }

    const booking = await optiResponse.json();
    const observacoes = booking.observacoes ?? booking.notes ?? ""; // ajustar consoante o nome real do campo devolvido

    const tourLeaderInfo = await extractTourLeader(observacoes);

    return res.status(200).json({
      ...booking,
      ...tourLeaderInfo,
    });
  } catch (err) {
    console.error("booking: erro geral", err);
    return res.status(502).json({ error: "Erro ao processar o pedido." });
  }
}
