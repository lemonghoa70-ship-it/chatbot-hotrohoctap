export type FeedbackMode = 'hint' | 'detail';

export interface Card1Ocr {
  problem: string;
  steps: string[];
}

export interface Card2Correct {
  highlights: string[];
}

export interface Card3Error {
  has_error: boolean;
  line: string;
  category: string;
  explanation: string;
}

export interface Card4Guidance {
  mode: FeedbackMode;
  hint_content: string;
  detailed_solution: string;
}

export interface AnalysisResult {
  card1_ocr: Card1Ocr;
  card2_correct: Card2Correct;
  card3_error?: Card3Error | null;
  card4_guidance: Card4Guidance;
  suggested_model_upgrade?: boolean;
  upgrade_reason?: string;
  userNote?: string;
  grade?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface AgentKnowledgeFiles {
  skillOcr: string;
  skillPhanTich: string;
  persona: string;
  agentConfig: string;
}
