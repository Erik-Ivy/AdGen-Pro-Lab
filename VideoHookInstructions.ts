
/*
# AI Ad Variation Generator: Video Hook Tool Logic & Architecture

This document outlines the internal logic, psychological frameworks, and technical parameters used by the "Video Hooks" and "Story Ads" generation tools in `geminiService.ts`.

## 1. Core Frameworks & Methodologies

The AI uses a weighted combination of behavioral science and direct response copywriting principles to generate scripts and visual directives.

### A. Direct Response (DR) Framework (Base Layer)
Used for all generations to ensure conversion focus.
1.  **Eugene Schwartz (Breakthrough Advertising):**
    -   *Awareness Level:* Targets Problem-Aware or Solution-Aware audiences.
    -   *Unique Mechanism:* Identifies the "Reason Why" the product works.
    -   *Sophistication:* Adjusts claim intensity based on `aggroLevel`.
2.  **Drew Eric Whitman (Cashvertising):**
    -   *Life Force 8 (LF8):* Taps into primal desires (Survival, Enjoyment, Freedom from Fear, Social Approval).
    -   *Extreme Specificity:* Enforces specific numbers/details (e.g., "52 lbs" vs "weight").
    -   *Visual Imagery:* Uses sensory language (hearing, feeling, seeing).
3.  **Robert Cialdini (Influence):**
    -   *Social Proof/Authority:* Implies consensus or scientific backing.
    -   *Scarcity/Unity:* Uses psychological timers or "us vs them" identity.

### B. Story Ad Framework (Conditional Layer)
Activated when `videoMode === 'story'`. Prioritizes narrative over hard selling.
1.  **Consumer Archetype:**
    -   *Motivation Bucket:* Avoid Pain, Gain Confidence, Status, Belonging, or Convenience.
    -   *Aesthetic Goal:* Attainable relatability (trust building) vs. Perfection.
2.  **Environment & Technicals:**
    -   *Environment First:* Setting dictates tone (e.g., Car = intimate; Kitchen = family).
    -   *Initial Hook:* Organic interactions (street interview, stranger compliment) to disarm.
    -   *Micro-Directives:* MANDATORY inclusion of micro-expressions and hesitations to avoid "uncanny valley".
3.  **The 5-Step Narrative Formula:**
    1.  Relatable Scenario (Life on display).
    2.  Character Building (Seeking transformation).
    3.  Progression (Momentum/Journey).
    4.  Product Introduction (The Catalyst).
    5.  The Grand Reveal (Payoff/Curiosity).

## 2. Input Analysis & Context Injection

The tool analyzes uploaded assets to extract context before generation:

-   **If Image Input:**
    -   Extracts: Product features, brand aesthetic, potential hook points.
    -   Infers: A suitable persona and filming style (UGC vs Studio) matching the brand.
-   **If Video Input:**
    -   Extracts: Pacing, visual content, existing script/sentiment, character traits, filming style.
-   **User Prompt:** Serves as the primary goal/direction.

## 3. Configuration Parameters

-   **Aggressiveness (`aggroLevel` 0-100):**
    -   *High (>70):* Bold, high-contrast impact, strong/polarizing language.
    -   *Low (<30):* Soft, clean, professional aesthetic, gentle/safe language.
-   **Creativity (`similarityLevel` 0-100):**
    -   *High (>70):* Radically evolves context, reimagines style/composition.
    -   *Low (<30):* Strictly adheres to original style, only iterates on the angle.
-   **Video Length:**
    -   Acts as a hard constraint for the scene breakdown and script word count.
    -   Calculated sum of scene durations must approximate this value.

## 4. Prompt Engineering & Output Structure

The System Prompt constructs a JSON object enforcing strict formatting for AI Video Generators (like Veo/Sora/Runway).

### The "jsonInstructions" Field
This is the critical output used to drive video generation.
-   **Format:** `[{"scene": 1, "visual": "...", "script": "...", "duration": 3}]`
-   **Rules Enforced:**
    1.  **Script Integration:** Dialogue/VO must be included per scene.
    2.  **Visual Consistency:** Every scene's visual description explicitly restates character and style traits to prevent morphing.
    3.  **Negative Constraints:** Appends "Do not generate captions... Do not generate music..." to visuals to keep raw video clean.
    4.  **No Text Overlays:** Focuses purely on visual action/lighting.

### Full Output Schema
1.  `title`: Internal reference title.
2.  `summary`: Strategic explanation of the angle.
3.  `characterDescription`: Specific traits (Age, Ethnicity, Style).
4.  `videoStyle`: Camera movement, lighting, film stock (e.g., "Handheld iPhone footage").
5.  `script`: Full read-through script.
6.  `duration`: Total estimated time.
7.  `performanceScore`: Predicted DR success (1-10).
8.  `jsonInstructions`: The stringified JSON scene list described above.
*/
