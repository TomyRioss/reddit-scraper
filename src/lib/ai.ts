import OpenAI from 'openai';

let _client: OpenAI | null = null;

export function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENCODE_API_KEY || 'sk-fqAFJGclVktPVKuJfIxSnKaYtfSWXkyyTLJSqL7RkreWcDbaIbn23lPi2cB3tCoI';
    const baseURL = process.env.OPENCODE_BASE_URL || 'https://opencode.ai/zen/go/v1';

    _client = new OpenAI({
      apiKey,
      baseURL,
    });
  }
  return _client;
}

export function resetClient(): void {
  _client = null;
}

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
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(content);
  } catch (e: any) {
    const errMsg = e.message || 'Unknown error';
    console.warn('AI analysis failed:', errMsg);
    return {
      summary: errMsg.substring(0, 200),
      isJobOffer: false,
      isFreelance: false,
      relevanceScore: 0,
      skills: [],
      budget: 'No especificado',
      location: 'No especificada',
      remote: false,
      contactInfo: 'No especificado',
    };
  }
}
