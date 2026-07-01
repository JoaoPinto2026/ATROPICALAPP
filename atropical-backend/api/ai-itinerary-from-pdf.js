// POST /api/ai-itinerary-from-pdf
// Body: { fileUrl }
//
// Lê o PDF completo do programa de viagem e devolve o itinerário dia a dia
// estruturado — espelha generateItineraryFromProgramPDF() do ficheiro
// atropical-viagem-app.jsx, com a chave da Anthropic guardada só aqui no
// servidor.
//
// REGRA CRÍTICA mantida: só incluir refeições num dia se o programa as
// identificar claramente nesse dia — nunca distribuir/inventar a partir de
// um total agregado.

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

  const { fileUrl } = req.body ?? {};
  if (!fileUrl) {
    return res.status(400).json({ error: "Falta 'fileUrl' no corpo do pedido." });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Servidor sem ANTHROPIC_API_KEY configurada." });
  }

  try {
    const pdfRes = await fetch(fileUrl);
    if (!pdfRes.ok) throw new Error(`Erro ao obter o PDF do programa: ${pdfRes.status}`);
    const arrayBuffer = await pdfRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
              {
                type: "text",
                text: `Este é o programa completo de uma viagem. Lê-o com atenção e estrutura-o dia a dia, em português de Portugal, com fidelidade total ao texto original — não inventes nem acrescentes atividades, locais, refeições ou notas que não estejam explicitamente no documento.

Regra crítica sobre refeições: só inclui uma refeição (almoço/jantar) num dia se o programa a identificar claramente NESSE dia específico. Se o documento só indicar um total agregado de refeições (ex. "7 almoços + 6 jantares") sem dizer em que dias, NÃO distribuas nem inventes refeições por dia — simplesmente não incluas nenhuma atividade de refeição.

Responde APENAS com um array JSON, sem texto antes ou depois, sem markdown, no formato: [{"id": 1, "city": "nome da cidade nesse dia", "label": "dia da semana abreviado, ex. 'Seg'", "date": "data curta, ex. '15 Ago'", "title": "título curto do dia", "activities": [{"time": "HH:MM ou vazio", "icon": "plane|car|hotel|food|map", "title": "", "location": "", "note": "frase curta"}]}]`,
              },
            ],
          },
        ],
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
    const days = JSON.parse(text);
    if (!Array.isArray(days) || days.length === 0) throw new Error("Itinerário vazio");
    return res.status(200).json(days);
  } catch (err) {
    return res.status(502).json({ error: "Erro ao gerar o itinerário a partir do PDF." });
  }
}
