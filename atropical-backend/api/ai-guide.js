// POST /api/ai-guide
// Body: { city, whenLabel }
//
// Pesquisa na web e sugere atividades culturais, gastronómicas, museus e
// eventos para a cidade/dia indicados — espelha fetchGuideFromAI() do
// ficheiro atropical-viagem-app.jsx, mas com a chave da Anthropic guardada
// só aqui no servidor.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { city, whenLabel } = req.body ?? {};
  if (!city) {
    return res.status(400).json({ error: "Falta 'city' no corpo do pedido." });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Servidor sem ANTHROPIC_API_KEY configurada." });
  }

  const prompt = `És um especialista em viagens da agência A Tropical. Pesquisa na web e sugere até 6 ideias atualmente relevantes para um cliente em ${city}, no dia ${whenLabel}: atividades culturais, experiências gastronómicas, exposições de museus, e eventos que estejam mesmo a decorrer nessa data.

Na categoria gastronomia, dá prioridade a restaurantes com estrela(s) Michelin em ${city} (verifica no Guia Michelin oficial, guide.michelin.com, quais têm efetivamente estrela nessa cidade — nunca presumas). Se ${city} não tiver restaurantes com estrela Michelin, ou já tiveres esgotado essas opções, sugere outras experiências gastronómicas credíveis da zona.

Para cada sugestão, inclui uma fonte real e credível que tenhas efetivamente encontrado na pesquisa (nunca inventes uma ligação) — usa preferencialmente sites oficiais e públicos, sem necessidade de qualquer chave de acesso, por esta ordem de preferência (válida para qualquer cidade ou país, não só para este destino):
1. Para restaurantes com estrela Michelin: a página oficial desse restaurante no guide.michelin.com;
2. Site oficial de turismo da cidade, região ou país de destino (o organismo oficial de turismo correspondente);
3. Site oficial do próprio local, museu, restaurante ou evento;
4. Wikipédia, como último recurso.
Evita plataformas comerciais como TripAdvisor, Tabelog ou Google Maps. Se não encontrares nenhuma fonte fiável para um item em concreto, usa "source": null e "sourceName": null — não preenchas com um valor inventado.

Responde APENAS com um array JSON, sem texto antes ou depois, sem markdown. Cada item: {"name": "", "category": "cultura|gastronomia|museus|eventos", "note": "frase curta em português de Portugal, até 22 palavras (refere o número de estrelas Michelin se aplicável)", "rating": número de 1 a 5 ou null, "window": "datas/horário curto, ou null", "source": "URL real encontrada na pesquisa, ou null", "sourceName": "nome curto do site, ex. Guia Michelin, ou null"}.`;

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
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      }),
    });
    if (!aiRes.ok) {
      const errBody = await aiRes.text().catch(() => "");
      console.error("ai-guide: erro da API Anthropic", aiRes.status, errBody);
      return res.status(502).json({ error: `Erro da API Anthropic: ${aiRes.status}` });
    }
    const data = await aiRes.json();
    const text = (data.content ?? [])
      .map((b) => b.text || "")
      .join("\n")
      .replace(/```json|```/g, "")
      .trim();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      console.error("ai-guide: falha a interpretar JSON da IA. Texto recebido:", text);
      throw parseErr;
    }
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Resposta vazia");
    return res.status(200).json(parsed);
  } catch (err) {
    console.error("ai-guide: erro inesperado", err);
    return res.status(502).json({ error: "Erro ao processar a resposta da IA." });
  }
}
