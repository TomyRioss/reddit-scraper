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
  "isJobOffer": true/false (si es una oferta de trabajo real, no una pregunta o discusión),
  "isFreelance": true/false (si es freelance/contrato/proyecto, no empleo full-time),
  "relevanceScore": 0-10 (qué tan relevante es para un programador freelance),
  "skills": ["lista", "de", "habilidades", "requeridas"],
  "budget": "presupuesto mencionado o 'No especificado'",
  "location": "ubicación o 'Remoto' o 'No especificada'",
  "remote": true/false,
  "contactInfo": "cómo contactar o 'No especificado'"
}

Post:
${text}`;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 500,
    });
    const content = response.choices?.[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return JSON.parse(content);
  } catch (e: any) {
    const errMsg = e.message || 'Unknown error';
    console.warn('AI analysis failed:', errMsg);
    return {
      summary: errMsg.substring(0, 200),
      isJobOffer: false, isFreelance: false, relevanceScore: 0,
      skills: [], budget: 'No especificado', location: 'No especificada',
      remote: false, contactInfo: 'No especificado',
    };
  }
}

export interface OfferRating {
  stars: number;          // 0-5
  explanation: string;     // why this rating
  projectType: string;     // landing_page, fullstack_app, saas, api, wordpress, etc
  competitionLevel: string; // low, medium, high
  recommendedFor: string[]; // skills of freelancer who should apply
  estimatedValue: string;   // estimated project value range
  tags: string[];           // relevant tags
}

export async function rateOffer(
  title: string,
  selftext: string,
  model = 'deepseek-v4-flash'
): Promise<OfferRating> {
  const client = getClient();
  const text = `Title: ${title}\nBody: ${(selftext || '').substring(0, 2500)}`;

  const prompt = `Eres un experto en encontrar las mejores ofertas freelance de programación.
Analiza este post de Reddit y CALIFICALO según qué tan atractivo es para un programador freelance.

REGLAS DE PUNTUACIÓN:
- 5 ⭐ = Oportunidad excelente: proyecto complejo (full-stack, SaaS, app completa), presupuesto bueno, poca competencia
- 4 ⭐ = Muy buena: stack moderno (Next.js, React, Node, Python), freelance real, condiciones claras
- 3 ⭐ = Buena: proyecto decente pero genérico o con mucha competencia
- 2 ⭐ = Regular: proyecto pequeño/genérico (landing page, WordPress), mucha competencia, baja paga
- 1 ⭐ = Mala: no es oferta real, es spam, o pide trabajo gratuito
- 0 ⭐ = Inútil: no es una oferta de trabajo

Responde SOLO con JSON, sin markdown:
{
  "stars": <0-5>,
  "explanation": "explicación breve de por qué esta calificación",
  "projectType": "tipo de proyecto (landing_page|web_app|fullstack_app|saas|api|wordpress|mobile|other)",
  "competitionLevel": "low|medium|high",
  "recommendedFor": ["skill1", "skill2"],
  "estimatedValue": "rango de precio estimado o 'No especificado'",
  "tags": ["tag1", "tag2"]
}

Post: ${text}`;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 400,
    });
    const content = response.choices?.[0]?.message?.content || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return JSON.parse(content);
  } catch (e: any) {
    return {
      stars: 0, explanation: 'Error analizando', projectType: 'other',
      competitionLevel: 'high', recommendedFor: [], estimatedValue: 'No especificado', tags: [],
    };
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
