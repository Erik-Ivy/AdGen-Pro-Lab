
import React, { useState, useMemo } from 'react';
import { AdVariation, FileType, isImageAdVariation, isVideoAdVariation, VideoAdVariation } from '../types';
import { DownloadIcon, TargetIcon, SparklesIcon } from './icons';
import { regenerateSceneVisuals } from '../services/geminiService';

interface AdVariationsDisplayProps {
  originalFilePreviews: string[];
  fileType: FileType;
  variations: AdVariation[];
  onImageClick: (imageUrl: string) => void;
  onDownloadSingle: (variation: AdVariation, index: number) => void;
  onRefine?: (variation: AdVariation, index: number) => void;
  onBranch?: (variation: AdVariation, index: number) => void;
  onRevert?: (variation: AdVariation, index: number) => void;
  onUpdateVariation: (index: number, variation: AdVariation) => void;
  namingTemplate?: string;
  userPrompt?: string;
  aggroLevel?: number;
  similarityLevel?: number;
  sourceIsVideo?: boolean;
  onGenerateVideo: (jsonInstructions: string, aspectRatio: '16:9' | '9:16', onProgress: (progress: string) => void) => Promise<string>;
  onProgress: (progress: string) => void;
}

interface VariationCardProps {
    variation: AdVariation;
    index: number;
    fileType: FileType;
    onImageClick: (imageUrl: string) => void;
    onDownloadSingle: (variation: AdVariation, index: number) => void;
    onRefine?: (variation: AdVariation, index: number) => void;
    onBranch?: (variation: AdVariation, index: number) => void;
    onRevert?: (variation: AdVariation, index: number) => void;
    onUpdateVariation: (index: number, variation: AdVariation) => void;
    onGenerateVideo: (jsonInstructions: string, aspectRatio: '16:9' | '9:16', onProgress: (progress: string) => void) => Promise<string>;
    onProgress: (progress: string) => void;
}

const EditIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
);

const ScoreBadge: React.FC<{ score?: number }> = ({ score }) => {
    if (score === undefined) return null;
    
    let colorClass = 'bg-slate-100 text-slate-600 border-slate-200';
    if (score >= 8.5) colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    else if (score >= 7.0) colorClass = 'bg-amber-50 text-amber-700 border-amber-200';
    else if (score < 5.0) colorClass = 'bg-red-50 text-red-700 border-red-200';

    return (
        <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl border-2 ${colorClass} shadow-sm`}>
            <span className="text-xs font-black leading-none">{score}</span>
            <span className="text-[8px] font-bold uppercase tracking-tight opacity-70">Score</span>
        </div>
    );
};

const CopyButton: React.FC<{ text: string, label?: string }> = ({ text, label = "Copy" }) => {
    const [copied, setCopied] = useState(false);
    
    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button 
            onClick={handleCopy} 
            className={`text-[10px] uppercase font-black tracking-widest px-3 py-1.5 rounded-lg border transition-all ${copied ? 'bg-green-50 text-green-600 border-green-200' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-700'}`}
        >
            {copied ? "Copied!" : label}
        </button>
    );
};

const VariationCard: React.FC<VariationCardProps> = ({ variation, index, fileType, onImageClick, onDownloadSingle, onRefine, onBranch, onRevert, onUpdateVariation, onGenerateVideo, onProgress }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedScenes, setEditedScenes] = useState<any[]>([]);
  const [editedSummary, setEditedSummary] = useState("");
  const [editedCharacter, setEditedCharacter] = useState("");
  const [editedStyle, setEditedStyle] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [videoGenerationProgress, setVideoGenerationProgress] = useState('');
  
  const isVideoHookTool = fileType === FileType.VIDEO;
  
  // Split mode state: null (off), 8 (8 seconds), 15 (15 seconds)
  const [splitMode, setSplitMode] = useState<number | null>(null);
  const [copiedChunks, setCopiedChunks] = useState<Set<number>>(new Set());

  const handleEditClick = () => {
    if (!isVideoAdVariation(variation) || !variation.jsonInstructions) return;
    try {
      const parsed = JSON.parse(variation.jsonInstructions);
      const scenes = Array.isArray(parsed) ? parsed : (parsed.scenes || []);
      // Ensure duration exists and is a number
      const normalizedScenes = scenes.map((s: any) => ({
          ...s,
          duration: typeof s.duration === 'number' ? s.duration : (parseFloat(s.duration) || 3)
      }));
      setEditedScenes(normalizedScenes);
      setEditedSummary(variation.summary || "");
      setEditedCharacter(variation.characterDescription || "");
      setEditedStyle(variation.videoStyle || "");
      setIsEditing(true);
    } catch (e) {
      console.error("Failed to parse JSON instructions", e);
    }
  };

  const estimateDuration = (text: string): number => {
    const wordCount = text.trim().split(/\s+/).length;
    // Avg speaking rate ~150 wpm = 2.5 words/sec
    // Min 2 seconds per scene
    if (!text.trim()) return 3;
    return Math.max(2, Math.ceil(wordCount / 2.5));
  };

  const handleSceneScriptChange = (sceneIndex: number, newScript: string) => {
    const newScenes = [...editedScenes];
    const duration = estimateDuration(newScript);
    newScenes[sceneIndex] = { ...newScenes[sceneIndex], script: newScript, duration };
    setEditedScenes(newScenes);
  };

  const handleSceneVisualChange = (sceneIndex: number, newVisual: string) => {
    const newScenes = [...editedScenes];
    newScenes[sceneIndex] = { ...newScenes[sceneIndex], visual: newVisual };
    setEditedScenes(newScenes);
  };

  const handleSceneDurationChange = (sceneIndex: number, newDuration: string) => {
    const val = parseFloat(newDuration);
    const newScenes = [...editedScenes];
    newScenes[sceneIndex] = { ...newScenes[sceneIndex], duration: isNaN(val) ? 0 : val };
    setEditedScenes(newScenes);
  };

  const handleSave = async () => {
    if (!isVideoAdVariation(variation)) return;
    setIsSaving(true);
    
    try {
        // Automatically regenerate scene visuals based on new context and scripts
        const updatedScenes = await regenerateSceneVisuals(
            editedScenes, 
            editedSummary, 
            editedCharacter, 
            editedStyle
        );

        // Inject context metadata and use the rewritten visuals
        const finalScenes = updatedScenes.map((scene: any) => ({
            ...scene,
            character_context: editedCharacter,
            style_context: editedStyle,
            strategic_angle: editedSummary
        }));

        const newScript = finalScenes.map((s: any) => s.script).join(' ');
        const newJsonInstructions = JSON.stringify({
            audio_mix: "strong_clear_dialogue_foreground",
            audio_directive: "Use strong, clear, high-volume voice audio with well-balanced dialogue that sits prominently in the mix.",
            scenes: finalScenes
        });
        const totalDuration = finalScenes.reduce((acc: number, s: any) => acc + (parseFloat(s.duration) || 0), 0);
        
        const updatedVariation = { 
            ...variation, 
            script: newScript, 
            summary: editedSummary,
            characterDescription: editedCharacter,
            videoStyle: editedStyle,
            jsonInstructions: newJsonInstructions,
            duration: `${totalDuration.toFixed(1)}s` 
        };
        
        onUpdateVariation(index, updatedVariation);
        setIsEditing(false);
    } catch (e) {
        console.error("Auto-rewrite failed during save, falling back to manual edits", e);
        // Fallback: save without regenerating visuals if API fails
        const fallbackScenes = editedScenes.map(scene => ({
            ...scene,
            character_context: editedCharacter,
            style_context: editedStyle,
            strategic_angle: editedSummary
        }));

        const newScript = fallbackScenes.map(s => s.script).join(' ');
        const newJsonInstructions = JSON.stringify({
            audio_mix: "strong_clear_dialogue_foreground",
            audio_directive: "Use strong, clear, high-volume voice audio with well-balanced dialogue that sits prominently in the mix.",
            scenes: fallbackScenes
        });
        const totalDuration = fallbackScenes.reduce((acc, s) => acc + (parseFloat(s.duration) || 0), 0);

        const updatedVariation = { 
            ...variation, 
            script: newScript, 
            summary: editedSummary,
            characterDescription: editedCharacter,
            videoStyle: editedStyle,
            jsonInstructions: newJsonInstructions,
            duration: `${totalDuration.toFixed(1)}s` 
        };
        onUpdateVariation(index, updatedVariation);
        setIsEditing(false);
    } finally {
        setIsSaving(false);
    }
  };

  const handleCopyPrompt = () => {
    if (!isVideoAdVariation(variation) || !variation.jsonInstructions) return;
    try {
        const parsed = JSON.parse(variation.jsonInstructions);
        const scenes = Array.isArray(parsed) ? parsed : (parsed.scenes || []);
        const promptObject = {
            title: isVideoHookTool ? undefined : variation.title,
            strategic_angle: variation.summary,
            character: variation.characterDescription,
            style: variation.videoStyle,
            duration: variation.duration,
            script: variation.script,
            audio_mix: Array.isArray(parsed) ? "strong_clear_dialogue_foreground" : (parsed.audio_mix || "strong_clear_dialogue_foreground"),
            audio_directive: Array.isArray(parsed) ? "Use strong, clear, high-volume voice audio with well-balanced dialogue that sits prominently in the mix." : (parsed.audio_directive || "Use strong, clear, high-volume voice audio with well-balanced dialogue that sits prominently in the mix."),
            scenes: scenes
        };
        navigator.clipboard.writeText(JSON.stringify(promptObject, null, 2));
    } catch (e) {
        navigator.clipboard.writeText(variation.jsonInstructions);
    }
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

    const handleGenerateVideoClick = async () => {
        if (!isVideoAdVariation(variation) || !variation.jsonInstructions) return;

        setIsGeneratingVideo(true);
        setGeneratedVideoUrl(null);
        setVideoGenerationProgress('');
        try {
            const videoUrl = await onGenerateVideo(
                variation.jsonInstructions,
                '9:16', // Fixed aspect ratio as per user request
                setVideoGenerationProgress
            );
            setGeneratedVideoUrl(videoUrl);
        } catch (error: any) {
            console.error("Video generation failed:", error);
            setVideoGenerationProgress(`Error: ${error.message}`);
        } finally {
            setIsGeneratingVideo(false);
        }
    };

  const instructionChunks = useMemo(() => {
    if (!isVideoAdVariation(variation) || !variation.jsonInstructions || !splitMode) return [];
    try {
        const parsed = JSON.parse(variation.jsonInstructions);
        const scenes = Array.isArray(parsed) ? parsed : (parsed.scenes || []);
        const chunks: any[][] = [];
        let currentChunk: any[] = [];
        let currentDuration = 0;
        
        // Helper to split a scene
        const splitScene = (scene: any, duration1: number) => {
            const totalDur = parseFloat(scene.duration) || 3;
            const ratio = Math.min(1, Math.max(0, duration1 / totalDur));
            
            const script = scene.script || "";
            // Split script by words roughly
            const words = script.split(' ');
            const splitIdx = Math.floor(words.length * ratio);
            
            const s1Script = words.slice(0, splitIdx).join(' ');
            const s2Script = words.slice(splitIdx).join(' ');
            
            const s1 = { ...scene, duration: duration1, script: s1Script };
            const s2 = { ...scene, duration: totalDur - duration1, script: s2Script };
            return [s1, s2];
        };

        const queue = [...scenes];
        
        while (queue.length > 0) {
            const scene = queue.shift();
            const sceneDur = parseFloat(scene.duration) || 3;
            const spaceLeft = splitMode - currentDuration;
            
            // If scene fits or space is negligible, add it
            if (sceneDur <= spaceLeft + 0.1) {
                currentChunk.push(scene);
                currentDuration += sceneDur;
            } else {
                // Scene doesn't fit.
                // If we have significant space left (>1s), fill it by splitting
                if (spaceLeft > 1.0) {
                    const [s1, s2] = splitScene(scene, spaceLeft);
                    currentChunk.push(s1);
                    chunks.push(currentChunk);
                    
                    // Reset for next chunk
                    currentChunk = [];
                    currentDuration = 0;
                    
                    // Process the remainder (s2) next
                    queue.unshift(s2);
                } else {
                    // Space too small, close current chunk and retry scene in new chunk
                    if (currentChunk.length > 0) chunks.push(currentChunk);
                    currentChunk = [];
                    currentDuration = 0;
                    queue.unshift(scene);
                }
            }
            
            // If chunk is full (within tolerance), push it
            if (currentDuration >= splitMode - 0.1) {
                if (currentChunk.length > 0) {
                    chunks.push(currentChunk);
                    currentChunk = [];
                    currentDuration = 0;
                }
            }
        }
        
        if (currentChunk.length > 0) chunks.push(currentChunk);
        
        return chunks;
    } catch (e) {
        console.error("Split error", e);
        return [];
    }
  }, [variation, splitMode]);

  const handleCopyChunk = (chunkIndex: number, chunk: any[]) => {
    if (!isVideoAdVariation(variation)) return;
    
    let audioMix = "strong_clear_dialogue_foreground";
    let audioDirective = "Use strong, clear, high-volume voice audio with well-balanced dialogue that sits prominently in the mix.";
    
    try {
        const parsed = JSON.parse(variation.jsonInstructions || '{}');
        if (!Array.isArray(parsed)) {
            audioMix = parsed.audio_mix || audioMix;
            audioDirective = parsed.audio_directive || audioDirective;
        }
    } catch (e) {}

    const promptObject = {
        title: isVideoHookTool ? undefined : `${variation.title} (Part ${chunkIndex + 1}/${instructionChunks.length})`,
        strategic_angle: variation.summary,
        character: variation.characterDescription,
        style: variation.videoStyle,
        script: chunk.map(s => s.script).join(' '),
        audio_mix: audioMix,
        audio_directive: audioDirective,
        scenes: chunk
    };
    navigator.clipboard.writeText(JSON.stringify(promptObject, null, 2));
    
    setCopiedChunks(prev => {
        const next = new Set(prev);
        next.add(chunkIndex);
        return next;
    });
    
    setTimeout(() => {
        setCopiedChunks(prev => {
            const next = new Set(prev);
            next.delete(chunkIndex);
            return next;
        });
    }, 2000);
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 hover:shadow-2xl hover:border-brand-primary/50 transition-all duration-500 animate-slide-in-up flex flex-col overflow-hidden h-full group/card" style={{ animationDelay: `${index * 50}ms` }}>
      {isImageAdVariation(variation) && (
        <div className="relative group cursor-pointer overflow-hidden bg-slate-100 flex-shrink-0" onClick={() => onImageClick(variation.imageUrl)}>
            <img 
                src={variation.imageUrl} 
                alt={`Variation ${index + 1}`} 
                className="w-full h-auto object-cover transform group-hover:scale-105 transition-transform duration-700" 
            />
            <div className="absolute top-4 right-4 z-20">
                <ScoreBadge score={variation.performanceScore} />
            </div>
            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
                <p className="text-white text-sm font-black uppercase tracking-widest px-6 py-3 border-2 border-white rounded-full">Expand View</p>
            </div>
        </div>
      )}
      {isVideoAdVariation(variation) && variation.videoUrl && (
        <video src={variation.videoUrl} controls muted loop playsInline preload="metadata" className="w-full bg-slate-100 flex-shrink-0" />
      )}
      
      <div className="p-8 flex flex-col flex-grow bg-white relative">
        <div className="flex items-center justify-between mb-6">
            <span className="bg-slate-900 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter">Variation #{index + 1}</span>
            
            <div className="flex items-center gap-2">
                 {isVideoAdVariation(variation) && (
                    <>
                        {variation.duration && !isEditing && (
                             <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                                {variation.duration}
                            </span>
                        )}
                        {variation.jsonInstructions && !isEditing && (
                            <button 
                                onClick={handleEditClick} 
                                className="text-[10px] uppercase font-black tracking-widest px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-brand-primary flex items-center gap-2 transition-colors shadow-sm"
                            >
                                <EditIcon className="w-3 h-3" /> Edit
                            </button>
                        )}
                        <div className="transform scale-90 sm:scale-100">
                            <ScoreBadge score={variation.performanceScore} />
                        </div>
                    </>
                 )}
            </div>
        </div>
        
        <div className="flex-grow space-y-4">
            {isImageAdVariation(variation) ? (
            <>
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Headline</p>
                    <p className="text-lg font-black text-slate-900 leading-tight">"{variation.headline}"</p>
                </div>
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Strategy & Logic</p>
                    <p className="text-sm text-slate-600 leading-relaxed line-clamp-4">{variation.body}</p>
                </div>
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Conversion CTA</p>
                    <p className="text-brand-primary font-black uppercase text-sm tracking-tight">{variation.cta}</p>
                </div>
            </>
            ) : isVideoAdVariation(variation) ? (
            <>
                {!isVideoHookTool && (
                    <div>
                        <div className="flex justify-between items-baseline mb-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Concept Title</p>
                        </div>
                        <p className="text-lg font-black text-slate-900 leading-tight">{variation.title}</p>
                    </div>
                )}
                
                {!isEditing ? (
                    <div className="space-y-3 mt-2">
                        {variation.summary && (
                            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Strategic Angle</p>
                                <p className="text-sm text-slate-700 leading-relaxed">{variation.summary}</p>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                            {variation.characterDescription && (
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Character</p>
                                    <p className="text-[11px] text-slate-600 leading-tight font-medium">{variation.characterDescription}</p>
                                </div>
                            )}
                            {variation.videoStyle && (
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Video Style</p>
                                    <p className="text-[11px] text-slate-600 leading-tight font-medium">{variation.videoStyle}</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Strategic Angle</p>
                            <textarea 
                                className="w-full p-3 text-sm bg-white/80 border border-indigo-200 rounded-lg text-slate-700 outline-none focus:ring-1 focus:ring-brand-primary focus:bg-white transition-colors resize-none"
                                rows={5}
                                value={editedSummary}
                                onChange={(e) => setEditedSummary(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Character Traits</p>
                                <textarea 
                                    className="w-full p-2 text-[11px] bg-white border border-slate-200 rounded text-slate-700 outline-none focus:ring-1 focus:ring-brand-primary transition-colors resize-none"
                                    rows={5}
                                    value={editedCharacter}
                                    onChange={(e) => setEditedCharacter(e.target.value)}
                                    placeholder="Ethnicity, gender, age, style..."
                                />
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Video Style</p>
                                <textarea 
                                    className="w-full p-2 text-[11px] bg-white border border-slate-200 rounded text-slate-700 outline-none focus:ring-1 focus:ring-brand-primary transition-colors resize-none"
                                    rows={5}
                                    value={editedStyle}
                                    onChange={(e) => setEditedStyle(e.target.value)}
                                    placeholder="UGC, Selfie, Motion, Lighting..."
                                />
                            </div>
                        </div>

                        <div className="max-h-[500px] overflow-y-auto custom-scrollbar pr-2 space-y-4">
                            <div className="flex justify-between items-center sticky top-0 bg-white py-2 z-10 border-b border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scenes & Script</p>
                                <div className="flex items-center gap-2">
                                     <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                        Total: {editedScenes.reduce((acc, s) => acc + (parseFloat(s.duration) || 0), 0).toFixed(1)}s
                                     </span>
                                </div>
                            </div>
                            {editedScenes.map((scene, i) => (
                                <div key={i} className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scene {scene.scene}</span>
                                        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-1 shadow-sm">
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">Secs</span>
                                            <input 
                                                type="number" 
                                                min="0.5" 
                                                step="0.5"
                                                className="w-10 text-right text-[10px] font-bold text-slate-700 outline-none focus:text-brand-primary bg-transparent"
                                                value={scene.duration}
                                                onChange={(e) => handleSceneDurationChange(i, e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="bg-white/50 p-2 rounded border border-slate-100">
                                        <p className="text-[10px] font-black text-slate-300 uppercase mb-1">Visual Directive</p>
                                        {isEditing ? (
                                            <textarea 
                                                className="w-full bg-white border border-slate-200 rounded p-2 text-[10px] text-slate-600 leading-snug outline-none focus:ring-1 focus:ring-brand-primary/50 transition-all resize-none shadow-sm"
                                                rows={3}
                                                value={scene.visual}
                                                onChange={(e) => handleSceneVisualChange(i, e.target.value)}
                                            />
                                        ) : (
                                            <p className="text-[10px] text-slate-500 italic leading-snug">{scene.visual}</p>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase">Scene Script</p>
                                        <textarea 
                                            className="w-full p-3 text-xs border border-slate-300 rounded-lg focus:border-brand-primary outline-none focus:ring-1 focus:ring-brand-primary/20 transition-all bg-white text-slate-700 font-medium resize-none shadow-sm"
                                            rows={4}
                                            value={scene.script}
                                            onChange={(e) => handleSceneScriptChange(i, e.target.value)}
                                            placeholder="Enter script for this scene..."
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-3 pt-4 border-t border-slate-100">
                             <button onClick={() => setIsEditing(false)} className="flex-1 py-3 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors">Cancel</button>
                             <button 
                                onClick={handleSave} 
                                disabled={isSaving}
                                className={`flex-1 py-3 text-xs font-bold text-white bg-brand-primary rounded-xl hover:bg-brand-secondary transition-colors shadow-lg flex items-center justify-center gap-2 ${isSaving ? 'opacity-70 cursor-wait' : ''}`}
                             >
                                {isSaving ? (
                                    <>
                                        <SparklesIcon className="w-4 h-4 animate-spin" />
                                        Optimizing...
                                    </>
                                ) : (
                                    'Save Changes'
                                )}
                             </button>
                        </div>
                    </div>
                )}

                {!isEditing && variation.script && (
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Full Script</p>
                            <CopyButton text={variation.script} label="Copy Script" />
                        </div>
                        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 p-4 rounded-xl italic leading-relaxed max-h-32 overflow-y-auto custom-scrollbar">"{variation.script}"</p>
                    </div>
                )}
            </>
            ) : null}
        </div>
        <div className="mt-auto pt-8 flex flex-col gap-4">
            {isImageAdVariation(variation) && (
                <>
                <div className={`grid ${onRevert && variation.previousVersion ? 'grid-cols-3' : 'grid-cols-2'} gap-3`}>
                    {onRefine && (
                        <button
                            onClick={() => onRefine(variation, index)}
                            className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs py-3 px-2 rounded-xl flex items-center justify-center transition-all duration-300 border border-slate-200 group/btn"
                        >
                            <TargetIcon className="w-4 h-4 mr-2 group-hover/btn:scale-110 transition-transform" />
                            Refine
                        </button>
                    )}
                    {onRevert && variation.previousVersion && (
                        <button
                            onClick={() => onRevert(variation, index)}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-xs py-3 px-2 rounded-xl flex items-center justify-center transition-all duration-300 border border-amber-200 group/btn"
                        >
                            <span className="mr-1 text-lg leading-none">↺</span>
                            Revert
                        </button>
                    )}
                    {onBranch && (
                        <button
                            onClick={() => onBranch(variation, index)}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs py-3 px-2 rounded-xl flex items-center justify-center transition-all duration-300 border border-indigo-200 group/btn"
                        >
                            <SparklesIcon className="w-4 h-4 mr-2 group-hover/btn:scale-110 transition-transform" />
                            Iterate
                        </button>
                    )}
                </div>
                <button
                    onClick={() => onDownloadSingle(variation, index)}
                    className="w-full bg-slate-900 hover:bg-brand-primary text-white font-black py-4 px-4 rounded-xl flex items-center justify-center transition-all duration-300 shadow-lg group/dl"
                >
                    <DownloadIcon className="w-5 h-5 mr-3 group-hover/dl:-translate-y-1 transition-transform" />
                    Export Asset
                </button>
                </>
            )}
            {isVideoAdVariation(variation) && variation.jsonInstructions && !isEditing && (
                 <>
                     {onBranch && (
                        <button
                            onClick={() => onBranch(variation, index)}
                            className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black py-4 px-4 rounded-xl flex items-center justify-center transition-all duration-300 border border-indigo-200 group/btn"
                        >
                            <SparklesIcon className="w-5 h-5 mr-3 group-hover/btn:scale-110 transition-transform" />
                            Iterate Concept
                        </button>
                     )}
                     
                     {/* Segment Selector */}
                     <div className="space-y-2 mb-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Segment Split</span>
                        </div>
                        <div className="flex gap-1">
                            {[null, 8, 15].map((mode) => (
                                <button
                                    key={mode === null ? 'off' : mode}
                                    onClick={() => setSplitMode(mode)}
                                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all border ${splitMode === mode ? 'bg-brand-primary border-brand-primary text-white shadow-md' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'}`}
                                >
                                    {mode === null ? 'Full' : `${mode}s`}
                                </button>
                            ))}
                        </div>
                     </div>

                     {splitMode === null ? (
                        <>
                            <button
                                onClick={handleCopyPrompt}
                                className={`w-full font-black py-4 px-4 rounded-xl flex items-center justify-center transition-all duration-300 shadow-lg group/dl ${isCopied ? 'bg-emerald-500 text-white' : 'bg-slate-900 hover:bg-emerald-600 text-white'}`}
                            >
                                <DownloadIcon className="w-5 h-5 mr-3 group-hover/dl:-translate-y-1 transition-transform" />
                                {isCopied ? "Copied Prompt!" : "Copy JSON Prompt"}
                            </button>
                            <button
                                onClick={handleGenerateVideoClick}
                                disabled={isGeneratingVideo}
                                className={`w-full font-black py-4 px-4 rounded-xl flex items-center justify-center transition-all duration-300 shadow-lg group/dl ${isGeneratingVideo ? 'bg-indigo-400 text-white cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
                            >
                                {isGeneratingVideo ? (
                                    <>
                                        <SparklesIcon className="w-5 h-5 mr-3 animate-spin" />
                                        {videoGenerationProgress || "Generating Video..."}
                                    </>
                                ) : (
                                    <>
                                        <DownloadIcon className="w-5 h-5 mr-3 group-hover/dl:-translate-y-1 transition-transform" />
                                        Generate Video (9:16)
                                    </>
                                )}
                            </button>
                            <p className="text-[10px] text-slate-400 text-center italic mt-1">*Generate Video button is for 8-second clips only.</p>
                            {generatedVideoUrl && (
                                <video src={generatedVideoUrl} controls className="w-full h-auto rounded-xl mt-4" />
                            )}
                        </>
                     ) : (
                         <div className="grid grid-cols-1 gap-2">
                             {instructionChunks.map((chunk, chunkIdx) => {
                                 const isChunkCopied = copiedChunks.has(chunkIdx);
                                 const chunkDuration = chunk.reduce((acc, s) => acc + (parseFloat(s.duration) || 0), 0);
                                 return (
                                    <button
                                        key={chunkIdx}
                                        onClick={() => handleCopyChunk(chunkIdx, chunk)}
                                        className={`w-full font-black py-3 px-4 rounded-xl flex items-center justify-center transition-all duration-300 border-2 ${isChunkCopied ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-900 text-slate-900 hover:bg-slate-50'}`}
                                    >
                                        <DownloadIcon className={`w-4 h-4 mr-3 ${isChunkCopied ? 'text-white' : 'text-slate-900'}`} />
                                        <span className="text-sm">
                                            {isChunkCopied ? `Copied Part ${chunkIdx + 1}/${instructionChunks.length} (${chunkDuration.toFixed(0)}s)` : `Copy Part ${chunkIdx + 1}/${instructionChunks.length} (${chunkDuration.toFixed(0)}s)`}
                                        </span>
                                    </button>
                                 );
                             })}
                         </div>
                     )}
                 </>
            )}
        </div>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
      `}</style>
    </div>
  );
};

export const AdVariationsDisplay: React.FC<AdVariationsDisplayProps> = ({
  originalFilePreviews,
  fileType,
  variations,
  onImageClick,
  onDownloadSingle,
  onRefine,
  onBranch,
  onRevert,
  onUpdateVariation,
  namingTemplate,
  userPrompt,
  aggroLevel,
  similarityLevel,
  sourceIsVideo,
  onGenerateVideo,
  onProgress
}) => {
  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start pb-20">
        {/* Sticky Sidebar for Source Asset */}
        <div className="w-full lg:w-1/3 lg:sticky lg:top-28 space-y-6 animate-fade-in">
            <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-200">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-sm">1</div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Source Assets</h3>
                </div>
                
                <div className="space-y-4">
                    {originalFilePreviews.length > 0 ? (
                        originalFilePreviews.map((preview, idx) => (
                            <div key={idx} className="rounded-2xl overflow-hidden border-4 border-slate-100 bg-slate-50 shadow-inner relative group">
                                {(fileType === FileType.VIDEO || sourceIsVideo) ? (
                                    <video src={preview} controls className="w-full h-auto rounded-xl" />
                                ) : (
                                    <img src={preview} alt={`Original ${idx + 1}`} className="w-full h-auto object-contain rounded-xl" />
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="h-64 flex items-center justify-center text-slate-400 font-medium italic">No previews available</div>
                    )}
                </div>
                
                <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100">
                         <span>Status</span>
                         <span className="text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-100 shadow-sm">Active Session</span>
                    </div>
                     <div className="flex justify-between items-center text-xs font-bold text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100">
                         <span>Variations</span>
                         <span className="text-brand-primary bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100 shadow-sm">{variations.length} Generated</span>
                    </div>
                </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 opacity-75 hover:opacity-100 transition-opacity">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <SparklesIcon className="w-4 h-4" /> Config Snapshot
                </h4>
                
                <div className="space-y-4">
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Prompt Instruction</p>
                        <p className="text-xs text-slate-500 italic leading-relaxed bg-slate-100 p-3 rounded-xl border border-slate-200">
                            "{userPrompt || 'No specific prompt provided'}"
                        </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Aggro Level</p>
                            <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-lg border border-slate-200">
                                <div className="flex-grow h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-slate-400" style={{ width: `${aggroLevel ?? 50}%` }}></div>
                                </div>
                                <span className="text-[10px] font-bold text-slate-500">{aggroLevel ?? 50}%</span>
                            </div>
                        </div>
                         <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Creativity</p>
                            <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-lg border border-slate-200">
                                <div className="flex-grow h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-slate-400" style={{ width: `${similarityLevel ?? 50}%` }}></div>
                                </div>
                                <span className="text-[10px] font-bold text-slate-500">{similarityLevel ?? 50}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Grid of Variations */}
        <div className="w-full lg:w-2/3 flex flex-col gap-8">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-brand-primary text-white flex items-center justify-center font-black text-sm">2</div>
                 <h3 className="text-xl font-black text-slate-900 tracking-tight">Generated Variations</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {variations.map((variation, idx) => (
                    <VariationCard 
                        key={idx}
                        variation={variation}
                        index={idx}
                        fileType={fileType}
                        onImageClick={onImageClick}
                        onDownloadSingle={onDownloadSingle}
                        onRefine={onRefine}
                        onBranch={onBranch}
                        onRevert={onRevert}
                        onUpdateVariation={onUpdateVariation}
                        onGenerateVideo={onGenerateVideo}
                        onProgress={onProgress}
                    />
                ))}
            </div>
        </div>
    </div>
  );
};
