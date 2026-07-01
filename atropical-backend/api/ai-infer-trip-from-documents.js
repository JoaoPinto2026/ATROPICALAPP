// POST /api/ai-infer-trip-from-documents
// Body: { documents: [{ type, title, detail, serviceText }, ...] }
//
// SEGUNDO NÍVEL DE RECURSO — usado quando NÃO existe nenhum documento
// "Programa" completo na reserva. Em vez de ficar sem itinerário, olha
// para todos os documentos já classificados (voos, vouchers de hotel,
// transfers, etc.) e tenta reconstruir o destino e um esboço cronológico
// do itinerário — espelha inferTripFromDocuments() do ficheiro
// atropical-viagem-app.jsx. Fiel apenas ao que os documentos
// efetivamente mostram; nunca inventa atividades turísticas.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
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

  const prompt = `Aqui está uma lista de documentos/vouchers de uma reserva de viagem, sem um programa narrativo completo disponível. Com base sobretudo nos voos (para determinar o destino ou destinos da viagem) e nas datas de estadias em hotéis, transfers e outros vouchers (para reconstruir a cronologia), tenta determinar:

1. O destino da viagem — uma cidade, ou várias separadas por " / " se for uma viagem multi-destino;
2. Um esboço do itinerário dia a dia, em ordem cronológica, com base APENAS no que estes documentos efetivamente revelam — não inventes atividades turísticas, visitas ou refeições que não estejam implícitas nestes documentos. Cada dia deve refletir só a logística que os documentos mostram (voo, check-in/check-out de hotel, transfer, etc.).

Documentos:
${summary}

Responde APENAS com um objeto JSON, sem texto antes ou depois, sem markdown: {"destination": "", "days": [{"id": 1, "city": "", "label": "dia da semana abreviado, ex. 'Seg'", "date": "data curta, ex. '15 Ago'", "title": "título curto do dia", "activities": [{"time": "HH:MM ou vazio", "icon": "plane|car|hotel|food|map", "title": "", "location": "", "note": "frase curta"}]}]}`;

  try {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 3000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!aiRes.ok) {
      return res.status(502).json({ error: `Erro da API Anthropic: ${aiRes.status}` });
    }
    const data = await aiRes.json();
    const text = (data.content ?? [])
      .map((b) => b.text || "")
      .join("")
      .replace(/```json|```/g, "")
      .trim();
    const result = JSON.parse(text);
    if (!result.destination || !Array.isArray(result.days) || result.days.length === 0) {
      return res.status(422).json({ error: "Reconstrução incompleta." });
    }
    return res.status(200).json(result);
  } catch (err) {
    return res.status(502).json({ error: "Erro ao reconstruir o itinerário a partir dos documentos." });
  }
}
