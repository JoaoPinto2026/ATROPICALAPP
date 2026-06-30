// POST /api/login
// Body: { reservaCode, name }
//
// SUBSTITUI a verificação que antes corria só no telemóvel do cliente.
// Esta é agora a ÚNICA forma de obter os dados da viagem: o código de
// reserva E o nome do passageiro são verificados aqui, do lado do
// servidor, contra os dados reais da Optitravel — e só se ambos
// corresponderem é que a reserva é devolvida. Sem isto, alguém podia abrir
// as ferramentas de programador do browser e contornar a verificação.
//
// Por segurança, a mensagem de erro é sempre a mesma genérica ("Dados
// inseridos incorretos"), quer o problema seja o código, o nome, ou a
// reserva não existir — para não dar pistas a quem tente adivinhar.

import { fetchAndMapTrip, nameMatchesPassengerList } from "../lib/optitravel";

const GENERIC_ERROR = "Dados inseridos incorretos.";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { reservaCode, name } = req.body ?? {};
  if (!reservaCode || !name) {
    return res.status(400).json({ error: GENERIC_ERROR });
  }

  try {
    const trip = await fetchAndMapTrip(reservaCode);

    const codeMatches = (trip.reservaCode ?? "").toUpperCase() === String(reservaCode).trim().toUpperCase();
    const nameMatches = nameMatchesPassengerList(name, trip.passengers);

    if (!codeMatches || !nameMatches) {
      return res.status(401).json({ error: GENERIC_ERROR });
    }

    return res.status(200).json(trip);
  } catch (err) {
    return res.status(401).json({ error: GENERIC_ERROR, reason: err.message });
  }
}
