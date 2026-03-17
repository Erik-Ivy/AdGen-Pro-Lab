# AdArchitect: AI Image & Video Prompt Instructions

This document outlines the deep strategic frameworks and technical prompt structures used by AdArchitect to generate high-performance marketing assets.

---

## 1. The Core Marketing Psychology Framework
*Applied to both Image and Video generation.*

AdArchitect operates as a "Legendary Direct Response Copywriter & Marketing Psychologist." Every prompt is synthesized from three foundational frameworks:

### A. Eugene Schwartz (Breakthrough Advertising)
- **Awareness Levels:** Targets specific stages (Unaware, Problem-Aware, Solution-Aware).
- **Unique Mechanism:** Every asset must explain *why* the product works differently (The "Reason Why").
- **Sophistication:** Adjusts claims based on market saturation (Stage 1-5).

### B. Drew Eric Whitman (Cashvertising)
- **Life Force 8 (LF8):** Taps into survival, enjoyment of food/drink, freedom from fear, sexual companionship, comfortable living, social approval, and protection of loved ones.
- **Extreme Specificity:** Replaces generic terms with exact numbers and sensory details.
- **Visual Imagery:** Uses sensory language (hearing, feeling, seeing) to build a mental movie.

### C. Robert Cialdini (Principles of Influence)
- **Social Proof & Authority:** Implies consensus or scientific backing.
- **Scarcity & Unity:** Uses psychological timers or "us vs. them" identity markers.

---

## 2. The Image Generation Tool
**Model:** `gemini-3-pro-image-preview`

### Features & Functions
- **Creative Blueprints:** Generates 10 strategic directions before rendering, ensuring every image has a "Reason Why."
- **Visual Hook Structure:** Every image prompt follows a strict 8-point hierarchy:
    1. **SUBJECT:** Detailed age, ethnicity, presence, attire, and physical build.
    2. **POSE:** Natural stance and interaction with surroundings.
    3. **ENVIRONMENT:** Specific location and background depth.
    4. **CAMERA:** Shot type (Medium, Close-up), angle, and framing.
    5. **LIGHTING:** Quality and type (Natural daylight, soft shadows, warm golden hour).
    6. **MOOD:** Specific emotion and gaze direction.
    7. **STYLE:** Photorealistic, natural skin textures, no artificial smoothing.
    8. **COLORS:** Palette and contrast levels.
- **No Depth of Field Constraint:** A specialized toggle to ensure edge-to-edge sharpness, critical for product-focused ads.
- **Regional Refinement:** Allows targeting specific coordinates for inpainting and text correction.

### Marketing Psychology Instructions
- **Impulse Engineering:** Images are designed to trigger an immediate "stop-the-scroll" reaction using pattern interrupts.
- **Trust Building:** Focuses on "attainable relatability"—characters look like real people "within arms reach" rather than perfect models.

---

## 3. The Video Generation Tool (Veo)
**Model:** `veo-3.1-fast-generate-preview`

### Features & Functions
- **The 5-Step Formula:** Every video script follows a high-conversion narrative arc:
    - **Step 1: Relatable Scenario.** Immediate display of the target audience's current life/problem.
    - **Step 2: Character Building.** Showing the character seeking transformation *before* the product appears.
    - **Step 3: Progression.** Visual momentum and the journey toward a solution.
    - **Step 4: Product Introduction.** The product is introduced as the *catalyst* for change.
    - **Step 5: The Grand Reveal.** Final payoff showing the character at their best, sparking curiosity.
- **Micro-Directives:** Technical instructions for the AI to include micro-expressions, subtle hesitations, and confidence cues to "humanize" the output and avoid the uncanny valley.
- **Environment-First Logic:** The location (Car, Kitchen, Gym) is chosen first to dictate the tonality and cadence of the entire ad.

### Marketing Psychology Instructions
- **Motivation Buckets:** Every video is anchored to one of five core human drivers:
    1. **Avoid Pain:** Solving a nagging frustration.
    2. **Gain Confidence:** Personal transformation.
    3. **Status/Envy:** Social elevation.
    4. **Love/Belonging:** Connection and community.
    5. **Convenience/Peace:** Time-saving and stress reduction.
- **Curiosity Framework:** Uses "Curious Ad" logic—talking about benefits in organic settings (e.g., a grocery store or a hike) without explicit "salesman" energy.

---

## 4. Critical Constraints
- **Zero Hallucination Policy:** No mentions of FDA approval or government endorsements.
- **Legibility First:** All text overlays must be sharp, high-resolution, and typo-free.
- **Performance Scoring:** Every generated concept is assigned a score (1-10) based on its adherence to LF8 and the Unique Mechanism.
