# A Tropical — Backend da App de Viagem

Este é o servidor que falta para a app deixar de ser um protótipo e passar a
produto real. A app React (o ficheiro `atropical-viagem-app.jsx`) deixa de
chamar a Optitravel e a Anthropic diretamente — passa a chamar este
servidor, que guarda as chaves em segurança e nunca as expõe ao telemóvel
do cliente.

## Porque é que isto é necessário

Hoje, dentro do Claude, a app consegue chamar `api.anthropic.com`
diretamente porque o Claude oferece essa ponte especial só dentro dos seus
artefactos. Fora do Claude (num site publicado a sério), isso **não
funciona** — chamadas diretas à Anthropic precisam de uma chave de API, e
essa chave nunca pode ficar visível no código que corre no browser do
cliente. O mesmo se aplica à Optitravel: o token de acesso não pode estar
no código React.

Este servidor resolve isso: fica no meio, com as chaves guardadas em
variáveis de ambiente (nunca no código), e a app só fala com ele.

```
Cliente (telemóvel)  →  Este servidor  →  Optitravel / Anthropic
                         (chaves aqui,
                          nunca no telemóvel)
```

## Estrutura

```
/api
  trip.js              GET  /api/trip?code=XXXX
                        Procura a reserva na Optitravel pelo código e
                        devolve já no formato que a app espera.

  ai-guide.js           POST /api/ai-guide
                        { city, whenLabel } → sugestões de cultura/
                        gastronomia/museus/eventos via IA + pesquisa web.

  ai-classify-voucher.js POST /api/ai-classify-voucher
                        { fileUrl, serviceText } → lê o PDF do voucher e
                        identifica o tipo de serviço (Alojamento,
                        Transfer, Rent-a-Car, Seguro, Programa, Outro).

  ai-itinerary-from-pdf.js POST /api/ai-itinerary-from-pdf
                        { fileUrl } → lê o PDF do programa completo e
                        devolve o itinerário dia-a-dia estruturado.

.env.example            Modelo das variáveis de ambiente necessárias.
package.json
```

## Como publicar (Vercel — caminho mais simples)

1. Cria conta em [vercel.com](https://vercel.com) (gratuito para começar)
2. Instala a CLI: `npm i -g vercel`
3. Dentro desta pasta, corre `vercel` e segue as instruções
4. Em **Settings → Environment Variables** no painel da Vercel, adiciona as
   variáveis listadas em `.env.example`, com os valores reais
5. A Vercel dá-te um endereço (ex. `atropical-backend.vercel.app`) — é a
   esse endereço que a app React vai passar a chamar

## O que falta fazer na app React (`atropical-viagem-app.jsx`)

Quando este servidor estiver no ar, substitui nestes 4 sítios o destino das
chamadas (procura por `https://api.anthropic.com` e pelo `fetch` da
Optitravel no ficheiro):

| Hoje (dentro do Claude)                          | Passa a ser                                  |
|---------------------------------------------------|-----------------------------------------------|
| `fetch("https://api.anthropic.com/v1/messages")` em `fetchGuideFromAI`            | `fetch("https://o-teu-dominio.vercel.app/api/ai-guide", { method: "POST", body: JSON.stringify({ city, whenLabel }) })` |
| `fetch("https://api.anthropic.com/v1/messages")` em `classifyVoucherWithAI`       | `fetch(".../api/ai-classify-voucher", { method: "POST", body: JSON.stringify({ fileUrl, serviceText }) })` |
| `fetch("https://api.anthropic.com/v1/messages")` em `generateItineraryFromProgramPDF` | `fetch(".../api/ai-itinerary-from-pdf", { method: "POST", body: JSON.stringify({ fileUrl }) })` |
| `fetch(CONFIG.API_BASE_URL + ...)` em `fetchTripFromOptitravel`                   | `fetch(".../api/trip?code=" + CONFIG.RESERVA_ID)` |

Volto a ajudar nessa troca quando este backend estiver mesmo publicado —
mais vale fazer isso com o endereço real em mãos.

## Pendente (depende da resposta da Optitravel)

- `api/trip.js` tem um TODO no sítio exato onde os nomes dos campos da
  Optitravel têm de ser confirmados/ajustados.
