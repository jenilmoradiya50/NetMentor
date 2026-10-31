export type CardType = 'basic' | 'cloze' | 'fill_in_blank';
export type CardReviewStatus = 'new' | 'learning' | 'review' | 'mastered';

export interface CardProgress {
  status: CardReviewStatus;
  confidenceScore: number;
  reviewCount: number;
  lastReviewedAt?: string | null;
  nextReviewAt?: string | null;
}

export interface FlashcardItem {
  id: string;
  deckId: string;
  userId: string;
  cardType: CardType;
  frontMarkdown: string;
  backMarkdown: string;
  clozeData?: Record<string, any> | null;
  tags: string[];
  orderIndex: number;
  progress?: CardProgress | null;
  createdAt?: string;
}

export interface FlashcardDeck {
  id: string;
  userId: string;
  sourceType: string;
  sourceName: string;
  sourceHash: string;
  deckName: string;
  title: string;
  description: string | null;
  cardCount: number;
  studiedCount?: number;
  masteredCount?: number;
  learningCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeckImportPreview {
  deckName: string;
  title: string;
  description: string;
  sourceHash: string;
  cardCount: number;
  noteCount: number;
  sampleCards: FlashcardItem[];
  warnings: string[];
  mediaCount: number;
  alreadyImported?: boolean;
  existingDeckId?: string;
}

export interface CatalogLab {
  id: string;
  day: number;
  filename: string;
  title: string;
  downloadUrl: string;
}

export interface CatalogDeck {
  id: string;
  day: number;
  filename: string;
  title: string;
  cleanTitle: string;
  category: string;
  downloadUrl: string;
  labs: CatalogLab[];
}
