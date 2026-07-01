// POST /api/feedback
// Body: { tripName, reservaCode, passengerName, rating, comment }
//
// Guarda o feedback do cliente no Upstash Redis (base de dados gratuita
// ligada ao projeto na Vercel). Cada feedback fica guardado com a
// data/hora, o nome da viagem, o nome do
