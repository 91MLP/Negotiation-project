export type CrushScript =
  | 'kindergarten-tantrum'
  | 'dramatic-movie-trailer'
  | 'boomer-facebook-post'
  | 'fortune-cookie-wisdom'
  | 'emoji-overload'
  | 'medieval-proclamation'

export interface CrushScriptOption {
  id: CrushScript
  label: string
  emoji: string
  description: string
}

export const CRUSH_SCRIPTS: CrushScriptOption[] = [
  { id: 'kindergarten-tantrum', label: 'Kindergarten Tantrum', emoji: '👶', description: 'Rewrite as a 5-year-old\'s whiny complaint' },
  { id: 'dramatic-movie-trailer', label: 'Dramatic Movie Trailer', emoji: '🎬', description: 'Turn into an over-the-top blockbuster voiceover' },
  { id: 'boomer-facebook-post', label: 'Boomer Facebook Post', emoji: '📱', description: 'Translate to ALL CAPS boomer outrage' },
  { id: 'fortune-cookie-wisdom', label: 'Fortune Cookie Wisdom', emoji: '🥠', description: 'Condense into vague fortune cookie advice' },
  { id: 'emoji-overload', label: 'Emoji Overload', emoji: '🤪', description: 'Replace every word with chaotic emojis' },
  { id: 'medieval-proclamation', label: 'Medieval Proclamation', emoji: '🏰', description: 'Rewrite as a pompous royal decree' },
]

export const PRESET_TAGS = [
  'Work Pressure',
  'Social Comparison',
  'Housing Anxiety',
  'Imposter Syndrome',
  'Relationship Stress',
  'Financial Worry',
  'Health Anxiety',
  'Future Uncertainty',
]

export interface AnxietyTag {
  id: string
  user_id: string
  name: string
  created_at: string
}

export interface AnxietyCrush {
  id: string
  comment_id: string
  user_id: string
  script_name: CrushScript
  crushed_content: string
  created_at: string
}

export interface AnxietyComment {
  id: string
  session_id: string
  user_id: string
  content: string
  position: number
  created_at: string
  crushes?: AnxietyCrush[]
}

export interface AnxietySession {
  id: string
  user_id: string
  tag_names: string[]
  created_at: string
  comments?: AnxietyComment[]
}

export interface GetTagsResponse {
  tags: AnxietyTag[]
}

export interface CreateTagRequest {
  name: string
}

export interface CreateTagResponse {
  tag: AnxietyTag
}

export interface GetSessionsResponse {
  sessions: AnxietySession[]
  total_sessions: number
}

export type GenerateLanguage = 'en' | 'zh'

export interface CreateSessionRequest {
  tag_names: string[]
  language?: GenerateLanguage
}

export interface TranslateRequest {
  texts: string[]
}

export interface TranslateResponse {
  translations: string[]
}

export interface CommentTranslation {
  original?: string
  crushed?: string
}

export interface CreateSessionResponse {
  session: AnxietySession
}

export interface GetSessionDetailResponse {
  session: AnxietySession
}

export interface CrushCommentRequest {
  script_name: CrushScript
}

export interface CrushCommentResponse {
  crush: AnxietyCrush
}
