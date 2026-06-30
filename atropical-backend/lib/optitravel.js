// Lógica partilhada entre /api/trip.js e /api/login.js — não é uma rota em
// si (está fora da pasta /api), só código reutilizado pelas duas.

export function normalizeOptitravelCategory(rawCategory) {
  const s = (rawCategory || "").toLowerCase();
  if (/avi[aã]o|flight|e-?ticket/.test(s)) return "Voo";
  if (/comboio|train/.test(s)) return "Comboio";
  return null;
}

export function classifyServiceText(text) {
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

export function mapOptitravelResponse(json) {
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

export async function fetchAndMapTrip(reservaCode) {
  const baseUrl = process.env.OPTITRAVEL_API_BASE_URL;
  const token = process.env.OPTITRAVEL_API_TOKEN;
  if (!baseUrl || !token) {
    throw new Error("OPTITRAVEL_NOT_CONFIGURED");
  }
  const res = await fetch(`${baseUrl}/reservas/${encodeURIComponent(reservaCode)}`, {
    headers: { Authorization: token, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`OPTITRAVEL_ERROR_${res.status}`);
  const json = await res.json();
  return mapOptitravelResponse(json);
}

export function normalizeForMatch(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function nameMatchesPassengerList(enteredName, passengers) {
  if (!passengers || passengers.length === 0) return true;
  const enteredWords = normalizeForMatch(enteredName).split(/\s+/).filter(Boolean);
  if (enteredWords.length === 0) return false;
  return passengers.some((p) => {
    const passengerNorm = normalizeForMatch(p);
    return enteredWords.every((w) => passengerNorm.includes(w));
  });
}
