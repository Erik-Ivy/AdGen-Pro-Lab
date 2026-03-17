
export enum FileType {
  IMAGE = 'image',
  VIDEO = 'video',
  IMAGE_TO_VIDEO = 'image_to_video',
  TARGETED_IMAGE = 'targeted_image',
  BATCH_AD_ANALYSIS = 'batch_ad_analysis',
  LANDING_PAGE_ANALYSIS = 'landing_page_analysis',
  AVATAR_ANALYSIS = 'avatar_analysis'
}

export type VideoMode = 'hook' | 'story';

export interface ImageAdVariation {
  headline: string;
  body: string;
  cta: string;
  imageUrl: string;
  performanceScore?: number;
  previousVersion?: ImageAdVariation;
}

export interface VideoAdVariation {
  title: string;
  videoUrl?: string;
  audioUrl?: string;
  script?: string;
  summary?: string;
  jsonInstructions?: string;
  duration?: string;
  characterDescription?: string;
  videoStyle?: string;
  performanceScore?: number;
}

export interface CreativeBlueprint {
  id: string;
  title: string;
  angle: string;
  psychology: string;
  visualHook: string;
  copy: string;
  cta: string;
  searchInsights?: string;
}

export interface AvatarAnalysis {
  personaTitle: string;
  quote: string;
  demographics: string;
  psychographics: string;
  painPoints: string[];
  fears: string[];
  internalMonologue: string;
  whyTheyClicked: string;
}

export type AdVariation = ImageAdVariation | VideoAdVariation;

export interface HighlightCoordinates {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

export const isImageAdVariation = (variation: AdVariation): variation is ImageAdVariation => {
  return (variation as ImageAdVariation).imageUrl !== undefined;
};

export const isVideoAdVariation = (variation: AdVariation): variation is VideoAdVariation => {
  return (variation as VideoAdVariation).summary !== undefined || (variation as VideoAdVariation).videoUrl !== undefined;
}
