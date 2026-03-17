export default function handler(req, res) {
  const key = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
  res.status(200).json({
    GEMINI_API_KEY: key,
    API_KEY: key,
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || "",
    VEO_MODEL_NAME: process.env.VEO_MODEL_NAME || "veo-3.1-fast-generate-preview"
  });
}
