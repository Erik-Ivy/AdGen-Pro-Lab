
import React, { useState, useEffect, useRef } from 'react';
import { FileUpload } from './components/FileUpload';
import { AdVariationsDisplay } from './components/AdVariationsDisplay';
import { LoginScreen } from './components/LoginScreen';
import { generateAdVariations, generateCreativeBlueprints, generateVisualsFromBlueprint, generateAvatarAnalysis, generateVideoFromJSON, animateImage, setGeminiConfig, getApiKey } from './services/geminiService';
import { AdVariation, FileType, isImageAdVariation, isVideoAdVariation, CreativeBlueprint, ImageAdVariation, VideoAdVariation, HighlightCoordinates, VideoMode, AvatarAnalysis } from './types';
import { 
  SparklesIcon, 
  ResetIcon, 
  DownloadIcon, 
  PlusIcon, 
  ImageIcon, 
  VideoIcon, 
  LogoIcon,
  HomeIcon,
  StrategyIcon,
  LandingPageIcon,
  TargetIcon,
  CloseIcon,
  ChevronDownIcon,
  ProfileIcon,
  AspectRatioSquareIcon,
  AspectRatioVerticalIcon,
  AspectRatioHorizontalIcon
} from './components/icons';
import { ImageModal } from './components/ImageModal';
import { ImageHighlighter } from './components/ImageHighlighter';

type AppState = 'SELECT_AD_TYPE' | 'READY_TO_UPLOAD' | 'STRATEGY_GENERATED' | 'GENERATING' | 'RESULTS_SHOWN';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  
  const [appState, setAppState] = useState<AppState>('SELECT_AD_TYPE');
  const [selectedAdType, setSelectedAdType] = useState<FileType | null>(null);
  
  // File state
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [perfFiles, setPerfFiles] = useState<File[]>([]);
  
  // Create Mode state
  const [variationCount, setVariationCount] = useState(4);
  const [userPrompt, setUserPrompt] = useState("");
  const [namingTemplate, setNamingTemplate] = useState("#-ad-campaign");
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [videoLength, setVideoLength] = useState("");
  const [similarityLevel, setSimilarityLevel] = useState(50); 
  const [videoMode, setVideoMode] = useState<VideoMode>('hook');
  const [noDepthOfField, setNoDepthOfField] = useState(true);

  // Strategy state
  const [aggroLevel, setAggroLevel] = useState(50);
  const [blueprints, setBlueprints] = useState<CreativeBlueprint[]>([]);
  const [selectedBlueprintIds, setSelectedBlueprintIds] = useState<Set<string>>(new Set());
  
  // Avatar Analysis state
  const [avatarProfile, setAvatarProfile] = useState<AvatarAnalysis | null>(null);

  const [variations, setVariations] = useState<AdVariation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState('');
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  // UI state
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const toolsDropdownRef = useRef<HTMLDivElement>(null);

  // Refinement & Branching state
  const [refiningVariation, setRefiningVariation] = useState<{ variation: AdVariation, index: number } | null>(null);
  const [branchingVariation, setBranchingVariation] = useState<{ variation: AdVariation, index: number } | null>(null);
  const [refinementCoords, setRefinementCoords] = useState<HighlightCoordinates | null>(null);
  const [refinementPrompt, setRefinementPrompt] = useState<string>('');
  const [branchingPrompt, setBranchingPrompt] = useState<string>('');
  const [branchingCount, setBranchingCount] = useState<number>(3);
  const [refinementReferenceImage, setRefinementReferenceImage] = useState<File | null>(null);
  const [branchingReferenceImage, setBranchingReferenceImage] = useState<File | null>(null);
  const [isAnimateImage, setIsAnimateImage] = useState<boolean>(false);
  const [animationPrompt, setAnimationPrompt] = useState<string>('Animate this');

  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/config')
      .then(res => res.json())
      .then(config => {
        setGeminiConfig(config);
        if (config.API_KEY || config.GEMINI_API_KEY || config.GOOGLE_API_KEY) {
          setHasApiKey(true);
        }
      })
      .catch(err => console.error('Failed to load config:', err));
  }, []);

  useEffect(() => {
    const globalAuthState = (window as any).firebaseAuthState;
    if (globalAuthState && globalAuthState.initialized) {
        setIsAuthenticated(!!globalAuthState.user);
        setIsAuthLoading(false);
    }

    const handleAuthChange = (e: any) => {
      setIsAuthenticated(!!e.detail.user);
      setIsAuthLoading(false);
    };

    window.addEventListener('firebase-auth-change', handleAuthChange);

    const safetyTimeout = setTimeout(() => {
        setIsAuthLoading(false);
    }, 5000);

    return () => {
        window.removeEventListener('firebase-auth-change', handleAuthChange);
        clearTimeout(safetyTimeout);
    };
  }, []);

  useEffect(() => {
    const isModalOpen = !!refiningVariation || !!branchingVariation || !!selectedImageUrl;
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [refiningVariation, branchingVariation, selectedImageUrl]);

  useEffect(() => {
    const checkApiKey = async () => {
      if ((window as any).aistudio && (window as any).aistudio.hasSelectedApiKey) {
          try {
            const selected = await (window as any).aistudio.hasSelectedApiKey();
            // Only update if not already set to true by config fetch
            setHasApiKey(prev => prev === true ? true : selected);
          } catch (e) {
            console.error("Error checking API key:", e);
            setHasApiKey(prev => prev === true ? true : false);
          }
      } else {
          const key = getApiKey();
          setHasApiKey(!!key);
      }
    };
    checkApiKey();

    const handleClickOutside = (event: MouseEvent) => {
      if (toolsDropdownRef.current && !toolsDropdownRef.current.contains(event.target as Node)) {
        setIsToolsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenSelectKey = async () => {
    if ((window as any).aistudio && (window as any).aistudio.openSelectKey) {
        await (window as any).aistudio.openSelectKey();
        // Re-fetch config to get the newly selected key
        try {
          const response = await fetch('/api/config');
          if (response.ok) {
            const config = await response.json();
            setGeminiConfig(config);
          }
        } catch (e) {
          console.error("Error re-fetching config:", e);
        }
    }
    setHasApiKey(true);
  };

  const handleSelectTool = (type: FileType) => {
    handleReset();
    setSelectedAdType(type);
    setAppState('READY_TO_UPLOAD');
    setIsToolsOpen(false);
  };

  const handleRevert = (variation: AdVariation, index: number) => {
      if (isImageAdVariation(variation) && variation.previousVersion) {
          setVariations(prev => prev.map((item, i) => i === index ? variation.previousVersion! : item));
      }
  };

  const handleReset = () => {
    setAppState('SELECT_AD_TYPE');
    setSelectedAdType(null);
    setBatchFiles([]);
    setPerfFiles([]);
    setBlueprints([]);
    setAvatarProfile(null);
    setSelectedBlueprintIds(new Set());
    setVariations([]);
    setError(null);
    setLoadingProgress('');
    setRefiningVariation(null);
    setBranchingVariation(null);
    setRefinementCoords(null);
    setRefinementPrompt('');
    setBranchingPrompt('');
    setRefinementReferenceImage(null);
    setBranchingReferenceImage(null);
    setIsAnimateImage(false);
    setAnimationPrompt('Animate this');
    setUserPrompt("");
    setNamingTemplate("#-ad-campaign");
    setVideoLength("");
    setVariationCount(4);
    setAggroLevel(50);
    setSimilarityLevel(50);
    setVideoMode('hook');
  };

  const handleLogout = async () => {
    if ((window as any).firebaseAuth) {
      await (window as any).firebaseAuth.logout();
    }
    handleReset();
  };

  const handleUpdateBlueprint = (id: string, field: keyof CreativeBlueprint, value: string) => {
      setBlueprints(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const handleUpdateVariation = (index: number, updatedVariation: AdVariation) => {
      setVariations(prev => {
          const newVars = [...prev];
          newVars[index] = updatedVariation;
          return newVars;
      });
  };

  const handleGenerateVideo = async (jsonInstructions: string, aspectRatio: '16:9' | '9:16', onProgress: (progress: string) => void) => {
    setLoadingProgress('Initiating video generation...');
    try {
        const videoUrl = await generateVideoFromJSON(jsonInstructions, aspectRatio, onProgress);
        setLoadingProgress('Video generated successfully!');
        return videoUrl;
    } catch (error: any) {
        console.error("Error generating video:", error);
        setLoadingProgress(`Video generation failed: ${error.message}`);
        throw error;
    }
  };

  const handleGenerateVariations = async () => {
    if (batchFiles.length === 0 && !userPrompt.trim()) {
         setError("Please upload a creative asset OR provide a prompt instruction.");
         return;
    }

    setAppState('GENERATING');
    setError(null);
    try {
        const results = await generateAdVariations(
            batchFiles.length > 0 ? batchFiles : null,
            selectedAdType!,
            userPrompt || "Create a high-performing variation of this ad",
            variationCount,
            setLoadingProgress,
            null,
            null,
            namingTemplate,
            aggroLevel,
            similarityLevel,
            videoLength,
            videoMode,
            null,
            aspectRatio,
            noDepthOfField
        );
        setVariations(results);
        setAppState('RESULTS_SHOWN');
    } catch (e: any) {
        setError(e.message || "Variation generation failed.");
        setAppState('READY_TO_UPLOAD');
    } finally {
        setLoadingProgress('');
    }
  };

  const handleAnalyzeAvatar = async () => {
      if (batchFiles.length === 0 && !userPrompt.trim()) {
          setError("Please upload valid assets (image/video) OR provide a detailed description prompt.");
          return;
      }
      setAppState('GENERATING');
      setError(null);
      try {
          const result = await generateAvatarAnalysis(batchFiles, setLoadingProgress, userPrompt);
          setAvatarProfile(result);
          setAppState('RESULTS_SHOWN');
      } catch (e: any) {
          setError(e.message || "Avatar analysis failed.");
          setAppState('READY_TO_UPLOAD');
      } finally {
          setLoadingProgress('');
      }
  };

  const handleBranchVariations = async () => {
    if (!branchingVariation) return;
    const v = branchingVariation.variation;

    const currentBranchingPrompt = branchingPrompt;
    const currentBranchingReference = branchingReferenceImage;
    const currentIsAnimate = isAnimateImage;
    const currentAnimationPrompt = animationPrompt;

    setBranchingVariation(null);
    setBranchingPrompt('');
    setBranchingReferenceImage(null);
    setIsAnimateImage(false);
    setAnimationPrompt('Animate this');

    setAppState('GENERATING');
    setError(null);
    
    try {
        let results: AdVariation[] = [];

        if (isImageAdVariation(v)) {
            if (currentIsAnimate) {
                for (let i = 0; i < branchingCount; i++) {
                    setLoadingProgress(`Animating variation ${i + 1}/${branchingCount}...`);
                    const videoUrl = await animateImage(v.imageUrl, currentAnimationPrompt, (msg) => setLoadingProgress(`Variation ${i+1}/${branchingCount}: ${msg}`));
                    
                    results.push({
                        title: namingTemplate ? namingTemplate.replace('#', (variations.length + i + 1).toString()) : `Animated Variation ${i + 1}`,
                        summary: `Animated version of the selected image. Instruction: ${currentAnimationPrompt}`,
                        videoUrl: videoUrl,
                        duration: "8s",
                        performanceScore: v.performanceScore || 8.0,
                        characterDescription: "Based on source image",
                        videoStyle: "Animated motion"
                    });
                }
            } else {
                results = await generateAdVariations(
                    v.imageUrl,
                    FileType.IMAGE,
                    currentBranchingPrompt || "Create child variations based on this design",
                    branchingCount,
                    setLoadingProgress,
                    null,
                    null,
                    namingTemplate ? `${namingTemplate}-branch` : "branch",
                    aggroLevel,
                    similarityLevel,
                    null,
                    'hook',
                    currentBranchingReference,
                    aspectRatio,
                    noDepthOfField
                );
            }
        } else if (isVideoAdVariation(v)) {
            const basePrompt = `
                REFERENCE CONCEPT (VARIATION TO EVOLVE FROM):
                Summary: ${v.summary}
                Character Traits: ${v.characterDescription}
                Video Style: ${v.videoStyle}
                Original Script: ${v.script}

                GOAL: Create ${branchingCount} new variations that specifically iterate on the traits and style of this reference. 
                Keep the core product/brand context from the baseline, but treat this variation's specific angle, character, and filming style as the primary inspiration.

                USER INSTRUCTIONS:
                ${branchingPrompt || "Generate new video hooks that evolve from this concept."}
            `;

            results = await generateAdVariations(
                batchFiles.length > 0 ? batchFiles : null, 
                FileType.VIDEO,
                basePrompt,
                branchingCount,
                setLoadingProgress,
                null,
                null,
                null,
                aggroLevel,
                similarityLevel,
                videoLength,
                videoMode,
                null,
                aspectRatio,
                noDepthOfField
            );
        }

        setVariations(prev => [...prev, ...results]);
        setAppState('RESULTS_SHOWN');
        setBranchingPrompt('');
    } catch (e: any) {
        const errorMsg = e.message || "Unknown error";
        setError("Branching failed: " + errorMsg);
        
        // If the request fails with an error message containing "Requested entity was not found.", 
        // reset the key selection state and prompt the user to select a key again.
        if (errorMsg.includes("Requested entity was not found") || errorMsg.includes("API_KEY not set")) {
            setHasApiKey(false);
        }
        
        setAppState('RESULTS_SHOWN');
    } finally {
        setLoadingProgress('');
    }
  };

  const startStrategyAnalysis = async () => {
      if (batchFiles.length === 0) {
          setError("Please upload at least one creative asset.");
          return;
      }
      setAppState('GENERATING');
      setError(null);
      try {
          const result = await generateCreativeBlueprints(batchFiles, perfFiles, aggroLevel, similarityLevel, selectedAdType!, setLoadingProgress, userPrompt, noDepthOfField);
          setBlueprints(result);
          setAppState('STRATEGY_GENERATED');
      } catch (e: any) {
          setError(e.message || "Strategic analysis failed.");
          setAppState('READY_TO_UPLOAD');
      } finally {
          setLoadingProgress('');
      }
  };

  const generateVisualsForSelected = async () => {
      if (selectedBlueprintIds.size === 0) {
          setError("Please select at least one blueprint to visualize.");
          return;
      }
      setAppState('GENERATING');
      setError(null);
      try {
          const selected = blueprints.filter(b => selectedBlueprintIds.has(b.id));
          const results: AdVariation[] = [];
          for (const blueprint of selected) {
              const variation = await generateVisualsFromBlueprint(blueprint, selectedAdType!, setLoadingProgress, similarityLevel, null, null, null, null, noDepthOfField);
              results.push(variation);
          }
          setVariations(results);
          setAppState('RESULTS_SHOWN');
      } catch (e: any) {
          setError(e.message || "Visual generation failed.");
          setAppState('STRATEGY_GENERATED');
      } finally {
          setLoadingProgress('');
      }
  };

  const handleRefineVariation = async () => {
      if (!refiningVariation) return;
      if (!refinementCoords && !refinementPrompt.trim()) return;
      
      const v = refiningVariation.variation;
      if (!isImageAdVariation(v)) return;

      const currentRefinementCoords = refinementCoords;
      const currentRefinementPrompt = refinementPrompt;
      const currentRefinementReference = refinementReferenceImage;
      const currentVariationIndex = refiningVariation.index;

      setRefiningVariation(null);
      setRefinementCoords(null);
      setRefinementPrompt('');
      setRefinementReferenceImage(null);
      
      setAppState('GENERATING');

      try {
          const matchingBlueprint = blueprints.find(b => b.title === v.headline);
          
          let result: AdVariation;
          if (matchingBlueprint) {
              result = await generateVisualsFromBlueprint(
                  matchingBlueprint, 
                  selectedAdType!, 
                  setLoadingProgress, 
                  similarityLevel,
                  currentRefinementCoords, 
                  v.imageUrl,
                  currentRefinementPrompt,
                  currentRefinementReference,
                  noDepthOfField
              );
          } else {
              const results = await generateAdVariations(
                  v.imageUrl, 
                  FileType.IMAGE, 
                  currentRefinementPrompt || "Refining visual based on selection", 
                  1, 
                  setLoadingProgress, 
                  currentRefinementCoords,
                  currentRefinementPrompt,
                  null,
                  aggroLevel,
                  similarityLevel,
                  null,
                  'hook',
                  currentRefinementReference,
                  aspectRatio,
                  noDepthOfField
              );
              result = results[0];
          }

          // Save previous version for revert capability
          if (isImageAdVariation(result)) {
              result.previousVersion = v;
          }

          setVariations(prev => prev.map((item, i) => i === currentVariationIndex ? result : item));
          setAppState('RESULTS_SHOWN');
      } catch (e: any) {
          setError("Refinement failed: " + e.message);
          setAppState('RESULTS_SHOWN');
      } finally {
          setLoadingProgress('');
      }
  };

  const toggleBlueprintSelection = (id: string) => {
      const newSet = new Set(selectedBlueprintIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedBlueprintIds(newSet);
  };

  const renderSelectAdType = () => (
    <div className="text-center animate-fade-in w-full py-12 px-4 max-w-7xl mx-auto">
        <h1 className="text-4xl sm:text-6xl font-black mb-4 text-slate-900 tracking-tight">
          AdGen <span className="text-brand-primary italic">Pro Lab</span>
        </h1>
        <p className="text-xl text-slate-500 mb-16 max-w-3xl mx-auto leading-relaxed">
          The ultimate engine for high-performing marketing assets. Create variations or analyze entire batches to find your next winning angle.
        </p>

        <div className="space-y-20">
            <section>
                <div className="flex items-center gap-4 mb-8">
                    <div className="h-px bg-slate-200 flex-grow"></div>
                    <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">Create</h2>
                    <div className="h-px bg-slate-200 flex-grow"></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <button onClick={() => handleSelectTool(FileType.IMAGE)} className="group bg-white p-10 rounded-[2.5rem] border border-slate-200 hover:border-brand-primary shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 flex flex-col items-center text-center">
                        <div className="bg-indigo-50 p-6 rounded-3xl mb-8 group-hover:bg-brand-primary group-hover:text-white transition-all duration-500">
                            <ImageIcon className="w-12 h-12 text-brand-primary group-hover:text-white"/>
                        </div>
                        <h3 className="text-2xl font-bold mb-3 text-slate-900">Image</h3>
                        <p className="text-slate-500 text-sm leading-relaxed max-w-xs">Transform a single ad into 10 high-impact creative variations.</p>
                    </button>
                    <button onClick={() => handleSelectTool(FileType.VIDEO)} className="group bg-white p-10 rounded-[2.5rem] border border-slate-200 hover:border-brand-primary shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 flex flex-col items-center text-center">
                        <div className="bg-emerald-50 p-6 rounded-3xl mb-8 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-500">
                            <VideoIcon className="w-12 h-12 text-emerald-600 group-hover:text-white"/>
                        </div>
                        <h3 className="text-2xl font-bold mb-3 text-slate-900">Video Hooks</h3>
                        <p className="text-slate-500 text-sm leading-relaxed max-w-xs">Create disruptive video hooks from your existing footage (up to 120s).</p>
                    </button>
                </div>
            </section>

            <section>
                <div className="flex items-center gap-4 mb-8">
                    <div className="h-px bg-slate-200 flex-grow"></div>
                    <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">Analyze</h2>
                    <div className="h-px bg-slate-200 flex-grow"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <button onClick={() => handleSelectTool(FileType.BATCH_AD_ANALYSIS)} className="group bg-white p-10 rounded-[2.5rem] border border-slate-200 hover:border-brand-primary shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 flex flex-col items-center text-center">
                        <div className="bg-indigo-50 p-6 rounded-3xl mb-8 group-hover:bg-brand-primary group-hover:text-white transition-all duration-500">
                            <StrategyIcon className="w-12 h-12 text-brand-primary group-hover:text-white"/>
                        </div>
                        <h3 className="text-2xl font-bold mb-3 text-slate-900">Ad Analysis</h3>
                        <p className="text-slate-500 text-sm leading-relaxed max-w-xs">Batch analyze 10+ ads and performance data to synthesize winning hooks.</p>
                    </button>
                    <button onClick={() => handleSelectTool(FileType.LANDING_PAGE_ANALYSIS)} className="group bg-white p-10 rounded-[2.5rem] border border-slate-200 hover:border-brand-primary shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 flex flex-col items-center text-center">
                        <div className="bg-emerald-50 p-6 rounded-3xl mb-8 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-500">
                            <LandingPageIcon className="w-12 h-12 text-emerald-600 group-hover:text-white"/>
                        </div>
                        <h3 className="text-2xl font-bold mb-3 text-slate-900">Landing Page Analysis</h3>
                        <p className="text-slate-500 text-sm leading-relaxed max-w-xs">Upload funnel screenshots and metrics for a revolutionary redesign strategy.</p>
                    </button>
                    <button onClick={() => handleSelectTool(FileType.AVATAR_ANALYSIS)} className="group bg-white p-10 rounded-[2.5rem] border border-slate-200 hover:border-brand-primary shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 flex flex-col items-center text-center">
                        <div className="bg-amber-50 p-6 rounded-3xl mb-8 group-hover:bg-amber-500 group-hover:text-white transition-all duration-500">
                            <ProfileIcon className="w-12 h-12 text-amber-600 group-hover:text-white"/>
                        </div>
                        <h3 className="text-2xl font-bold mb-3 text-slate-900">Avatar Analysis</h3>
                        <p className="text-slate-500 text-sm leading-relaxed max-w-xs">Reverse-engineer the customer mindset, fears, and inner monologue from high-performing ads.</p>
                    </button>
                </div>
            </section>
        </div>
    </div>
  );

  const renderCreateUploader = () => (
    <div className="max-w-4xl mx-auto py-12 px-4 animate-slide-in-up">
        <div className="bg-white rounded-[2rem] p-10 border border-slate-200 shadow-2xl">
            <h2 className="text-3xl font-black mb-8 text-slate-900">Creative Studio</h2>
            
            <div className="space-y-10">
                <div>
                    <label className="block text-sm font-black text-slate-800 uppercase tracking-widest mb-4">
                        Source Creative Assets (Video or Image) <span className="text-slate-400 normal-case font-normal">(Optional)</span>
                    </label>
                    <FileUpload 
                        onFileUpload={(f) => setBatchFiles(prev => [...prev, f])} 
                        fileType={selectedAdType} 
                        multiple={true}
                    />
                    {batchFiles.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                            {batchFiles.map((file, idx) => (
                                <div key={idx} className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-100 flex items-center gap-2">
                                    <span>{file.name}</span>
                                    <button onClick={() => setBatchFiles(prev => prev.filter((_, i) => i !== idx))} className="hover:text-red-500">×</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {selectedAdType === FileType.VIDEO && (
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                           <label className="text-sm font-black text-slate-800 uppercase tracking-widest">Generation Mode</label>
                        </div>
                        <div className="bg-slate-50 p-1.5 rounded-xl flex border border-slate-200 relative">
                            <button onClick={() => setVideoMode('hook')} className={`flex-1 py-3 rounded-lg text-sm font-black uppercase tracking-wider transition-all duration-300 ${videoMode === 'hook' ? 'bg-white text-brand-primary shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Video Hooks</button>
                            <button onClick={() => setVideoMode('story')} className={`flex-1 py-3 rounded-lg text-sm font-black uppercase tracking-wider transition-all duration-300 ${videoMode === 'story' ? 'bg-white text-brand-primary shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Story Ads</button>
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-sm font-black text-slate-800 uppercase tracking-widest mb-4">
                        Prompt Instructions
                    </label>
                    <textarea 
                        value={userPrompt}
                        onChange={(e) => setUserPrompt(e.target.value)}
                        placeholder="E.g., Make it look more futuristic..."
                        className="w-full p-6 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-700 font-bold focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 transition-all outline-none resize-none h-32"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div>
                        <label className="block text-sm font-black text-slate-800 uppercase tracking-widest mb-4">
                            Variation Count: <span className="text-brand-primary">{variationCount}</span>
                        </label>
                        <input 
                            type="range" min="1" max="10" value={variationCount} 
                            onChange={(e) => setVariationCount(parseInt(e.target.value))}
                            className="w-full h-4 bg-slate-200 rounded-full appearance-none cursor-pointer accent-brand-primary"
                        />
                     </div>
                     {selectedAdType === FileType.VIDEO ? (
                        <div>
                            <label className="block text-sm font-black text-slate-800 uppercase tracking-widest mb-4">
                                Suggested Video Length
                            </label>
                            <input 
                                value={videoLength}
                                onChange={(e) => setVideoLength(e.target.value)}
                                placeholder="e.g. 15s, 30s..."
                                className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-700 font-bold outline-none focus:border-brand-primary transition-all"
                            />
                            <p className="mt-2 text-[10px] text-slate-400 font-bold">Provide a target duration for the variations.</p>
                        </div>
                     ) : (
                        <div>
                            <label className="block text-sm font-black text-slate-800 uppercase tracking-widest mb-4">
                                Naming Template
                            </label>
                            <input 
                                value={namingTemplate}
                                onChange={(e) => setNamingTemplate(e.target.value)}
                                placeholder="e.g. #-summer-campaign"
                                className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-700 font-bold outline-none focus:border-brand-primary transition-all"
                            />
                            <p className="mt-2 text-[10px] text-slate-400 font-bold">The hashtag (#) will be replaced by the variation number.</p>
                        </div>
                     )}
                </div>

                {selectedAdType === FileType.IMAGE && (
                    <div className="animate-fade-in">
                        <label className="block text-sm font-black text-slate-800 uppercase tracking-widest mb-4">
                            Aspect Ratio
                        </label>
                        <div className="grid grid-cols-3 gap-4">
                            <button 
                                onClick={() => setAspectRatio('1:1')}
                                className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${aspectRatio === '1:1' ? 'border-brand-primary bg-indigo-50 text-brand-primary' : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'}`}
                            >
                                <AspectRatioSquareIcon className="w-6 h-6 mb-2" />
                                <span className="text-xs font-black">1:1</span>
                            </button>
                            <button 
                                onClick={() => setAspectRatio('9:16')}
                                className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${aspectRatio === '9:16' ? 'border-brand-primary bg-indigo-50 text-brand-primary' : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'}`}
                            >
                                <AspectRatioVerticalIcon className="w-6 h-6 mb-2" />
                                <span className="text-xs font-black">9:16</span>
                            </button>
                            <button 
                                onClick={() => setAspectRatio('16:9')}
                                className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${aspectRatio === '16:9' ? 'border-brand-primary bg-indigo-50 text-brand-primary' : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'}`}
                            >
                                <AspectRatioHorizontalIcon className="w-6 h-6 mb-2" />
                                <span className="text-xs font-black">16:9</span>
                            </button>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                    <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100 shadow-inner">
                        <div className="flex justify-between items-center mb-4">
                            <label className="text-sm font-black text-slate-900 tracking-tight">Aggro Level</label>
                            <span className="text-[10px] font-black uppercase px-2 py-1 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-100">{aggroLevel}%</span>
                        </div>
                        <input type="range" min="0" max="100" value={aggroLevel} onChange={(e) => setAggroLevel(parseInt(e.target.value))} className="w-full h-3 bg-slate-200 rounded-full appearance-none cursor-pointer accent-brand-primary" />
                        <div className="flex justify-between mt-2 text-[10px] text-slate-400 font-black uppercase tracking-tighter">
                            <span>Safe</span>
                            <span>Disruptive</span>
                        </div>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100 shadow-inner">
                        <div className="flex justify-between items-center mb-4">
                            <label className="text-sm font-black text-slate-900 tracking-tight">Creativity (Similarity)</label>
                            <span className="text-[10px] font-black uppercase px-2 py-1 rounded-full border bg-slate-100 text-slate-600 border-slate-200">{similarityLevel}%</span>
                        </div>
                        <input type="range" min="0" max="100" value={similarityLevel} onChange={(e) => setSimilarityLevel(parseInt(e.target.value))} className="w-full h-3 bg-slate-200 rounded-full appearance-none cursor-pointer accent-brand-primary" />
                        <div className="flex justify-between mt-2 text-[10px] text-slate-400 font-black uppercase tracking-tighter">
                            <span>Exact Match</span>
                            <span>Reimagined</span>
                        </div>
                    </div>
                </div>

                <div className="pt-4 flex items-center justify-between bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100">
                    <div className="flex flex-col">
                        <label className="text-sm font-black text-slate-900 tracking-tight">No Depth of Field</label>
                        <p className="text-[10px] text-slate-400 font-bold">Keep everything in focus (no background blur).</p>
                    </div>
                    <button 
                        onClick={() => setNoDepthOfField(!noDepthOfField)}
                        className={`w-12 h-6 rounded-full transition-all duration-300 relative ${noDepthOfField ? 'bg-brand-primary' : 'bg-slate-200'}`}
                    >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${noDepthOfField ? 'left-7' : 'left-1'}`} />
                    </button>
                </div>

                <div className="pt-8">
                    <button onClick={handleGenerateVariations} className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-black py-6 rounded-[1.5rem] shadow-2xl transition-all flex items-center justify-center gap-3 text-xl group">
                        <SparklesIcon className="w-7 h-7 group-hover:scale-110 transition-transform" />
                        Generate Variations
                    </button>
                    {error && <p className="text-red-500 text-center text-sm font-bold mt-4 bg-red-50 py-3 rounded-xl border border-red-100">{error}</p>}
                </div>
            </div>
        </div>
    </div>
  );

  const renderAnalyzeUploader = () => (
    <div className="max-w-4xl mx-auto py-12 px-4 animate-slide-in-up">
        <div className="bg-white rounded-[2rem] p-10 border border-slate-200 shadow-2xl">
            <h2 className="text-3xl font-black mb-8 text-slate-900">{selectedAdType === FileType.AVATAR_ANALYSIS ? "Consumer Psychology Lab" : "Strategic Feed"}</h2>
            <div className="space-y-10">
                <div>
                    <label className="block text-sm font-black text-slate-800 uppercase tracking-widest mb-4">
                        {selectedAdType === FileType.AVATAR_ANALYSIS ? "High-Performing Assets (or Prompt)" : "Creative Assets (Batch)"}
                    </label>
                    <FileUpload onFileUpload={(f) => setBatchFiles(prev => [...prev, f])} fileType={FileType.IMAGE} multiple />
                    <div className="mt-6 flex flex-wrap gap-2">
                        {batchFiles.map((f, i) => (
                            <div key={i} className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-100 flex items-center gap-2">
                                <span>{f.name}</span>
                                <button onClick={() => setBatchFiles(prev => prev.filter((_, idx) => idx !== i))}>×</button>
                            </div>
                        ))}
                    </div>
                </div>

                {selectedAdType !== FileType.AVATAR_ANALYSIS && (
                    <div>
                        <label className="block text-sm font-black text-slate-800 uppercase tracking-widest mb-4">Performance Intelligence</label>
                        <FileUpload onFileUpload={(f) => setPerfFiles(prev => [...prev, f])} fileType={FileType.IMAGE} multiple />
                    </div>
                )}

                <div>
                    <label className="block text-sm font-black text-slate-800 uppercase tracking-widest mb-4">
                        {selectedAdType === FileType.AVATAR_ANALYSIS ? "Context & Description (Optional)" : "Strategic Focus / Specific Instructions (Optional)"}
                    </label>
                    <textarea 
                        value={userPrompt}
                        onChange={(e) => setUserPrompt(e.target.value)}
                        placeholder={selectedAdType === FileType.AVATAR_ANALYSIS ? "E.g. Describe the product and any known audience details..." : "E.g., Focus on eco-friendly angles, or target the 25-34 demographic..."}
                        className="w-full p-6 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-700 font-bold focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 transition-all outline-none resize-none h-32"
                    />
                </div>

                {selectedAdType !== FileType.AVATAR_ANALYSIS && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                        <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100 shadow-inner">
                            <div className="flex justify-between items-center mb-4">
                                <label className="text-sm font-black text-slate-900 tracking-tight">Aggro Level</label>
                                <span className="text-[10px] font-black uppercase px-2 py-1 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-100">{aggroLevel}%</span>
                            </div>
                            <input type="range" min="0" max="100" value={aggroLevel} onChange={(e) => setAggroLevel(parseInt(e.target.value))} className="w-full h-3 bg-slate-200 rounded-full appearance-none cursor-pointer accent-brand-primary" />
                            <div className="flex justify-between mt-2 text-[10px] text-slate-400 font-black uppercase tracking-tighter">
                                <span>Safe</span>
                                <span>Disruptive</span>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100 shadow-inner">
                            <div className="flex justify-between items-center mb-4">
                                <label className="text-sm font-black text-slate-900 tracking-tight">Creativity (Similarity)</label>
                                <span className="text-[10px] font-black uppercase px-2 py-1 rounded-full border bg-slate-100 text-slate-600 border-slate-200">{similarityLevel}%</span>
                            </div>
                            <input type="range" min="0" max="100" value={similarityLevel} onChange={(e) => setSimilarityLevel(parseInt(e.target.value))} className="w-full h-3 bg-slate-200 rounded-full appearance-none cursor-pointer accent-brand-primary" />
                            <div className="flex justify-between mt-2 text-[10px] text-slate-400 font-black uppercase tracking-tighter">
                                <span>Close to Batch</span>
                                <span>Completely New</span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="pt-4 flex items-center justify-between bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100">
                    <div className="flex flex-col">
                        <label className="text-sm font-black text-slate-900 tracking-tight">No Depth of Field</label>
                        <p className="text-[10px] text-slate-400 font-bold">Ensure all elements are sharp and in focus.</p>
                    </div>
                    <button 
                        onClick={() => setNoDepthOfField(!noDepthOfField)}
                        className={`w-12 h-6 rounded-full transition-all duration-300 relative ${noDepthOfField ? 'bg-brand-primary' : 'bg-slate-200'}`}
                    >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${noDepthOfField ? 'left-7' : 'left-1'}`} />
                    </button>
                </div>

                <div className="pt-4">
                    <button 
                        onClick={selectedAdType === FileType.AVATAR_ANALYSIS ? handleAnalyzeAvatar : startStrategyAnalysis} 
                        className="w-full bg-brand-primary hover:bg-brand-secondary text-white font-black py-6 rounded-[1.5rem] shadow-2xl transition-all flex items-center justify-center gap-3 text-xl group"
                    >
                        {selectedAdType === FileType.AVATAR_ANALYSIS ? <ProfileIcon className="w-7 h-7" /> : <StrategyIcon className="w-7 h-7 group-hover:rotate-12 transition-transform" />}
                        {selectedAdType === FileType.AVATAR_ANALYSIS ? "Analyze Avatar" : "Analyze & Generate 10 Angles"}
                    </button>
                    {error && <p className="text-red-500 text-center text-sm font-bold mt-4 bg-red-50 py-3 rounded-xl border border-red-100">{error}</p>}
                </div>
            </div>
        </div>
    </div>
  );

  const renderAvatarResults = () => {
      if (!avatarProfile) return null;

      const handleUseAvatar = (type: FileType) => {
          const prompt = `
TARGET AVATAR: ${avatarProfile.personaTitle}
"${avatarProfile.quote}"

DEMOGRAPHICS: ${avatarProfile.demographics}
PSYCHOGRAPHICS: ${avatarProfile.psychographics}
CORE FEARS: ${avatarProfile.fears.join(', ')}
PAIN POINTS: ${avatarProfile.painPoints.join(', ')}

TASK: Create high-performing ${type === FileType.VIDEO ? 'video hooks' : 'ad creatives'} specifically designed to trigger this avatar.
1. Speak directly to their internal monologue.
2. Agitate their specific pain points.
3. Position the solution to resolve their deep fears.
          `.trim();
          
          setUserPrompt(prompt);
          setSelectedAdType(type);
          setAppState('READY_TO_UPLOAD');
          window.scrollTo({ top: 0, behavior: 'smooth' });
      };

      return (
        <div className="max-w-5xl mx-auto py-12 px-6 pb-40 animate-fade-in">
            <div className="text-center mb-16">
                <h2 className="text-5xl font-black text-slate-900 mb-6 tracking-tighter">Target Avatar Decoded</h2>
                <p className="text-xl text-slate-500 max-w-2xl mx-auto">We've reverse-engineered the consumer psychology behind the click.</p>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-900 p-10 md:p-14 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-32 bg-brand-primary/20 blur-[100px] rounded-full pointer-events-none"></div>
                    <div className="relative z-10">
                        <div className="flex flex-col md:flex-row md:items-center gap-6 mb-8">
                            <div className="bg-white/10 p-4 rounded-2xl inline-block backdrop-blur-sm border border-white/10">
                                <ProfileIcon className="w-12 h-12 text-white" />
                            </div>
                            <div>
                                <p className="text-brand-primary font-black uppercase tracking-widest text-xs mb-2">Primary Persona</p>
                                <h3 className="text-4xl md:text-5xl font-black tracking-tight leading-none">{avatarProfile.personaTitle}</h3>
                            </div>
                        </div>
                        <div className="bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-sm">
                            <p className="text-2xl font-serif italic text-slate-200 leading-relaxed">"{avatarProfile.quote}"</p>
                            <p className="text-right text-xs font-bold text-slate-400 mt-4 uppercase tracking-widest">— Internal Monologue</p>
                        </div>
                    </div>
                </div>

                <div className="p-10 md:p-14 grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-8">
                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Demographics & Psychographics</h4>
                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                <p className="text-sm font-bold text-slate-900 mb-2">{avatarProfile.demographics}</p>
                                <p className="text-sm text-slate-600 leading-relaxed">{avatarProfile.psychographics}</p>
                            </div>
                        </div>
                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">The "Bleeding Neck" (Pain Points)</h4>
                            <div className="space-y-3">
                                {avatarProfile.painPoints.map((pain, i) => (
                                    <div key={i} className="flex items-start gap-3">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-2 flex-shrink-0"></div>
                                        <p className="text-sm font-medium text-slate-700">{pain}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Deep Fears</h4>
                            <div className="flex flex-wrap gap-2">
                                {avatarProfile.fears.map((fear, i) => (
                                    <span key={i} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold border border-slate-200">{fear}</span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-8">
                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Detailed Internal Monologue</h4>
                            <div className="bg-indigo-50/50 p-8 rounded-3xl border border-indigo-100 h-full">
                                <p className="text-slate-700 leading-relaxed italic text-sm">{avatarProfile.internalMonologue}</p>
                            </div>
                        </div>
                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Why They Clicked (The Hook)</h4>
                            <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100">
                                <p className="text-sm text-slate-800 font-medium leading-relaxed">{avatarProfile.whyTheyClicked}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="mt-12 flex flex-col md:flex-row justify-center gap-4">
                 <button onClick={handleReset} className="bg-white border-2 border-slate-200 text-slate-800 font-black py-4 px-8 rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-50 shadow-lg group transition-all">
                    <ResetIcon className="w-5 h-5 group-hover:rotate-180 transition-transform" /> 
                    Analyze Another
                </button>
                <button onClick={() => handleUseAvatar(FileType.IMAGE)} className="bg-indigo-600 border-2 border-indigo-600 text-white font-black py-4 px-8 rounded-2xl flex items-center justify-center gap-3 hover:bg-indigo-700 shadow-lg shadow-indigo-200 group transition-all">
                    <ImageIcon className="w-5 h-5" />
                    Create Image Ads
                </button>
                <button onClick={() => handleUseAvatar(FileType.VIDEO)} className="bg-emerald-600 border-2 border-emerald-600 text-white font-black py-4 px-8 rounded-2xl flex items-center justify-center gap-3 hover:bg-emerald-700 shadow-lg shadow-emerald-200 group transition-all">
                    <VideoIcon className="w-5 h-5" />
                    Create Video Hooks
                </button>
            </div>
        </div>
      );
  };

  const Navbar = () => (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 h-20 flex items-center justify-between px-8 transition-all">
        <div className="flex items-center gap-3 cursor-pointer" onClick={handleReset}>
            <div className="bg-brand-primary p-2 rounded-xl shadow-lg shadow-brand-primary/20">
                <LogoIcon className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-black text-slate-900 tracking-tight">AdGen <span className="text-brand-primary italic">Pro</span></span>
        </div>
        <div className="flex items-center gap-6">
            {isAuthenticated && (
                <div className="flex items-center gap-4">
                    {hasApiKey === false && (
                        <button 
                            onClick={handleOpenSelectKey}
                            className="hidden md:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors animate-pulse"
                        >
                            <SparklesIcon className="w-3 h-3" />
                            Connect Google Cloud
                        </button>
                    )}
                    <div className="relative" ref={toolsDropdownRef}>
                        <button onClick={() => setIsToolsOpen(!isToolsOpen)} className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-brand-primary transition-colors bg-slate-100/50 px-4 py-2 rounded-full border border-slate-200/50">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Workspace Active
                            <ChevronDownIcon className={`w-4 h-4 transition-transform ${isToolsOpen ? 'rotate-180' : ''}`} />
                        </button>
                    {isToolsOpen && (
                        <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-slide-in-up origin-top-right">
                            <div className="p-2 space-y-1">
                                <button onClick={() => handleSelectTool(FileType.IMAGE)} className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 flex items-center gap-3 transition-colors group">
                                    <div className="bg-indigo-100 p-2 rounded-lg text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-colors"><ImageIcon className="w-4 h-4" /></div>
                                    <span className="text-sm font-bold text-slate-700">Image Studio</span>
                                </button>
                                <button onClick={() => handleSelectTool(FileType.VIDEO)} className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 flex items-center gap-3 transition-colors group">
                                    <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors"><VideoIcon className="w-4 h-4" /></div>
                                    <span className="text-sm font-bold text-slate-700">Video Hooks</span>
                                </button>
                                <div className="h-px bg-slate-100 my-1"></div>
                                <button onClick={() => handleSelectTool(FileType.BATCH_AD_ANALYSIS)} className="w-full text-left px-4 py-3 rounded-xl hover:bg-slate-50 flex items-center gap-3 transition-colors group">
                                    <div className="bg-indigo-100 p-2 rounded-lg text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-colors"><StrategyIcon className="w-4 h-4" /></div>
                                    <span className="text-sm font-bold text-slate-700">Ad Analysis</span>
                                </button>
                            </div>
                            <div className="bg-slate-50 p-3 border-t border-slate-100">
                                <button onClick={handleLogout} className="w-full text-center text-xs font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors">Sign Out</button>
                            </div>
                        </div>
                    )}
                    </div>
                </div>
            )}
        </div>
    </nav>
  );

  const renderGenerating = () => (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 animate-fade-in text-center">
        <div className="relative w-32 h-32 mb-12">
            <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-brand-primary rounded-full border-t-transparent animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
                <SparklesIcon className="w-12 h-12 text-brand-primary animate-pulse" />
            </div>
        </div>
        <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">Constructing High-Performing Creative...</h2>
        <p className="text-slate-500 font-medium text-lg max-w-lg mx-auto leading-relaxed mb-8">{loadingProgress || "Synthesizing market data and visual patterns..."}</p>
        
        <div className="w-full max-w-md bg-slate-100 h-2 rounded-full overflow-hidden relative">
            <div className="absolute top-0 left-0 h-full bg-brand-primary w-1/3 rounded-full animate-progress-ind"></div>
        </div>
        
        <div className="mt-12 p-6 bg-white border border-slate-200 rounded-2xl shadow-xl max-w-lg mx-auto transform rotate-1">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-ping"></div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">AI Agent Activity</p>
            </div>
            <p className="text-sm text-slate-600 font-mono">Analyzing {batchFiles.length} source assets. {batchFiles[0]?.type.startsWith('video/') ? 'Sampling temporal data points across duration...' : 'Processing visual conversion models...'}</p>
        </div>
    </div>
  );

  const renderBlueprints = () => (
    <div className="max-w-7xl mx-auto py-12 px-6 animate-fade-in pb-40">
        <div className="text-center mb-16">
            <h2 className="text-5xl font-black text-slate-900 mb-6 tracking-tighter">Strategic Blueprints</h2>
            <p className="text-xl text-slate-500 max-w-2xl mx-auto">Select the winning angles you want to visualize. Each blueprint is engineered for maximum conversion.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {blueprints.map((blueprint) => (
                <div 
                    key={blueprint.id} 
                    onClick={() => toggleBlueprintSelection(blueprint.id)}
                    className={`group cursor-pointer relative p-8 rounded-[2rem] border-2 transition-all duration-300 overflow-hidden ${selectedBlueprintIds.has(blueprint.id) ? 'bg-white border-brand-primary shadow-2xl scale-[1.01]' : 'bg-white border-slate-200 hover:border-brand-primary/30 hover:shadow-xl'}`}
                >
                    <div className={`absolute top-6 right-6 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${selectedBlueprintIds.has(blueprint.id) ? 'bg-brand-primary border-brand-primary' : 'border-slate-300 bg-slate-50 group-hover:border-brand-primary'}`}>
                        {selectedBlueprintIds.has(blueprint.id) && <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>

                    <div className="mb-6">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">Angle #{blueprint.id}</span>
                        <h3 className="text-2xl font-black text-slate-900 mt-4 leading-tight group-hover:text-brand-primary transition-colors">{blueprint.title}</h3>
                    </div>

                    <div className="space-y-4 mb-6">
                        <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Psychological Trigger</p>
                            <p className="text-sm font-bold text-slate-700">{blueprint.psychology}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Visual Hook</p>
                            <p className="text-sm text-slate-600 leading-relaxed">{blueprint.visualHook}</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Headline Copy</p>
                            <p className="text-sm font-serif italic text-slate-600">"{blueprint.copy}"</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                         <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg text-xs font-bold border border-emerald-100">
                            CTA: {blueprint.cta}
                         </div>
                         {blueprint.searchInsights && (
                            <div className="bg-amber-50 text-amber-700 px-3 py-1 rounded-lg text-xs font-bold border border-amber-100 truncate max-w-[200px]">
                                {blueprint.searchInsights}
                            </div>
                         )}
                    </div>
                </div>
            ))}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/90 backdrop-blur-xl border-t border-slate-200 z-40 flex items-center justify-center gap-4 animate-slide-in-up">
            <span className="text-sm font-bold text-slate-500 mr-4">{selectedBlueprintIds.size} Selected</span>
            <button 
                onClick={handleReset}
                className="px-8 py-4 rounded-2xl font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
                Cancel
            </button>
            <button 
                onClick={generateVisualsForSelected}
                disabled={selectedBlueprintIds.size === 0}
                className={`px-12 py-4 rounded-2xl font-black text-white shadow-xl transition-all flex items-center gap-3 ${selectedBlueprintIds.size > 0 ? 'bg-brand-primary hover:bg-brand-secondary hover:scale-105' : 'bg-slate-300 cursor-not-allowed'}`}
            >
                <SparklesIcon className="w-6 h-6" />
                Generate {selectedBlueprintIds.size} Visuals
            </button>
        </div>
    </div>
  );

  const renderRefinementOverlay = () => {
    if (!refiningVariation) return null;
    if (!isImageAdVariation(refiningVariation.variation)) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4 sm:p-8 animate-fade-in">
            <div className="bg-white w-full max-w-6xl h-[90vh] rounded-[2.5rem] shadow-2xl flex overflow-hidden animate-scale-in">
                 <div className="w-2/3 bg-slate-100 relative p-8 flex flex-col">
                    <div className="absolute top-6 left-6 z-10 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm border border-slate-200">
                         <p className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                            <TargetIcon className="w-4 h-4 text-brand-primary" /> 
                            Draw Box to Target Edit
                         </p>
                    </div>
                    <div className="flex-grow relative rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-50">
                         <ImageHighlighter 
                            imageUrl={refiningVariation.variation.imageUrl} 
                            onSelectionChange={setRefinementCoords}
                            initialCoords={refinementCoords}
                         />
                    </div>
                 </div>
                 <div className="w-1/3 bg-white p-8 flex flex-col border-l border-slate-100">
                    <div className="mb-8">
                        <h3 className="text-2xl font-black text-slate-900 mb-2">Refine Asset</h3>
                        <p className="text-slate-500 text-sm">Select an area on the image and describe what you want to change.</p>
                    </div>
                    
                    <div className="flex-grow space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Instruction</label>
                            <textarea 
                                value={refinementPrompt}
                                onChange={(e) => setRefinementPrompt(e.target.value)}
                                placeholder="E.g. Change the background color to blue, make the text bigger..."
                                className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-700 font-bold outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 transition-all resize-none h-32"
                            />
                        </div>
                        <div>
                             <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Reference Image (Optional)</label>
                             <FileUpload 
                                onFileUpload={(f) => setRefinementReferenceImage(f)} 
                                fileType={FileType.IMAGE} 
                                multiple={false}
                             />
                             {refinementReferenceImage && (
                                <div className="mt-2 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-100 flex items-center justify-between">
                                    <span>{refinementReferenceImage.name}</span>
                                    <button onClick={() => setRefinementReferenceImage(null)} className="hover:text-red-500">×</button>
                                </div>
                             )}
                        </div>
                        {refinementCoords && (
                            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-brand-primary animate-pulse"></div>
                                <p className="text-xs font-bold text-indigo-700">Target Area Selected</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-auto pt-6 flex gap-3">
                        <button onClick={() => { setRefiningVariation(null); setRefinementCoords(null); setRefinementPrompt(''); setRefinementReferenceImage(null); }} className="flex-1 py-4 font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors">Cancel</button>
                        <button onClick={handleRefineVariation} className="flex-1 py-4 bg-brand-primary hover:bg-brand-secondary text-white font-black rounded-xl shadow-lg transition-all">Apply Changes</button>
                    </div>
                 </div>
            </div>
        </div>
    );
  };

  const renderBranchingOverlay = () => {
    if (!branchingVariation) return null;
    return (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4 sm:p-8 animate-fade-in">
            <div className="bg-white w-full max-w-6xl h-[90vh] rounded-[2.5rem] shadow-2xl flex overflow-hidden animate-scale-in">
                 <div className="w-2/3 bg-slate-100 relative p-8 flex flex-col">
                    <div className="absolute top-6 left-6 z-10 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm border border-slate-200">
                         <p className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                            <SparklesIcon className="w-4 h-4 text-brand-primary" /> 
                            Iterating on Concept
                         </p>
                    </div>
                    <div className="flex-grow relative rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-50">
                        <img 
                            src={isImageAdVariation(branchingVariation.variation) ? branchingVariation.variation.imageUrl : ''} 
                            alt="Reference" 
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                        />
                    </div>
                 </div>
                 <div className="w-1/3 bg-white p-8 flex flex-col border-l border-slate-100">
                    <div className="mb-8">
                        <h3 className="text-2xl font-black text-slate-900 mb-2">Iterate & Branch</h3>
                        <p className="text-slate-500 text-sm">Create new variations based on this specific concept.</p>
                    </div>
                    
                    <div className="flex-grow space-y-6 overflow-y-auto pr-2 custom-scrollbar">
                        <div>
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Direction for new variants</label>
                            <textarea 
                                value={branchingPrompt}
                                onChange={(e) => setBranchingPrompt(e.target.value)}
                                placeholder="E.g. Keep this layout but try different color palettes for a summer vibe..."
                                className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-slate-700 font-bold outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 transition-all resize-none h-32"
                            />
                        </div>
                        <div>
                             <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Reference Image (Optional)</label>
                             <FileUpload 
                                onFileUpload={(f) => setBranchingReferenceImage(f)} 
                                fileType={FileType.IMAGE} 
                                multiple={false}
                             />
                             {branchingReferenceImage && (
                                <div className="mt-2 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-100 flex items-center justify-between">
                                    <span>{branchingReferenceImage.name}</span>
                                    <button onClick={() => setBranchingReferenceImage(null)} className="hover:text-red-500">×</button>
                                </div>
                             )}
                        </div>
                        <div>
                             <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Count: {branchingCount}</label>
                             <input 
                                type="range" min="1" max="4" value={branchingCount} 
                                onChange={(e) => setBranchingCount(parseInt(e.target.value))}
                                className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-brand-primary"
                            />
                        </div>

                        {isImageAdVariation(branchingVariation.variation) && (
                            <div className="pt-4 border-t border-slate-100">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h4 className="text-sm font-black text-slate-900">Animate Image</h4>
                                        <p className="text-xs text-slate-500">Convert this image into a short video clip.</p>
                                    </div>
                                    <button 
                                        onClick={() => setIsAnimateImage(!isAnimateImage)}
                                        className={`w-12 h-6 rounded-full transition-all duration-300 relative ${isAnimateImage ? 'bg-brand-primary' : 'bg-slate-200'}`}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${isAnimateImage ? 'left-7' : 'left-1'}`} />
                                    </button>
                                </div>
                                
                                {isAnimateImage && (
                                    <div className="animate-fade-in space-y-4">
                                        {hasApiKey === false && (
                                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                                <p className="text-[10px] font-bold text-amber-800 uppercase mb-1">Action Required</p>
                                                <p className="text-[11px] text-amber-700 leading-tight mb-2">Video generation requires a paid Google Cloud API key in shared environments.</p>
                                                <button 
                                                    onClick={handleOpenSelectKey}
                                                    className="text-[11px] font-black text-amber-900 underline hover:no-underline"
                                                >
                                                    Connect Google Cloud Project →
                                                </button>
                                            </div>
                                        )}
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Animation Instructions</label>
                                            <input 
                                                type="text"
                                                value={animationPrompt}
                                                onChange={(e) => setAnimationPrompt(e.target.value)}
                                                placeholder="E.g. Make the clouds move slowly..."
                                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-brand-primary transition-all"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="mt-auto pt-6 flex gap-3">
                        <button onClick={() => { setBranchingVariation(null); setBranchingPrompt(''); setBranchingReferenceImage(null); setIsAnimateImage(false); setAnimationPrompt('Animate this'); }} className="flex-1 py-4 font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors">Cancel</button>
                        <button onClick={handleBranchVariations} className="flex-1 py-4 bg-brand-primary hover:bg-brand-secondary text-white font-black rounded-xl shadow-lg transition-all">
                            {isAnimateImage ? 'Animate & Branch' : 'Generate Branch'}
                        </button>
                    </div>
                 </div>
            </div>
        </div>
    );
  };

  if (isAuthLoading) {
      return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400 font-bold">Loading Workspace...</div>;
  }

  if (!isAuthenticated) {
      return <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#fcfcfd] selection:bg-brand-primary/30 font-sans antialiased text-slate-900">
        <Navbar />
        <main className="w-full pt-28 pb-32">
            {error && (
                <div className="max-w-4xl mx-auto px-6 mb-8">
                    <div className="p-4 bg-red-50 text-red-600 text-sm font-bold rounded-2xl border border-red-100 flex items-center justify-between animate-fade-in shadow-sm">
                        <div className="flex items-center">
                            <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {error}
                        </div>
                        <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 transition-colors ml-4">
                            <CloseIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
            {appState === 'SELECT_AD_TYPE' && renderSelectAdType()}
            {appState === 'READY_TO_UPLOAD' && (selectedAdType === FileType.IMAGE || selectedAdType === FileType.VIDEO ? renderCreateUploader() : renderAnalyzeUploader())}
            {appState === 'GENERATING' && renderGenerating()}
            {appState === 'STRATEGY_GENERATED' && renderBlueprints()}
            {appState === 'RESULTS_SHOWN' && selectedAdType === FileType.AVATAR_ANALYSIS && renderAvatarResults()}
            {appState === 'RESULTS_SHOWN' && selectedAdType !== FileType.AVATAR_ANALYSIS && (
                <div className="px-6 max-w-[1600px] mx-auto animate-fade-in">
                    <AdVariationsDisplay 
                        originalFilePreviews={batchFiles.map(file => URL.createObjectURL(file))}
                        fileType={selectedAdType!} 
                        variations={variations}
                        onImageClick={setSelectedImageUrl}
                        namingTemplate={namingTemplate}
                        onRefine={(variation, index) => setRefiningVariation({ variation, index })}
                        onBranch={(variation, index) => {
                            setBranchingVariation({ variation, index });
                            setIsAnimateImage(false);
                            setAnimationPrompt('Animate this');
                        }}
                        onRevert={handleRevert}
                        onUpdateVariation={handleUpdateVariation}
                        userPrompt={userPrompt}
                        aggroLevel={aggroLevel}
                        similarityLevel={similarityLevel}
                        sourceIsVideo={selectedAdType === FileType.VIDEO} 
                        onGenerateVideo={handleGenerateVideo}
                        onProgress={setLoadingProgress}
                        onDownloadSingle={(v, i) => {
                            const link = document.createElement('a');
                            const baseName = (namingTemplate || "variation").replace('#', (i + 1).toString());
                            if (isImageAdVariation(v)) { 
                              link.href = v.imageUrl; 
                              link.download = `${baseName}.png`; 
                            }
                            else if (isVideoAdVariation(v)) { 
                              link.href = v.videoUrl || ""; 
                              link.download = `${baseName}.mp4`; 
                            }
                            link.click();
                        }}
                    />
                    <div className="mt-24 flex flex-col items-center gap-6">
                        <button onClick={handleReset} className="bg-white border-2 border-slate-200 text-slate-800 font-black py-6 px-12 rounded-[1.5rem] flex items-center gap-4 hover:bg-slate-50 shadow-xl group"><ResetIcon className="w-6 h-6 group-hover:rotate-180 transition-transform" /> New Sprint</button>
                    </div>
                </div>
            )}
        </main>
        {selectedImageUrl && <ImageModal imageUrl={selectedImageUrl} onClose={() => setSelectedImageUrl(null)} />}
        {renderRefinementOverlay()}
        {renderBranchingOverlay()}
        <style>{`
          @keyframes progress-ind { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
          .animate-progress-ind { animation: progress-ind 2s infinite ease-in-out; }
          .animate-bounce-subtle { animation: bounce-subtle 3s infinite ease-in-out; }
          @keyframes bounce-subtle { 0%, 100% { transform: translate(-50%, 0); } 50% { transform: translate(-50%, -10px); } }
          input[type=range]::-webkit-slider-thumb {
            -webkit-appearance: none; height: 28px; width: 28px; border-radius: 14px; background: #4f46e5; cursor: pointer; border: 4px solid white; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
          }
        `}</style>
    </div>
  );
};

export default App;
