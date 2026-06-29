// GET /api/trip?code=XXXX
//
// Procura a reserva na Optitravel pelo código de reserva (o número do
// file/processo) e devolve já no formato que a app React espera. A chave
// de acesso (OPTITRAVEL_API_TOKEN) fica só aqui no servidor — nunca é
// enviada ao telemóvel do cliente.

function normalizeOptitravelCategory(rawCategory) {
  const s = (rawCategory || "").toLowerCase();
  if (/avi[aã]o|flight|e-?ticket/.test(s)) return "Voo";
  if (/comboio|train/.test(s)) return "Comboio";
  return null;
}

function classifyServiceText(text) {
  const s = (text || "").toLowerCase();
  if (!s.trim()) return null;
  if (/\b([a-z]{3}\s+){1,4}[a-z]{3}\b.*\d{1,2}\s?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/i.test(s)) {
    return { category: "Voo", title: text.trim() };
  }
  if (/estadia|hotel|alojamento|hospedagem/.test(s)) return { category: "Alojamento", title: text.trim() };
  if (/transfer|traslado/.test(s)) return { category: "Transfer", title: text.trim() };
  if (/rent.?a.?car|aluguer.*(viatura|carro|autom[oó]vel)/.test(s)) return { category: "Rent-a-Car", title: text.trim() };
  if (/seguro|apolice|apólice/.test(s)) return { category: "Seguro", title: text.trim() };
  if (/comboio|train|shinkansen/.test(s)) return { category: "Comboio", title: text.trim() };
  return null;
}

function mapOptitravelResponse(json) {
  return {
    destination: json.destino ?? json.destination ?? "Destino",
    country: json.pais ?? json.country ?? "",
    dates: json.datas ?? json.dates ?? "",
    flight: json.voo ?? json.flight ?? "",
    days: (json.itinerario ?? json.days ?? []).map((d, i) => ({
      id: d.id ?? i + 1,
      city: d.cidade ?? d.city ?? "",
      label: d.diaSemana ?? d.label ?? "",
      date: d.data ?? d.date ?? "",
      title: d.titulo ?? d.title ?? "",
      activities: (d.atividades ?? d.activities ?? []).map((a) => ({
        time: a.hora ?? a.time ?? "",
        icon: a.icone ?? a.icon ?? "map",
        title: a.titulo ?? a.title ?? "",
        location: a.local ?? a.location ?? "",
        note: a.nota ?? a.note ?? "",
      })),
    })),
    documents: (json.documentos ?? json.documents ?? []).map((doc) => {
      const rawCategory = doc.tipo ?? doc.categoria ?? doc.type ?? "";
      const knownType = normalizeOptitravelCategory(rawCategory);
      const serviceText = doc.servico ?? doc.descricaoServico ?? doc.servicoDescricao ?? "";
      const fileUrl = doc.ficheiroUrl ?? doc.fileUrl ?? null;
      const fromService = knownType ? null : classifyServiceText(serviceText);

      return {
        type: knownType ?? (fileUrl ? "Voucher" : fromService?.category ?? "Voucher"),
        needsClassification: knownType === null && !!fileUrl,
        serviceText,
        title: doc.titulo ?? doc.title ?? (!fileUrl ? fromService?.title : "") ?? "",
        code: doc.codigo ?? doc.code ?? "",
        detail: doc.detalhe ?? doc.detail ?? "",
        icon: doc.icone ?? doc.icon ?? "map",
        fileUrl,
      };
    }),
    reservaCode: json.reserva?.codigo ?? json.codigoReserva ?? "",
    passengers: (json.passageiros ?? json.passengers ?? [])
      .map((p) => (typeof p === "string" ? p : p.nome ?? p.name ?? ""))
      .filter(Boolean),
    support: {
      isGroupTrip: json.reserva?.viagemEmGrupo ?? json.suporte?.viagemEmGrupo ?? false,
      agentName: json.reserva?.criadoPor?.nome ?? json.reserva?.agente?.nome ?? json.suporte?.consultorNome ?? "",
      agentRole: json.suporte?.consultorCargo ?? "O seu consultor A Tropical",
      agentPhone: json.reserva?.criadoPor?.telefone ?? json.reserva?.agente?.telefone ?? json.suporte?.consultorTelefone ?? "",
      agentEmail: json.reserva?.criadoPor?.email ?? json.reserva?.agente?.email ?? json.suporte?.consultorEmail ?? "",
      tourLeaderName: json.suporte?.tourLeaderNome ?? "",
      tourLeaderRole: json.suporte?.tourLeaderCargo ?? "Tour Leader em viagem",
      tourLeaderPhone: json.suporte?.tourLeaderTelefone ?? "",
    },
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { code } = req.query;
  if (!code) {
    return res.status(400).json({ error: "Falta o parâmetro 'code' (código de reserva)." });
  }

  const baseUrl = process.env.OPTITRAVEL_API_BASE_URL;
  const token = process.env.OPTITRAVEL_API_TOKEN;
  if (!baseUrl || !token) {
    return res.status(500).json({ error: "Servidor sem credenciais Optitravel configuradas." });
  }

  try {
    const optiRes = await fetch(`${baseUrl}/reservas/${encodeURIComponent(code)}`, {
      headers: { Authorization: token, Accept: "application/json" },
    });
    if (!optiRes.ok) {
      return res.status(optiRes.status).json({ error: `Erro da Optitravel: ${optiRes.status}` });
    }
    const json = await optiRes.json();
    return res.status(200).json(mapOptitravelResponse(json));
  } catch (err) {
    return res.status(502).json({ error: "Erro ao contactar a Optitravel." });
  }
}
