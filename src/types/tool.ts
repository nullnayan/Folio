export type ToolCategory = 'convert' | 'merge-split' | 'edit-sign' | 'security' | 'images' | 'pages';

export interface PDFTool {
  id: string;
  category: ToolCategory;
  titleEn: string;
  titleHi: string;
  descEn: string;
  descHi: string;
  /** short helper shown inside the wizard, plain words for beginners */
  helpEn: string;
  helpHi: string;
  /** big button label */
  ctaEn: string;
  ctaHi: string;
  icon: string;
  badge?: string;
  popular?: boolean;
  accent: string;
  /** hinglish + hindi + english keywords for offline smart search */
  keywords: string[];
  acceptTypes: ('pdf' | 'image')[];
  multipleFiles?: boolean;
}

export interface CategoryInfo {
  id: ToolCategory;
  titleEn: string;
  titleHi: string;
  descEn: string;
  descHi: string;
  color: string;
  bgColor: string;
  icon: string;
}
