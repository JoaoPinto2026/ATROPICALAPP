// POST /api/ai-classify-voucher
// Body: { fileUrl, serviceText }
//
// Lê o PDF de um voucher e identifica a que serviço se refere — espelha
// classifyVoucherWithAI() do ficheiro atropical-viagem-app.jsx, com a
// chave da Anthropic guardada só aqui no servidor.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { fileUrl, serviceText } = req.body ?? {};
  if (!fileUrl) {
    return res.status(400).json({ error: "Falta 'fileUrl' no corpo do pedido." });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Servidor sem ANTHROPIC_API_KEY configurada." });
  }

  try {
    const pdfRes = await fetch(fileUrl);
    if (!pdfRes.ok) throw new Error(`Erro ao obter o PDF: ${pdfRes.status}`);
    const arrayBuffer = await pdfRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const supplementHint = serviceText
      ? `\n\nComo apoio complementar, eis o texto do serviço associado a este documento no sistema da agência: "${serviceText}". Usa isto APENAS para completar informação que esteja em falta ou pouco clara no PDF (ex. datas, nome do local) — a informação do PDF é sempre a fonte principal e tem prioridade sobre este texto sempre que houver conflito.`
      : "";

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
              {
                type: "text",
                text: `Este é um documento de viagem anexado a uma reserva. Lê o conteúdo e identifica o que é. Se for um PROGRAMA COMPLETO da viagem (descrição dia a dia de vários dias, com atividades/visitas — não apenas um único serviço), classifica como "Programa". Se for o voucher de um único serviço, classifica-o normalmente.${supplementHint} Responde APENAS com um objeto JSON, sem texto antes ou depois, sem markdown: {"category": "Programa|Alojamento|Transfer|Rent-a-Car|Seguro|Outro", "title": "título curto e claro em português de Portugal, ex. 'Voucher Hotel XPTO' ou 'Programa da Viagem'", "detail": "uma frase curta com o essencial — datas, local ou referência — em português de Portugal"}`,
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
    return res.status(200).json(JSON.parse(text));
  } catch (err) {
    return res.status(502).json({ error: "Erro ao classificar o documento." });
  }
}
