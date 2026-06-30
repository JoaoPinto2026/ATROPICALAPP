// GET /api/trip?code=XXXX
//
// AVISO: este endpoint NÃO verifica o nome do passageiro — só confirma que
// o código de reserva existe. As apps (web/nativa) já NÃO usam isto para
// o login do cliente; usam /api/login, que verifica também o nome antes
// de devolver qualquer dado. Mantém-se aqui apenas como utilidade interna
// (ex. para a equipa consultar uma reserva), não para uso público direto.

import { fetchAndMapTrip } from "../lib/optitravel";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { code } = req.query;
  if (!code) {
    return res.status(400).json({ error: "Falta o parâmetro 'code' (código de reserva)." });
  }

  try {
    const trip = await fetchAndMapTrip(code);
    return res.status(200).json(trip);
  } catch (err) {
    if (err.message === "OPTITRAVEL_NOT_CONFIGURED") {
      return res.status(500).json({ error: "Servidor sem credenciais Optitravel configuradas." });
    }
    return res.status(502).json({ error: "Erro ao contactar a Optitravel." });
  }
}
