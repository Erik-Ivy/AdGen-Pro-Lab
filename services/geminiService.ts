
import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { AdVariation, FileType, ImageAdVariation, VideoAdVariation, HighlightCoordinates, CreativeBlueprint, VideoMode, AvatarAnalysis } from '../types';

let runtimeConfig = {
    API_KEY: '',
    GEMINI_API_KEY: '',
    GOOGLE_API_KEY: '',
    VEO_MODEL_NAME: 'veo-3.1-fast-generate-preview'
};

export const setGeminiConfig = (config: Partial<typeof runtimeConfig>) => {
    runtimeConfig = { ...runtimeConfig, ...config };
};

export const getApiKey = () =>
    runtimeConfig.API_KEY ||
    runtimeConfig.GEMINI_API_KEY ||
    runtimeConfig.GOOGLE_API_KEY ||
    (import.meta.env.VITE_GEMINI_API_KEY as string) ||
    '';
const getVeoModel = () => runtimeConfig.VEO_MODEL_NAME || 'veo-3.1-fast-generate-preview';

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = (reader.result as string).split(',')[1];
      resolve(result);
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Extracts a sequence of frames from a video file to allow analysis of long videos
 * without hitting the 20MB request limit.
 */
const getVideoFrames = (file: File, frameCount: number = 12): Promise<{ base64Data: string, mimeType: string }[]> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    let globalTimeoutId = setTimeout(() => {
        URL.revokeObjectURL(video.src);
        reject(new Error('Global timeout waiting for video frames'));
    }, 30000); // 30 seconds max for extraction

    video.onloadedmetadata = async () => {
      let duration = video.duration;
      if (!isFinite(duration) || duration === 0) {
          duration = 10; // Fallback duration if unknown
      }
      
      const frames: { base64Data: string, mimeType: string }[] = [];
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        clearTimeout(globalTimeoutId);
        URL.revokeObjectURL(video.src);
        return reject(new Error('Could not get canvas context'));
      }

      // Capture frames at intervals
      for (let i = 0; i < frameCount; i++) {
        const time = (duration / (frameCount + 1)) * (i + 1);
        video.currentTime = time;
        
        await new Promise((res) => {
          let timeoutId: any;
          const onSeeked = () => {
            clearTimeout(timeoutId);
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7); // 0.7 quality to save space
            frames.push({ 
              base64Data: dataUrl.split(',')[1], 
              mimeType: 'image/jpeg' 
            });
            video.removeEventListener('seeked', onSeeked);
            res(true);
          };
          
          timeoutId = setTimeout(() => {
              video.removeEventListener('seeked', onSeeked);
              res(true); // Skip frame on timeout
          }, 3000);
          
          video.addEventListener('seeked', onSeeked);
        });
      }

      clearTimeout(globalTimeoutId);
      URL.revokeObjectURL(video.src);
      resolve(frames);
    };

    video.onerror = () => {
      clearTimeout(globalTimeoutId);
      URL.revokeObjectURL(video.src);
      reject(new Error('Error loading video file for frame extraction.'));
    };
    
    video.src = URL.createObjectURL(file);
  });
};

const getVideoFirstFrameBase64 = (file: File): Promise<{ base64Data: string, mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    let timeoutId = setTimeout(() => {
        URL.revokeObjectURL(video.src);
        reject(new Error('Timeout waiting for video frame'));
    }, 10000);

    video.onloadedmetadata = () => {
      video.currentTime = 0.01;
    };

    video.onseeked = () => {
      clearTimeout(timeoutId);
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(video.src);
        return reject(new Error('Could not get canvas context'));
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg');
      const base64Data = dataUrl.split(',')[1];
      resolve({ base64Data, mimeType: 'image/jpeg' });
      URL.revokeObjectURL(video.src);
    };

    video.onerror = (e) => {
      clearTimeout(timeoutId);
      URL.revokeObjectURL(video.src);
      reject(new Error('Error loading video file for frame extraction.'));
    };
    
    video.src = URL.createObjectURL(file);
  });
};

const DR_FRAMEWORK_INSTRUCTION = `
    ACT AS A LEGENDARY DIRECT RESPONSE COPYWRITER & MARKETING PSYCHOLOGIST.
    Synthesize these three foundational frameworks to generate the output:

    1. EUGENE SCHWARTZ (Breakthrough Advertising):
       - Awareness Level: Target Problem-Aware or Solution-Aware unless specified.
       - Unique Mechanism: Explain WHY it works differently (The "Reason Why").
       - Sophistication: If Aggro is high, assume Stage 4/5 market (avoid basic claims, use mechanism).

    2. DREW ERIC WHITMAN (Cashvertising):
       - Life Force 8 (LF8): Tap into survival, enjoyment, freedom from fear, or social approval.
       - Extreme Specificity: Use exact numbers (e.g., "52 lbs" not "weight", "$297" not "cheap").
       - Visual Imagery: Use sensory language (hearing, feeling, seeing).

    3. ROBERT CIALDINI (Principles of Influence):
       - Social Proof & Authority: Imply consensus or science.
       - Scarcity & Unity: Use psychological timers or "us vs them" identity.

    CRITICAL NEGATIVE CONSTRAINTS:
    - NEVER mention "FDA approved", "FDA cleared", or any government agency/approval.
    - NEVER imply government endorsement.

    SCORING REQUIREMENT:
    You must assign a 'performanceScore' (1.0 - 10.0) to each variation.
    - 10 = Perfectly hits LF8, Mechanism, and Specificity with high impulse.
    - 1 = Generic, boring, no psychological triggers.
`;

const IMAGE_PROMPT_STRUCTURE = `
    For photorealistic results, structure the image description considering these elements:
    - SUBJECT: Detailed description (age, ethnicity, presence), specific features (hair, face, build, attire).
    - POSE: Natural stance, orientation, interaction with surroundings.
    - ENVIRONMENT: Specific location, background details, depth of field.
    - CAMERA: Shot type (e.g., Medium shot), angle (e.g., Eye-level), framing.
    - LIGHTING: Type (e.g., Natural daylight), quality (e.g., Warm afternoon sunlight, soft shadows).
    - MOOD & EXPRESSION: Specific emotion, gaze direction, overall atmosphere.
    - STYLE & REALISM: Photorealistic, natural skin texture, authentic details, no artificial smoothing.
    - COLORS & TONE: Color palette, contrast levels.
`;

const STORY_AD_INSTRUCTION = `
    PRIMARY DIRECTIVE (90% WEIGHT): BEHAVIORAL SCIENCE & STORYTELLING FRAMEWORK
    
    Focus on engineering the psychological response rather than just focusing on aesthetics. Successful AI UGC is built using a specific framework that prioritizes CURIOSITY FIRST, NARRATIVE SECOND, and THE PRODUCT LAST.
    
    Objective: Generate a high-performance AI UGC video using JSON-level technical directives to avoid the "uncanny valley" effect.
    
    1. CONSUMER ARCHETYPE & PSYCHOLOGY:
       - Motivation Bucket: Focus on one: Avoid Pain, Gain Confidence, Status/Envy, Love/Belonging, or Convenience/Peace.
       - Aesthetic Goal: Ensure attainable relatability. The character should not look like a "perfect model" but rather someone "within arms reach" to build trust.
    
    2. ENVIRONMENT & TECHNICAL DIRECTIVES:
       - Environment First: Determine the environment first. It dictates cadence and tonality (e.g., Car = authentic/intimate; Kitchen = relatable/family).
       - Initial Hook (Curiosity): Start with an organic, unforced interaction (e.g., street interview, stranger compliment, doing a mundane task) to disarm the viewer.
       - Tonality & Pacing: Match clips to high-energy audio beats.
       - Micro-Directives: MANDATORY. Include micro-expressions, subtle hesitations, and confidence cues in the visual descriptions to engineer trust.
    
    3. STORYTELLING NARRATIVE (THE 5-STEP FORMULA):
       Step 1: Relatable Scenario. Put the target audience's life on display immediately.
       Step 2: Character Building. Show character seeking transformation/improvement BEFORE mentioning product.
       Step 3: Progression. Show momentum and journey, not just a static "before and after".
       Step 4: Product Introduction. Introduce the product as the catalyst that helped achieve the goal.
       Step 5: The Grand Reveal. Final payoff showing character at their best, sparking curiosity.
    
    KEY INSIGHTS:
    - Character Congruency: Use the same person with the same energy across clips.
    - Avoid "Hard Selling": Use a "Curious Ad" framework. Talk about benefits in organic settings (hike, grocery store) without explicit "salesman" energy.
    - Behavioral Science over Aesthetics: Engineering reactions (e.g. micro-hesitations) is what separates "trash" AI outputs from high-scaling ads.

    CRITICAL NEGATIVE CONSTRAINTS:
    - NEVER mention "FDA approved", "FDA cleared", or any government agency/approval.
    - NEVER imply government endorsement.

    SCORING REQUIREMENT:
    You must assign a 'performanceScore' (1.0 - 10.0) based primarily on how well the story triggers the Motivation Bucket and follows the 5-Step Formula.
`;

export const regenerateSceneVisuals = async (
    currentScenes: any[],
    summary: string,
    character: string,
    style: string
): Promise<any[]> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("Gemini API key not set. Please add GOOGLE_API_KEY or GEMINI_API_KEY to your Secrets or select a key.");
    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `
    You are a professional Video Director.
    
    UPDATED CONTEXT:
    - Strategic Angle: ${summary}
    - Character: ${character}
    - Video Style: ${style}
    
    CURRENT SCENE LIST (JSON):
    ${JSON.stringify(currentScenes, null, 2)}
    
    TASK:
    Rewrite the 'visual' description field for EVERY scene to ensure it perfectly matches the NEW Character and Style defined above.
    - If the character changed, update the visual to describe the new character performing the action.
    - If the style changed, update the lighting/camera details in the visual.
    - Keep the 'script', 'duration', and 'scene' number exactly the same. Only modify the 'visual' text.
    
    OUTPUT:
    Return ONLY valid JSON array.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: prompt }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        scene: { type: Type.NUMBER },
                        visual: { type: Type.STRING },
                        script: { type: Type.STRING },
                        duration: { type: Type.NUMBER }
                    },
                    required: ["scene", "visual", "script", "duration"]
                }
            }
        }
    });

    return JSON.parse(response.text || '[]');
};

export const generateCreativeBlueprints = async (
    assets: File[],
    performanceData: File[],
    aggroLevel: number,
    similarityLevel: number,
    type: FileType,
    onProgress: (p: string) => void,
    userPrompt?: string,
    noDepthOfField: boolean = true
): Promise<CreativeBlueprint[]> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("Gemini API key not set. Please add GOOGLE_API_KEY or GEMINI_API_KEY to your Secrets or select a key.");
    const ai = new GoogleGenAI({ apiKey });
    
    onProgress("Optimizing video assets for analysis...");
    const assetParts: any[] = [];
    for (const f of assets) {
        if (f.type.startsWith('video/')) {
            const frames = await getVideoFrames(f, 8); // Extract 8 frames for batch analysis
            frames.forEach(frame => {
                assetParts.push({ inlineData: { data: frame.base64Data, mimeType: frame.mimeType } });
            });
        } else {
            const b64 = await fileToBase64(f);
            assetParts.push({ inlineData: { data: b64, mimeType: f.type } });
        }
    }

    const perfParts = await Promise.all(performanceData.map(async f => {
        const b64 = await fileToBase64(f);
        return { inlineData: { data: b64, mimeType: f.type } };
    }));

    const isLandingPage = type === FileType.LANDING_PAGE_ANALYSIS;
    const modeDescription = isLandingPage ? "landing pages" : "advertisements";
    
    const role = isLandingPage 
      ? "world-class Conversion Rate Optimization (CRO) Expert" 
      : "elite Growth Strategist and Ad Architect";

    const vanillaPrompt = isLandingPage 
      ? "Focus on establishing immediate trust, a singular focused conversion goal, and clear benefit-driven information hierarchy. Avoid generic homepage fluff."
      : "Generate clean, professional, and trustworthy ideas. Focus on clarity, logical benefits, and brand safety.";
      
    const aggroPrompt = isLandingPage 
      ? "Focus on high-intensity psychological triggers, aggressive direct-response copy, scarcity timers, and 'above-the-fold' lead magnets that force action."
      : "Generate disruptive, high-urgency, and bold-claim ideas. Use deep psychological triggers, aggressive pattern interrupts, and scarcity.";
    
    const styleInstruction = aggroLevel > 60 ? aggroPrompt : vanillaPrompt;
    
    const similarityInstruction = similarityLevel > 70 
      ? "BE REVOLUTIONARY. Factor in the context and visual style of the batch but seek to radically deviate from existing angles and layout conventions. Challenge the status quo with completely new creative narratives."
      : similarityLevel < 30
        ? "STAY ITERATIVE. Maintain strict adherence to the existing context, ad angles, and visual style observed in the provided batch. Focus on micro-pivots and logical extensions of current winners."
        : "BE EVOLUTIVE. Synthesize the core context and visual identity of the batch but introduce fresh structural variations and evolved narrative angles.";

    const temp = 0.1 + (aggroLevel / 100) * 0.9;

    const prompt = `You are an ${role}. 
    ${DR_FRAMEWORK_INSTRUCTION}

    TASK: 
    1. Analyze the provided ${modeDescription} and performance data. Note: For videos, you are provided with a sequence of frames representing the duration.
    2. Use Google Search to find current high-converting direct-response (DR) patterns and hooks in this specific niche.
    3. Synthesize findings into 10 new strategic directions.
    
    ${userPrompt ? `USER GUIDANCE: ${userPrompt}\n` : ''}

    ${isLandingPage ? 'CRITICAL: Create focused landing page architectures (Hero hook, Social Proof, Benefits, One Big CTA).' : ''}
    
    ${!isLandingPage ? `For the 'visualHook', provide a detailed, photorealistic description using these categories:
    - SUBJECT: Age, ethnicity, presence, specific features (hair, face, build, attire).
    - POSE: Natural stance, orientation, interaction.
    - ENVIRONMENT: Location, background, depth.
    - CAMERA: Shot type, angle, framing. ${noDepthOfField ? 'CRITICAL: Use "No depth of field". Ensure all elements from foreground to background are sharp and in focus. No background blur.' : ''}
    - LIGHTING: Type, quality.
    - MOOD & EXPRESSION: Emotion, gaze, atmosphere.
    - STYLE & REALISM: Photorealistic details.
    - COLORS & TONE: Palette, contrast.` : ''}

    STYLE SETTING (Intensity): ${aggroLevel}/100. ${styleInstruction}
    SIMILARITY TARGET (Fidelity to Batch): ${similarityLevel}/100. ${similarityInstruction}
    
    Return EXACTLY 10 blueprints in JSON format. Each blueprint MUST include a specific high-converting CTA recommendation.`;

    const blueprintSchema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                angle: { type: Type.STRING, description: isLandingPage ? "The single conversion-focused hook" : "The core narrative hook" },
                psychology: { type: Type.STRING, description: "The direct-response trigger used" },
                visualHook: { type: Type.STRING, description: isLandingPage ? "Description of the Direct-Response desktop layout (Hero focus)" : "A high-impact description of the visual scene (Use the Subject/Pose/Environment/Camera/Lighting/Mood/Style/Colors structure)" },
                copy: { type: Type.STRING, description: isLandingPage ? "The 'One Big Headline' for the Hero section" : "Primary high-converting headline or lead text" },
                cta: { type: Type.STRING, description: "Recommended high-converting Call To Action (e.g. 'Get My Quote', 'Check Eligibility')" },
                searchInsights: { type: Type.STRING, description: "Market data or competitive hooks found via search" }
            },
            required: ["id", "title", "angle", "psychology", "visualHook", "copy", "cta"]
        }
    };

    onProgress("Engaging Search Grounding & Strategy Logic...");
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts: [...assetParts, ...perfParts, { text: prompt }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: blueprintSchema,
            temperature: temp,
            tools: [{ googleSearch: {} }]
        }
    });

    return JSON.parse(response.text || '[]');
};

export const generateAvatarAnalysis = async (
    assets: File[],
    onProgress: (p: string) => void,
    userPrompt?: string
): Promise<AvatarAnalysis> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("Gemini API key not set. Please add GOOGLE_API_KEY or GEMINI_API_KEY to your Secrets or select a key.");
    const ai = new GoogleGenAI({ apiKey });
    
    onProgress("Scanning video narrative for persona traits...");
    const assetParts: any[] = [];
    for (const f of assets) {
        if (f.type.startsWith('video/')) {
            const frames = await getVideoFrames(f, 10);
            frames.forEach(frame => {
                assetParts.push({ inlineData: { data: frame.base64Data, mimeType: frame.mimeType } });
            });
        } else {
            const b64 = await fileToBase64(f);
            assetParts.push({ inlineData: { data: b64, mimeType: f.type } });
        }
    }

    const prompt = `
    ACT AS A WORLD-CLASS CONSUMER PSYCHOLOGIST AND DIRECT RESPONSE MARKET RESEARCHER.
    
    YOUR TASK:
    Analyze the provided high-performing creative assets. Note: For videos, you have a sequence of frames spanning the duration.
    Reverse-engineer the specific "Avatar" that resonates with this content. 
    Who is the person clicking? What is keeping them up at night? What conversation is happening in their head?
    
    ${userPrompt ? `ADDITIONAL CONTEXT FROM USER: "${userPrompt}"` : ''}
    
    Use frameworks like the "Life Force 8" (Whitman) and "Hierarchy of Needs" (Maslow) to dig deep.
    Do NOT just describe the ad. Describe the *PERSON* who clicks the ad.
    
    OUTPUT REQUIREMENTS:
    Return a SINGLE JSON object containing a detailed profile of this Avatar.
    `;

    const schema = {
        type: Type.OBJECT,
        properties: {
            personaTitle: { type: Type.STRING, description: "A catchy name for this archetype (e.g. 'The Overwhelmed Supermom', 'The Frustrated DIYer')" },
            quote: { type: Type.STRING, description: "A direct quote representing their internal monologue right before clicking." },
            demographics: { type: Type.STRING, description: "Age, gender, location, occupation, income bracket." },
            psychographics: { type: Type.STRING, description: "Values, lifestyle, personality traits, interests, and beliefs." },
            painPoints: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "Deep-seated frustrations, daily annoyances, and acute pains they want to solve."
            },
            fears: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "What are they afraid of happening if they don't solve this problem? (e.g. 'Falling behind', 'Looking foolish')"
            },
            internalMonologue: { type: Type.STRING, description: "A paragraph describing the stream of consciousness in their head. Their doubts, hopes, and rationalizations." },
            whyTheyClicked: { type: Type.STRING, description: "Analyze the specific visual or copy elements in the assets that triggered their psychological response." }
        },
        required: ["personaTitle", "quote", "demographics", "psychographics", "painPoints", "fears", "internalMonologue", "whyTheyClicked"]
    };

    onProgress("Analyzing consumer psychology...");
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts: [...assetParts, { text: prompt }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: schema,
            temperature: 0.7 
        }
    });

    return JSON.parse(response.text || '{}');
};

export const generateVisualsFromBlueprint = async (
    blueprint: CreativeBlueprint,
    type: FileType,
    onProgress: (p: string) => void,
    similarityLevel: number = 50,
    highlightCoords: HighlightCoordinates | null = null,
    sourceBase64: string | null = null,
    refinementPrompt: string | null = null,
    referenceImage: File | null = null,
    noDepthOfField: boolean = true
): Promise<AdVariation> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("Gemini API key not set. Please add GOOGLE_API_KEY or GEMINI_API_KEY to your Secrets or select a key.");
    const ai = new GoogleGenAI({ apiKey });
    
    const isLandingPage = type === FileType.LANDING_PAGE_ANALYSIS;
    onProgress(`Rendering ${isLandingPage ? 'Direct-Response Page' : 'Concept'} for: ${blueprint.title}`);
    
    const parts: any[] = [];
    if (sourceBase64) {
      parts.push({ inlineData: { data: sourceBase64.split(',')[1], mimeType: "image/png" } });
    }

    if (referenceImage) {
        const b64 = await fileToBase64(referenceImage);
        parts.push({ inlineData: { mimeType: referenceImage.type, data: b64 } });
        parts.push({ text: "Use the attached image as a visual reference for style or content." });
    }

    const styleFidelityInstruction = similarityLevel < 30 
      ? "Strictly mimic the visual style, lighting, and color palette of the provided source image." 
      : similarityLevel > 70 
        ? "Feel free to radically reimagine the visual aesthetic, lighting, and composition while staying true to the blueprint's goal."
        : "Balance the visual style to be a fresh evolution of the source assets.";

    let imgPrompt = isLandingPage 
      ? `Generate a comprehensive high-converting desktop direct-response landing page screenshot. 
         Title: ${blueprint.title}
         Core Hook: ${blueprint.angle}
         Visual Layout Strategy: ${blueprint.visualHook}
         Main Headline to Feature: "${blueprint.copy}"
         Recommended CTA: "${blueprint.cta}"
         Style Instruction: ${styleFidelityInstruction}
         
         CRITICAL RULES:
         - Focused LANDING PAGE UI.
         - Clear Hero Section with headline and primary CTA.
         - Professional aesthetic with high fidelity UI elements.
         - Ensure all text on the page is perfectly legible, sharp, and typo-free.
         - NEVER mention "FDA approved" or government agencies.`
      : `Create a high-impact, professional marketing advertisement:
         ${IMAGE_PROMPT_STRUCTURE}
         
         Strategy Title: ${blueprint.title}
         Creative Angle: ${blueprint.angle}
         Visual Vision: ${blueprint.visualHook}
         Primary Text: ${blueprint.copy}
         Recommended CTA: ${blueprint.cta}
         Style Instruction: ${styleFidelityInstruction}
         ${noDepthOfField ? 'Visual Constraint: No depth of field. Ensure all elements are sharp and in focus. No background blur.' : ''}
         Aesthetics: Modern, premium, high-conversion.
         Important: Ensure any text in the ad is perfectly legible, sharp, and high-resolution.
         Negative Constraint: Do not mention FDA or government approval.`;

    if (highlightCoords) {
      imgPrompt += `\nFOCUS REGION: [ymin: ${highlightCoords.ymin}, xmin: ${highlightCoords.xmin}, ymax: ${highlightCoords.ymax}, xmax: ${highlightCoords.xmax}]`;
    }
    
    if (refinementPrompt) {
        imgPrompt += `\nSPECIFIC REFINEMENT: ${refinementPrompt}. Make sure the text in the refined area is clear and readable.`;
    }

    parts.push({ text: imgPrompt });

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts },
        config: {
            imageConfig: { 
                aspectRatio: isLandingPage ? "3:4" : "1:1", 
                imageSize: "1K" 
            }
        }
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!imagePart?.inlineData) throw new Error("Visual generation failed");

    return {
        headline: blueprint.title,
        body: `${blueprint.angle}\n\nPsychology: ${blueprint.psychology}`,
        cta: blueprint.cta,
        imageUrl: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`,
        performanceScore: 8.5 
    } as ImageAdVariation;
};

const adaptScriptForVeo = async (variation: VideoAdVariation, onProgress: (p: string) => void): Promise<string> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("Gemini API key not set. Please add GOOGLE_API_KEY or GEMINI_API_KEY to your Secrets or select a key.");
    const ai = new GoogleGenAI({ apiKey });
    
    onProgress("Optimizing script for 8-second video generation...");

    const prompt = `
        You are an expert AI Video Prompt Engineer.
        
        INPUT CONTEXT:
        Title: ${variation.title}
        Original Concept: ${variation.summary}
        Original Visual Instructions: ${variation.jsonInstructions}
        Character Context: ${variation.characterDescription || 'Not specified'}
        Style Context: ${variation.videoStyle || 'Not specified'}

        TASK:
        The original instructions might be for a longer video.
        Rewrite the visual instructions to fit exactly into a coherent, high-impact 8-second sequence (or less) for an AI video generator.
        - Incorporate the specific Character and Style details if provided.
        - Focus on the single most important visual hook.
        - Consolidate multiple scenes into one evolving shot if possible, or max 2 cuts.
        - Remove any text overlays or dialogue references. Focus purely on the visual action, lighting, and camera movement.
        - Make the description extremely detailed, cinematic, and photorealistic.
        
        OUTPUT FORMAT:
        Return ONLY valid JSON in this format:
        [
            { "scene": 1, "visual": "Detailed description..." }
        ]
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [{ text: prompt }] },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        scene: { type: Type.NUMBER },
                        visual: { type: Type.STRING }
                    },
                    required: ["scene", "visual"]
                }
            }
        }
    });
    
    return response.text || '[]';
};

export const generateVideoFromScript = async (
  variation: VideoAdVariation,
  onProgress: (p: string) => void
): Promise<string> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("Gemini API key not set. Please add GOOGLE_API_KEY or GEMINI_API_KEY to your Secrets or select a key.");
    const ai = new GoogleGenAI({ apiKey });

    const adaptedJson = await adaptScriptForVeo(variation, onProgress);
    
    const instructions = JSON.parse(adaptedJson);
    const visualStory = instructions.map((s: any) => `Scene ${s.scene}: ${s.visual}`).join('. Next, ');
    const prompt = `A cinematic, high-quality video sequence: ${visualStory}. Character: ${variation.characterDescription}. Style/Atmosphere: ${variation.videoStyle || variation.summary}. Audio Mix: strong_clear_dialogue_foreground. Audio Directive: Use strong, clear, high-volume voice audio with well-balanced dialogue that sits prominently in the mix.`;

    onProgress("Initializing Veo video generation...");
    
    let operation = await ai.models.generateVideos({
      model: getVeoModel(),
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '9:16' 
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      onProgress("Rendering video pixels (this may take a minute)...");
      operation = await ai.operations.getVideosOperation({operation: operation});
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("No video URI returned from Veo.");

    onProgress("Downloading generated video...");
    const response = await fetch(`${downloadLink}&key=${getApiKey()}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
};

const analyzeVideoContent = async (files: File[], onProgress: (p: string) => void): Promise<string> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("Gemini API key not set. Please add GOOGLE_API_KEY or GEMINI_API_KEY to your Secrets or select a key.");
    const ai = new GoogleGenAI({ apiKey });
    
    const parts: any[] = [];
    let hasVideo = false;

    for (const file of files) {
        if (file.type.startsWith('video/')) {
            hasVideo = true;
            try {
                 // Always use frames to avoid massive base64 payloads that crash the browser or API
                 const frames = await getVideoFrames(file, 6);
                 frames.forEach(frame => {
                    parts.push({ inlineData: { mimeType: frame.mimeType, data: frame.base64Data } });
                 });
            } catch (e) {
                 console.warn("Video frame extraction failed", e);
            }
        }
    }

    if (!hasVideo || parts.length === 0) return "";

    onProgress("Analyzing video transcript & context...");
    const prompt = `
        Analyze the provided video assets.
        1. Provide a detailed description of the visual context, action, and setting.
        2. If there is audio or speech, provide a transcript or summary of what is said.
        3. Identify the key marketing hooks and emotional triggers present.
    `;
    
    parts.push({ text: prompt });

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts },
        });
        return response.text || "";
    } catch (e) {
        console.error("Video analysis failed", e);
        return "";
    }
};

export const generateAdVariations = async (
  input: File[] | string | null,
  fileType: FileType,
  prompt: string,
  variationCount: number,
  onProgress: (progress: string) => void,
  highlightCoords: HighlightCoordinates | null = null,
  refinementPrompt: string | null = null,
  namingTemplate: string | null = null,
  aggroLevel: number = 50,
  similarityLevel: number = 50,
  videoLength: string | null = null,
  videoMode: VideoMode = 'hook',
  referenceImage: File | null = null,
  aspectRatio: string = '1:1',
  noDepthOfField: boolean = true
): Promise<AdVariation[]> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("Gemini API key not set. Please add GOOGLE_API_KEY or GEMINI_API_KEY to your Secrets or select a key.");
    const ai = new GoogleGenAI({ apiKey });
    
    const similarityInstruction = similarityLevel > 70 
      ? "Completely reimagine the style and composition while keeping the core subject. Radically evolve the context." 
      : similarityLevel < 30 
        ? "Strictly adhere to the original visual style and context. Only iterate on the requested angle." 
        : "Maintain core visual identity but explore fresh arrangements.";

    const aggroInstruction = aggroLevel > 70 
      ? "Make impact bold, aggressive, high-contrast. Use strong language." 
      : aggroLevel < 30 
        ? "Keep aesthetic soft, clean, professional. Use gentle, safe language." 
        : "Balance aesthetic to be engaging but trustworthy.";
    
    if (fileType === FileType.VIDEO) {
        let taskDescription = "";
        let contentParts: any[] = [];
        
        let videoAnalysisContext = "";
        if (input) {
            if (typeof input !== 'string') {
                onProgress("Sampling video sequences for analysis...");
                
                // Analyze video transcript/context if video files exist
                if (Array.isArray(input)) {
                    const videoFiles = input.filter(f => f.type.startsWith('video/'));
                    if (videoFiles.length > 0) {
                        videoAnalysisContext = await analyzeVideoContent(videoFiles, onProgress);
                    }
                }

                for (const file of input) {
                    if (file.type.startsWith('video/')) {
                        try {
                            const frames = await getVideoFrames(file, 6); // Sample fewer frames per video if multiple
                            frames.forEach(frame => {
                                contentParts.push({ inlineData: { mimeType: frame.mimeType, data: frame.base64Data } });
                            });
                        } catch (e) {
                            console.warn("Failed to get video frames", e);
                        }
                    } else {
                        const b64 = await fileToBase64(file);
                        contentParts.push({ inlineData: { mimeType: file.type, data: b64 } });
                    }
                }
                taskDescription = "1. Analyze the attached sequence of frames and images representing the source assets (pacing, visual content, narrative, sentiment, character traits, and filming style).";
            } else {
                // Fallback for already processed string
                const videoB64 = input.split(',')[1];
                const videoMime = "image/png"; // Assume image if it's a string from a previous variation
                
                contentParts.push({ inlineData: { mimeType: videoMime, data: videoB64 } });
                taskDescription = "1. Analyze the attached reference image (product features, brand aesthetic, potential video hook points).";
            }
        } else {
             taskDescription = "1. Use the User Goal below as the sole creative direction.";
        }

        if (referenceImage) {
            const b64 = await fileToBase64(referenceImage);
            contentParts.push({ inlineData: { mimeType: referenceImage.type, data: b64 } });
            contentParts.push({ text: "Use the attached image as a visual reference for style or content." });
        }

        let frameworkInstruction = DR_FRAMEWORK_INSTRUCTION;
        
        if (videoMode === 'story') {
             frameworkInstruction = `
                ACT AS A MASTER STORYTELLER & BEHAVIORAL PSYCHOLOGIST.
                
                ${STORY_AD_INSTRUCTION}

                SECONDARY INFLUENCE (10% WEIGHT):
                Incorporate basic principles from the following Direct Response framework ONLY where they enhance the narrative flow. Do not let them override the Story/Relatability focus.
                ${DR_FRAMEWORK_INSTRUCTION}
             `;
        }

        const scriptPrompt = `
            ${frameworkInstruction}
            
            TASK:
            ${taskDescription}
            ${videoAnalysisContext ? `CONTEXT FROM SOURCE VIDEO (Transcript & Visuals): ${videoAnalysisContext}` : ''}
            2. Generate ${variationCount} distinct video ad variations based on the user's goal: "${prompt}".
            
            ${input ? `3. CHARACTER ANALYSIS: Identify character traits from the visual reference.
            4. STYLE ANALYSIS: Identify filming style (UGC, Studio, etc) that matches the reference aesthetic.` : ''}

            PARAMETERS:
            - Aggressiveness: ${aggroLevel}/100 (${aggroInstruction})
            - Creativity/Deviation: ${similarityLevel}/100 (${similarityInstruction})
            ${videoLength ? `- Target Video Duration: ${videoLength} (CRITICAL: Ensure the script and scene breakdown matches this duration)` : ''}

            OUTPUT REQUIREMENTS:
            Return a JSON array where each object contains:
            - title: A catchy internal title for the variation.
            - summary: A clear summary of the new angle, content changes, and visual style.
            - characterDescription: Specific details about the persona/character (e.g., 'Hispanic male, 30s, casual streetwear').
            - videoStyle: Specific details about the video style (e.g., 'UGC influencer selfie style, shaky handheld motion, warm lighting').
            - script: The complete script (Voiceover/Dialogue) for the video.
            - duration: Estimated video length (e.g. '15s', '30s'). ${videoLength ? `TARGET LENGTH: ${videoLength}.` : ''}
            - performanceScore: A number (1-10) estimating likelihood of success based on the framework.
            - jsonInstructions: A detailed, valid JSON string (stringified) that describes the video. 
              Format: { "audio_mix": "strong_clear_dialogue_foreground", "audio_directive": "Use strong, clear, high-volume voice audio with well-balanced dialogue that sits prominently in the mix.", "scenes": [{"scene": 1, "visual": "...", "script": "...", "duration": 3}] }.
              CRITICAL RULES FOR JSON INSTRUCTIONS:
              1. You MUST include the 'script' (dialogue/VO) for that scene in the JSON object.
              2. Do NOT include any 'caption', 'subtitle', or 'overlay_text' fields.
              3. In the 'visual' field for EVERY scene, explicitly mention the character and style traits identified.
              4. In the 'visual' field for EVERY scene, append this exact text: "Do not generate captions of the script on the video. Do not generate music in the video. ${noDepthOfField ? 'No depth of field. All elements must be sharp and in focus. No background blur.' : ''}"
              5. DURATION & SCRIPT SYNC (CRITICAL):
                 - The 'duration' for each scene MUST match the natural reading speed of the 'script' (approx 2.5 words per second).
                 - Do NOT add silent filler time. If the script is short, the duration must be short.
                 - To meet the Target Video Duration (${videoLength || 'N/A'}), you MUST write enough script content.
                 - ${videoLength ? `The sum of scene durations must equal '${videoLength}'.` : ''}
        `;
        contentParts.push({ text: scriptPrompt });

        onProgress(`Synthesizing ${variationCount} ${videoMode === 'story' ? 'Story' : 'Video'} Variations...`);
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: { parts: contentParts },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            summary: { type: Type.STRING },
                            characterDescription: { type: Type.STRING, description: "Detailed traits of the persona" },
                            videoStyle: { type: Type.STRING, description: "Detailed filming style and camera motion" },
                            script: { type: Type.STRING },
                            duration: { type: Type.STRING, description: "Estimated video length (e.g. '15s')" },
                            performanceScore: { type: Type.NUMBER, description: "Direct Response Performance Score (1-10)" },
                            jsonInstructions: { type: Type.STRING, description: "Stringified JSON of detailed scene instructions including script/dialogue per scene. NO CAPTIONS. NO MUSIC." }
                        },
                        required: ["title", "summary", "characterDescription", "videoStyle", "script", "jsonInstructions", "duration", "performanceScore"]
                    }
                }
            }
        });

        const variations = JSON.parse(response.text || '[]');
        return variations.map((v: any, i: number) => ({
            title: namingTemplate ? namingTemplate.replace('#', (i + 1).toString()) : v.title,
            summary: v.summary,
            characterDescription: v.characterDescription,
            videoStyle: v.videoStyle,
            script: v.script,
            jsonInstructions: v.jsonInstructions,
            duration: v.duration,
            performanceScore: v.performanceScore
        }));
    }

    const assetParts: any[] = [];
    if (input) {
        if (typeof input === 'string') {
            const base64Data = input.split(',')[1];
            assetParts.push({ inlineData: { mimeType: "image/png", data: base64Data } });
        } else {
            onProgress("Processing reference assets...");
            for (const file of input) {
                if (file.type.startsWith('video/')) {
                    try {
                        const frame = await getVideoFirstFrameBase64(file);
                        assetParts.push({ inlineData: { mimeType: frame.mimeType, data: frame.base64Data } });
                    } catch (e) {
                        console.warn("Failed to get video first frame", e);
                    }
                } else {
                    const b64 = await fileToBase64(file);
                    assetParts.push({ inlineData: { mimeType: file.type, data: b64 } });
                }
            }
        }

        if (referenceImage) {
            const b64 = await fileToBase64(referenceImage);
            assetParts.push({ inlineData: { mimeType: referenceImage.type, data: b64 } });
            assetParts.push({ text: "Use the attached image as a visual reference for style or content." });
        }
    }
    
    let videoContext = "";
    if (input && Array.isArray(input)) {
        const videoFiles = input.filter(f => f.type.startsWith('video/'));
        if (videoFiles.length > 0) {
            videoContext = await analyzeVideoContent(videoFiles, onProgress);
        }
    }

    let results: AdVariation[] = [];

    for (let i = 0; i < variationCount; i++) {
        onProgress(`Crafting Variation ${i+1}/${variationCount}...`);
        let imgPrompt = `
          ${DR_FRAMEWORK_INSTRUCTION}
          ${IMAGE_PROMPT_STRUCTURE}
          
          TASK:
          Generate a high-converting ad image variation. 
          User Goal: ${prompt}. 
          ${videoContext ? `VIDEO CONTEXT (Use this to inform the image content): ${videoContext}` : ''}
          Style Instruction: ${similarityInstruction}. 
          Tone: ${aggroInstruction}. 
          ${noDepthOfField ? 'Visual Constraint: No depth of field. Ensure all elements from foreground to background are sharp and in focus. No background blur.' : ''}
          
          Ensure all text in the image is perfectly legible, sharp, and professional.
        `;
        
        const parts: any[] = [...assetParts];
        parts.push({ text: imgPrompt });
        
        const imageResponse = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: { parts },
            config: {
                imageConfig: { 
                    imageSize: '1K',
                    aspectRatio: aspectRatio as any
                }
            }
        });

        const newImagePart = imageResponse.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (newImagePart?.inlineData) {
            const textResponse = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: { parts: [{ inlineData: { mimeType: newImagePart.inlineData.mimeType, data: newImagePart.inlineData.data } }, { text: `
                    ${DR_FRAMEWORK_INSTRUCTION}
                    Generate catchy marketing copy for this image. 
                    Tone: ${aggroLevel > 70 ? "Bold" : "Professional"}. 
                    Calculate the Direct Response Performance Score (1-10) based on frameworks.
                    Include headline, body, cta, and performanceScore.` 
                }] },
                config: { 
                  responseMimeType: "application/json", 
                  responseSchema: {
                    type: Type.OBJECT,
                    properties: { 
                        headline: { type: Type.STRING }, 
                        body: { type: Type.STRING }, 
                        cta: { type: Type.STRING },
                        performanceScore: { type: Type.NUMBER }
                    },
                    required: ["headline", "body", "cta", "performanceScore"]
                }},
            });
            const textData = JSON.parse(textResponse.text || '{}');
            results.push({ 
                ...textData, 
                headline: namingTemplate ? namingTemplate.replace('#', (i + 1).toString()) : textData.headline, 
                imageUrl: `data:${newImagePart.inlineData.mimeType};base64,${newImagePart.inlineData.data}` 
            });
        }
    }
    return results;
};

export const generateVideoFromJSON = async (
  jsonInstructions: string,
  aspectRatio: '16:9' | '9:16',
  onProgress: (progress: string) => void,
  resolution: '720p' | '1080p' = '720p' // Default to 720p
): Promise<string> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("Gemini API key not set. Please add GOOGLE_API_KEY or GEMINI_API_KEY to your Secrets or select a key.");
    const ai = new GoogleGenAI({ apiKey });
    
    // Check if API key is selected for paid models
    if (typeof window !== 'undefined' && (window as any).aistudio?.hasSelectedApiKey) {
        if (!await (window as any).aistudio.hasSelectedApiKey()) {
            await (window as any).aistudio.openSelectKey();
        }
    }

    onProgress("Preparing video generation prompt...");
    const scenes = JSON.parse(jsonInstructions);
    
    // Construct the prompt for Veo model
    onProgress("Initiating video generation (this may take a few minutes)....");

    let operation = await ai.models.generateVideos({
        model: getVeoModel(),
        prompt: jsonInstructions,
        config: {
            numberOfVideos: 1,
            resolution: resolution,
            aspectRatio: aspectRatio,
        }
    });

    // Poll for completion
    let pollCount = 0;
    while (!operation.done) {
        onProgress(`Video generation in progress... (Attempt ${++pollCount})`);
        await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10 seconds
        operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
        throw new Error("Video generation failed: No download link received.");
    }

    onProgress("Fetching generated video...");
    // To fetch the video, append the Gemini API key to the `x-goog-api-key` header.
    const response = await fetch(downloadLink, {
        method: 'GET',
        headers: {
            'x-goog-api-key': getApiKey(),
        },
    });

    const blob = await response.blob();
    return URL.createObjectURL(blob);
};

export const animateImage = async (
  imageUrl: string,
  prompt: string,
  onProgress: (progress: string) => void
): Promise<string> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API_KEY not set");
    const ai = new GoogleGenAI({ apiKey });

    // Check if API key is selected for paid models
    if (typeof window !== 'undefined' && (window as any).aistudio?.hasSelectedApiKey) {
        if (!await (window as any).aistudio.hasSelectedApiKey()) {
            await (window as any).aistudio.openSelectKey();
        }
    }

    onProgress("Preparing image data...");
    
    let base64Data: string;
    let mimeType: string;

    if (imageUrl.startsWith('data:')) {
        const parts = imageUrl.split(',');
        base64Data = parts[1];
        mimeType = parts[0].split(';')[0].split(':')[1];
    } else {
        // Handle blob URLs or other formats
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        mimeType = blob.type;
        base64Data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                resolve(base64String.split(',')[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    onProgress("Initiating Veo animation...");
    let operation = await ai.models.generateVideos({
        model: getVeoModel(),
        prompt: prompt || "Animate this image with natural motion",
        image: {
            imageBytes: base64Data,
            mimeType: mimeType
        },
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: '9:16'
        }
    });

    let pollCount = 0;
    while (!operation.done) {
        pollCount++;
        await new Promise(resolve => setTimeout(resolve, 10000));
        onProgress(`Animating pixels... (Step ${pollCount})`);
        operation = await ai.operations.getVideosOperation({ operation: operation });
        
        if (operation.error) {
            throw new Error(`Animation failed: ${operation.error.message}`);
        }
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("Animation failed: No video link received from model.");

    onProgress("Finalizing video asset...");
    const response = await fetch(downloadLink, {
        method: 'GET',
        headers: {
            'x-goog-api-key': apiKey,
        },
    });

    if (!response.ok) {
        // Fallback to query param if header fails
        const fallbackResponse = await fetch(`${downloadLink}${downloadLink.includes('?') ? '&' : '?'}key=${apiKey}`);
        if (!fallbackResponse.ok) {
            throw new Error(`Failed to fetch video: ${fallbackResponse.statusText}`);
        }
        const blob = await fallbackResponse.blob();
        return URL.createObjectURL(blob);
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
};
