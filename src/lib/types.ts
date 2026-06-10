export interface Subreddit {
  id: number;
  name: string;
  label: string;
  lang: string;
  enabled: number;
  subscribers: number;
  last_scraped: string | null;
}

export interface RedditPost {
  id: string;
  subreddit: string;
  title: string;
  selftext: string;
  url: string;
  author: string;
  score: number;
  num_comments: number;
  created_utc: number;
  is_self: boolean;
  scraped_at: string;
  keywords_matched: string;
  ai_summary: string | null;
  ai_score: number | null;
  relevance: number;
}

export interface Keyword {
  id: number;
  word: string;
  weight: number;
  category: string;
}

export interface AppSettings {
  id: number;
  key: string;
  value: string;
}

export interface ScrapeStats {
  subreddit: string;
  total: number;
  new: number;
  relevant: number;
}

export const DEFAULT_SUBREDDITS: Omit<Subreddit, 'id' | 'last_scraped'>[] = [
  // ★ Principales en español con ofertas
  { name: 'empleos_AR', label: 'Empleos Argentina', lang: 'es', enabled: 1, subscribers: 126251 },
  { name: 'programacion', label: 'Programación (ES)', lang: 'es', enabled: 1, subscribers: 347223 },
  { name: 'devsarg', label: 'Devs Argentina', lang: 'es', enabled: 1, subscribers: 69027 },
  { name: 'desarrolloweb', label: 'Desarrollo Web (ES)', lang: 'es', enabled: 1, subscribers: 3328 },
  { name: 'trabajosremotos', label: 'Trabajos Remotos', lang: 'es', enabled: 1, subscribers: 10312 },
  { name: 'programadores', label: 'Programadores (ES)', lang: 'es', enabled: 1, subscribers: 935 },
  { name: 'empleos', label: 'Empleos (ES)', lang: 'es', enabled: 1, subscribers: 172 },
  { name: 'TicosCoders', label: 'Ticos Coders (CR)', lang: 'es', enabled: 1, subscribers: 107 },
  { name: 'FreelanceDevUy', label: 'Freelance Dev Uruguay', lang: 'es', enabled: 1, subscribers: 157 },
  
  // ★ En inglés con ofertas freelance confirmadas
  { name: 'forhire', label: 'For Hire', lang: 'en', enabled: 1, subscribers: 635476 },
  { name: 'remotejs', label: 'Remote JS', lang: 'en', enabled: 1, subscribers: 46715 },
  { name: 'freelance_forhire', label: 'Freelance For Hire', lang: 'en', enabled: 1, subscribers: 454852 },
  { name: 'devjobs', label: 'Dev Jobs', lang: 'en', enabled: 1, subscribers: 8591 },
  { name: 'freelance', label: 'Freelance', lang: 'en', enabled: 1, subscribers: 677994 },
  { name: 'WorkOnline', label: 'Work Online', lang: 'en', enabled: 1, subscribers: 746757 },
  { name: 'RemoteJobs', label: 'Remote Jobs', lang: 'en', enabled: 1, subscribers: 513564 },
  { name: 'webdev', label: 'Web Dev', lang: 'en', enabled: 1, subscribers: 3262729 },
];

export const DEFAULT_KEYWORDS_ES: Omit<Keyword, 'id'>[] = [
  { word: 'freelance', weight: 10, category: 'tipo' },
  { word: 'contrato', weight: 8, category: 'tipo' },
  { word: 'proyecto', weight: 8, category: 'tipo' },
  { word: 'remoto', weight: 7, category: 'modalidad' },
  { word: 'part-time', weight: 5, category: 'modalidad' },
  { word: 'temporario', weight: 5, category: 'modalidad' },
  { word: 'programador', weight: 9, category: 'rol' },
  { word: 'desarrollador', weight: 9, category: 'rol' },
  { word: 'developer', weight: 9, category: 'rol' },
  { word: 'web', weight: 7, category: 'area' },
  { word: 'frontend', weight: 8, category: 'area' },
  { word: 'backend', weight: 8, category: 'area' },
  { word: 'fullstack', weight: 8, category: 'area' },
  { word: 'full stack', weight: 8, category: 'area' },
  { word: 'react', weight: 8, category: 'stack' },
  { word: 'node', weight: 8, category: 'stack' },
  { word: 'python', weight: 7, category: 'stack' },
  { word: 'javascript', weight: 7, category: 'stack' },
  { word: 'typescript', weight: 7, category: 'stack' },
  { word: 'php', weight: 5, category: 'stack' },
  { word: 'sql', weight: 5, category: 'stack' },
  { word: 'api', weight: 6, category: 'area' },
  { word: 'app', weight: 6, category: 'area' },
  { word: 'website', weight: 6, category: 'area' },
  { word: 'página', weight: 6, category: 'area' },
  { word: 'wordpress', weight: 4, category: 'stack' },
  { word: 'busco', weight: 8, category: 'intencion' },
  { word: 'necesito', weight: 8, category: 'intencion' },
  { word: 'contratar', weight: 9, category: 'intencion' },
  { word: 'hiring', weight: 9, category: 'intencion' },
  { word: 'se busca', weight: 8, category: 'intencion' },
  { word: 'oferta', weight: 8, category: 'intencion' },
  { word: 'trabajo', weight: 7, category: 'intencion' },
  { word: 'empleo', weight: 7, category: 'intencion' },
  { word: 'pago', weight: 6, category: 'compensacion' },
  { word: 'presupuesto', weight: 6, category: 'compensacion' },
  { word: 'dólar', weight: 5, category: 'compensacion' },
  { word: 'usd', weight: 5, category: 'compensacion' },
  { word: 'pesos', weight: 3, category: 'compensacion' },
];

export const DEFAULT_KEYWORDS_EN: Omit<Keyword, 'id'>[] = [
  { word: 'freelance', weight: 10, category: 'type' },
  { word: 'contract', weight: 8, category: 'type' },
  { word: 'project', weight: 7, category: 'type' },
  { word: 'remote', weight: 7, category: 'type' },
  { word: 'developer', weight: 9, category: 'role' },
  { word: 'programmer', weight: 9, category: 'role' },
  { word: 'engineer', weight: 8, category: 'role' },
  { word: 'frontend', weight: 8, category: 'area' },
  { word: 'backend', weight: 8, category: 'area' },
  { word: 'full-stack', weight: 8, category: 'area' },
  { word: 'fullstack', weight: 8, category: 'area' },
  { word: 'react', weight: 8, category: 'stack' },
  { word: 'node.js', weight: 8, category: 'stack' },
  { word: 'nodejs', weight: 8, category: 'stack' },
  { word: 'python', weight: 7, category: 'stack' },
  { word: 'javascript', weight: 7, category: 'stack' },
  { word: 'typescript', weight: 7, category: 'stack' },
  { word: 'api', weight: 6, category: 'area' },
  { word: 'web', weight: 6, category: 'area' },
  { word: 'hiring', weight: 9, category: 'intent' },
  { word: 'looking for', weight: 8, category: 'intent' },
  { word: 'need', weight: 7, category: 'intent' },
  { word: 'position', weight: 6, category: 'intent' },
  { word: 'opportunity', weight: 5, category: 'intent' },
  { word: 'budget', weight: 6, category: 'comp' },
  { word: 'pay', weight: 6, category: 'comp' },
  { word: 'hourly', weight: 5, category: 'comp' },
  { word: 'fixed', weight: 5, category: 'comp' },
];
