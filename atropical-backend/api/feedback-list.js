// GET /api/feedback-list?secret=XXXX
//
// Lista todos os feedbacks guardados, do mais recente para o mais antigo.
// Protegido por uma chave secreta simples (variável de ambiente
// FEEDBACK_SECRET) — só a equipa da A Tropical deve saber esta chave.

import { Redis } from
