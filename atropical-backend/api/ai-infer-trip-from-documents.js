// POST /api/ai-infer-trip-from-documents
// Body: { documents: [{ type, title, detail, serviceText }, ...] }
//
// SEGUNDO NÍVEL DE RECURSO — usado quando NÃO existe nenhum documento
// "Programa" completo na reserva. Em vez de ficar sem itinerário, olha
// para todos os documentos já classificados (voos, vouchers de hotel,
// transfers, etc.) e tenta reconstruir o destino e um esboço cronológico
// do itinerário. Fiel apenas ao que os documentos efetivamente mostram;
// nunca inventa atividades turísticas.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { documents } = req.body ?? {};
  if (!Array.isArray(documents) || documents.length === 0) {
    return res.status(400).json({ error: "Falta 'documents' no corpo do pedido." });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Servidor sem ANTHROPIC_API_KEY configurada." });
  }

  const summary = documents
    .filter((d) => d.title || d.detail || d.serviceText)
    .map((d, i) => `Documento ${i + 1}: tipo=${d.type}; título=${d.title || "—"}; detalhe=${d.detail || "—"}; texto do serviço=${d.serviceText || "—"}`)
    .join("\n");

  if (!summary.trim()) {
    return res.status(422).json({ error: "Sem documentos suficientes para reconstruir o itinerário." });
  }

  const prompt =
