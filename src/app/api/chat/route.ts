import { getPosts, initDb } from '@/lib/db';
import { chatWithAI } from '@/lib/ai';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  await initDb();
  const { messages } = await req.json();

  // Fetch current offers for context
  const offers = await getPosts({ unreadOnly: false, limit: 30 });

  const offersContext = offers.map((o: any) =>
    `[${o.relevance}pts] r/${o.subreddit}: ${o.title} | skills: ${o.keywords_matched}`
  ).join('\n');

  const systemPrompt = `Eres un asistente experto en analizar ofertas freelance de programación.
Tenés acceso a estas ofertas actuales de Reddit:

${offersContext}

Ayudá al usuario a encontrar las mejores oportunidades. Podés:
- Recomendar las mejores ofertas según sus skills
- Filtrar por tipo de proyecto, stack, presupuesto
- Explicar por qué una oferta es mejor que otra
- Dar consejos sobre cómo aplicar a cada oferta

Sé conciso y directo. Respondé en español.`;

  try {
    const reply = await chatWithAI(messages, systemPrompt);
    return NextResponse.json({ reply });
  } catch (e: any) {
    return NextResponse.json({ reply: `Error: ${e.message}` }, { status: 500 });
  }
}
