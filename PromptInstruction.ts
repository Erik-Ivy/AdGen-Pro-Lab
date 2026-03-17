
/*
You are a world-class senior frontend engineer. Your task is to build a robust, single-page React application called "AI Ad Variation Generator". This app allows marketing teams to upload image assets and generate high-performing ad variations using Google's Gemini models.

### Tech Stack & Style
- **Framework:** React 19 (Functional Components, Hooks).
- **Styling:** Tailwind CSS (via CDN).
- **Icons:** SVG icons (Heroicons style).
- **API SDK:** `@google/genai` (Google GenAI SDK).
- **Theme:** 
  - **Light Theme:** Background `slate-50` with subtle radial gradients (indigo/sky) and a faint grid pattern.
  - **Colors:** Primary `#4f46e5`, Secondary `#3730a3`, Text `slate-900`.
  - **UI:** Clean, white cards with shadows, rounded corners, and smooth fade-in/slide-up animations.

### Core Features & Architecture

1.  **Ad Type Selection (Home Screen):**
    - Display 2 large, card-style buttons for different workflows:
      1.  **Image Ad:** Generate image variations + copy (Headline, Body, CTA).
      2.  **Targeted Image Edit:** User highlights a specific region of an image to modify.

2.  **File Upload:**
    - Component: `FileUpload`.
    - Functionality: Drag-and-drop or click-to-upload.
    - Logic: Validate file types (Image only). Use a hidden `input` ref triggered by a `div` click to ensure reliability.

3.  **Configuration & Preview Screen:**
    - Display a preview of the uploaded asset.
    - **Image Highlighter (for Targeted Image mode):**
      - Component: `ImageHighlighter`.
      - Allow drawing a bounding box over the image.
      - Output normalized coordinates (0-1000 scale) for `ymin`, `xmin`, `ymax`, `xmax`.
    - **Form Inputs:**
      - Variation Count (1-10).
      - Naming Template (e.g., `#-campaign-name`).
      - User Prompt (Goal/Instruction).

4.  **Generation Logic (`geminiService.ts`):**
    - **API Key:** Use `process.env.GEMINI_API_KEY`.
    - **Retry Logic:** Implement exponential backoff for `429` or `Quota Exceeded` errors.
    - **Image Generation:** 
      - Model: `gemini-2.5-flash-image`.
      - Prompt: Combine user prompt + optional highlight coordinates (`FOCUS REGION: Bounding Box [...]`).
      - Output: Base64 image.
      - **Text Generation:** After image generation, call `gemini-2.5-flash` with `responseSchema` (JSON) to generate matching Headline, Body, and CTA.

5.  **Results Display:**
    - Component: `AdVariationsDisplay`.
    - Layout: Grid view. Left column = Original Asset (sticky). Right column = Scrollable list of `VariationCard`s.
    - **Variation Card:**
      - Show image, Headline, Body, CTA. Click image to open in Modal.
    - **Actions:** 
      - "Download Ad" button (downloads asset with correct naming).
      - "Generate More" section at the bottom to append to the list.
      - "Restart" button to clear state.

### Specific Implementation Details

- **`App.tsx`:** Manage state machine (`SELECT_AD_TYPE`, `READY_TO_UPLOAD`, `GENERATING`, `RESULTS_SHOWN`).
- **Icons:** Use functional components returning SVGs.

### Example Code Snippets

**Image Highlighting Logic:**
```typescript
// Convert mouse coordinates to 0-1000 scale
const coords = {
  xmin: Math.round((x1 / width) * 1000),
  xmax: Math.round((x2 / width) * 1000),
  ymin: Math.round((y1 / height) * 1000),
  ymax: Math.round((y2 / height) * 1000),
};
```

**JSON Schema for Ad Copy:**
```typescript
const schema = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING },
    body: { type: Type.STRING },
    cta: { type: Type.STRING },
  },
  required: ["headline", "body", "cta"],
};
```

Ensure the code is robust, handles API errors gracefully, and provides feedback (loading states/progress messages) to the user during long generation tasks.
*/
