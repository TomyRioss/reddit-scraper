import OpenAI from 'openai';

let _client: OpenAI | null = null;

export function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENCODE_API_KEY || '';
    const baseURL = process.env.OPENCODE_BASE_URL || 'https://opencode.ai/zen/go/v1';
    _client = new OpenAI({ apiKey, baseURL });
  }
  return _client;
}

export function resetClient(): void { _client = null; }

export interface AnalysisResult {
  summary: string;
  isJobOffer: boolean;
  isFreelance: boolean;
  relevanceScore: number;
  skills: string[];
  budget: string;
  location: string;
  remote: boolean;
  contactInfo: string;
}

export async function analyzePost(
  title: string,
  selftext: string,
  model = 'deepseek-v4-flash'
): Promise<AnalysisResult> {
  const client = getClient();
  const text = `Title: ${title}\nBody: ${(selftext || '').substring(0, 3000)}`;
  const prompt = `Analiza este post de Reddit sobre trabajo freelance en programación/desarrollo.
Extraé la información en formato JSON exacto (sin markdown, solo JSON):
{
  "summary": "resumen corto de 1-2 oraciones en español",
  "isJobOffer": true/false,
  "isFreelance": true/false,
  "relevanceScore": 0-10,
  "skills": ["lista", "de", "habilidades"],
  "budget": "presupuesto o 'No especificado'",
  "location": "ubicación o 'Remoto' o 'No especificada'",
  "remote": true/false,
  "contactInfo": "cómo contactar o 'No especificado'"
}
Post: ${text}`;
  try {
    const response = await client.chat.completions.create({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.1, max_tokens: 500 });
    const content = response.choices?.[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return JSON.parse(content);
  } catch (e: any) {
    return { summary: e.message?.substring(0,200) || 'Error', isJobOffer: false, isFreelance: false, relevanceScore: 0, skills: [], budget: 'No especificado', location: 'No especificada', remote: false, contactInfo: 'No especificado' };
  }
}

export interface OfferRating {
  stars: number;          // 0-5
  explanation: string;
  projectType: string;    // landing_page|web_app|fullstack_app|saas|api|wordpress|mobile|ecommerce|other
  competitionLevel: string; // low|medium|high
  recommendedFor: string[];
  estimatedValue: string;
  tags: string[];
  isAggregator: boolean;  // posts that list many jobs at once (spam)
  isFulltime: boolean;    // full-time employment, not freelance
}

export async function rateOffer(
  title: string,
  selftext: string,
  model = 'deepseek-v4-flash'
): Promise<OfferRating> {
  const client = getClient();
  const text = `Title: ${title}\nBody: ${(selftext || '').substring(0, 2500)}`;

  const prompt = `Eres un experto freelance en programación analizando ofertas de Reddit.
CALIFICA cada oferta según qué tan ATRACTIVA es para un programador freelance que busca proyectos.

REGLAS IMPORTANTES:
- ⭐⭐⭐⭐⭐ (5) = Proyecto COMPLETO y valioso: app full-stack, SaaS, ecommerce, plataforma. Stack moderno. Presupuesto bueno. Poca competencia. Ej: "Build a marketplace platform with Next.js and Stripe"
- ⭐⭐⭐⭐ (4) = Proyecto sólido: app web completa, API compleja. Stack decente. Condiciones claras. Ej: "Full-stack app with React + Node + PostgreSQL"
- ⭐⭐⭐ (3) = Proyecto aceptable: landing page con extras, WordPress custom, web simple. Competencia media. Ej: "Need a website for my business"
- ⭐⭐ (2) = Proyecto genérico de mucha competencia: landing page básica HTML/CSS, WordPress template. Baja paga. Ej: "Landing page HTML CSS"
- ⭐ (1) = Mala oferta: no es freelance, bajo presupuesto, condiciones turbias
- 0 = No es oferta o es basura

CASOS ESPECIALES - PUNTUAR MUY BAJO:
- Posts que listan MUCHAS ofertas juntas tipo "30 Remote Jobs", "50 JavaScript jobs" → 0 ⭐ (agregadores/spam)
- Ofertas de empleo FULL-TIME fijo (no freelance) → 0 ⭐ (buscan empleado, no contractor)
- Ofertas por hora con presupuesto bajísimo → 1 ⭐
- Posts "FOR HIRE" (personas ofreciéndose, no empleadores) → 1 ⭐ (no es oferta)
- Scam o crypto → 0 ⭐

Responde SOLO con JSON SIN MARKDOWN:
{
  "stars": <0-5>,
  "explanation": "por qué esta calificación (1 oración)",
  "projectType": "tipo de proyecto",
  "competitionLevel": "low|medium|high",
  "recommendedFor": ["skill1", "skill2"],
  "estimatedValue": "rango de precio o 'No especificado'",
  "tags": ["tag1", "tag2"],
  "isAggregator": true/false (true si lista multiples ofertas juntas),
  "isFulltime": true/false (true si es empleo fijo, no freelance)
}

Post: ${text}`;

  try {
    const response = await client.chat.completions.create({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: 500 });
    const content = response.choices?.[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return JSON.parse(content);
  } catch {
    return { stars: 0, explanation: 'Error analizando', projectType: 'other', competitionLevel: 'high', recommendedFor: [], estimatedValue: 'No especificado', tags: [], isAggregator: false, isFulltime: false };
  }
}

export async function chatWithAI(
  messages: { role: string; content: string }[],
  systemPrompt: string,
  model = 'deepseek-v4-flash'
): Promise<string> {
  const client = getClient();
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ],
    temperature: 0.3,
    max_tokens: 800,
  });
  return response.choices?.[0]?.message?.content || '';
}
