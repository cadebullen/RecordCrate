import { GoogleGenAI } from "@google/genai";

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.isConfigured = !!this.apiKey;

    if (this.isConfigured) {
      try {
        this.genAI = new GoogleGenAI({ apiKey: this.apiKey });
        console.log(
          "✓ Gemini AI initialized successfully with @google/genai SDK"
        );
      } catch (error) {
        console.warn("Failed to initialize Gemini AI:", error.message);
        this.isConfigured = false;
      }
    } else {
      console.warn(
        "GEMINI_API_KEY not configured. Natural language search will use fallback mode."
      );
    }
  }

  /**
   * Determines if a search query is natural language vs a simple search
   * Now returns true for most queries to enable AI-powered search
   */
  isNaturalLanguageQuery(query) {
    const trimmed = query.trim();
    return (
      trimmed.split(/\s+/).length >= 2 ||
      /\b(like|similar|chill|vibe|mood|style|sound)\b/i.test(trimmed)
    );
  }

  // Return fallback response if Gemini is not configured
  async processNaturalLanguageQuery(query) {
    if (!this.isConfigured) {
      return this.generateFallbackResponse(query);
    }

    const prompt = `
You are a music recommendation AI. The user searched for: "${query}"

Analyze this search and provide music recommendations. The query could be:
- "Songs similar to Doghouse" → find similar tracks
- "Artists like Playboi Carti" → find similar artists  
- "Chill trap playlists" → find albums/artists in that style
- Any free-form music search

Respond ONLY with valid JSON (no markdown, no extra text):
{
  "interpretation": "What the user wants",
  "recommendations": [
    {
      "type": "track",
      "name": "Track Name",
      "artist": "Artist Name", 
      "reason": "Why this matches",
      "searchQuery": "track:Track Name artist:Artist Name"
    },
    {
      "type": "artist",
      "name": "Artist Name",
      "reason": "Why this matches",
      "searchQuery": "Artist Name"
    },
    {
      "type": "album",
      "name": "Album Name",
      "artist": "Artist Name",
      "reason": "Why this matches", 
      "searchQuery": "album:Album Name artist:Artist Name"
    }
  ],
  "additionalSearchTerms": ["genre", "mood"]
}

Provide exactly 6 popular recommendations that exist on Spotify.
`;

    try {
      const result = await this.genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      // Extract text from the response
      const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        console.error("Could not extract text from Gemini response");
        return this.generateFallbackResponse(query);
      }

      // Parse the JSON response
      const cleanedText = text.replace(/```json\n?|\n?```/g, "").trim();
      return JSON.parse(cleanedText);
    } catch (error) {
      console.error("Gemini API Error:", {
        status: error.status,
        message: error.message,
      });

      // Handle specific error cases
      if (error.status === 503) {
        console.warn(
          "⚠️  Gemini API is overloaded. Using fallback mode for this request."
        );
      } else if (
        error.status === 404 ||
        error.status === 403 ||
        error.status === 429
      ) {
        console.warn("Gemini API unavailable. Switching to fallback mode.");
        this.isConfigured = false;
      }

      // Fallback to basic response on error
      return this.generateFallbackResponse(query);
    }
  }

  //Generate a basic fallback response when Gemini is not available
  generateFallbackResponse(query) {
    const lowerQuery = query.toLowerCase();
    const terms = [];
    const genres = [
      "rock",
      "pop",
      "hip-hop",
      "rap",
      "jazz",
      "classical",
      "electronic",
      "indie",
      "country",
      "r&b",
      "funk",
      "soul",
    ];
    const moods = [
      "sad",
      "happy",
      "chill",
      "energetic",
      "relaxing",
      "upbeat",
      "melancholy",
      "romantic",
      "angry",
    ];

    genres.forEach((genre) => {
      if (lowerQuery.includes(genre)) terms.push(genre);
    });

    moods.forEach((mood) => {
      if (lowerQuery.includes(mood)) terms.push(mood);
    });

    let recommendations = [];

    if (lowerQuery.includes("blonde") && lowerQuery.includes("frank ocean")) {
      recommendations = [
        {
          type: "album",
          name: "Channel Orange",
          artist: "Frank Ocean",
          reason: "Another acclaimed Frank Ocean album with similar R&B style",
          searchQuery: "Frank Ocean Channel Orange",
        },
        {
          type: "artist",
          name: "The Weeknd",
          reason: "Similar R&B and alternative sound",
          searchQuery: "The Weeknd",
        },
      ];
    } else if (terms.length > 0) {
      recommendations = [
        {
          type: "genre",
          name: `${terms[0]} music`,
          reason: `Explore ${terms[0]} genre based on your request`,
          searchQuery: terms[0],
        },
      ];
    }

    return {
      interpretation: `Looking for music related to: ${query}`,
      recommendations,
      additionalSearchTerms:
        terms.length > 0 ? terms : ["popular", "new releases"],
    };
  }

  //Generate search suggestions based on Gemini's recommendations
  async generateSearchSuggestions(geminiResponse) {
    const suggestions = [];

    // Add direct recommendations
    geminiResponse.recommendations.forEach((rec) => {
      suggestions.push({
        type: rec.type,
        query: rec.searchQuery,
        displayText:
          rec.type === "album" ? `${rec.name} by ${rec.artist}` : rec.name,
        reason: rec.reason,
      });
    });

    // Add genre/mood based searches
    if (geminiResponse.additionalSearchTerms?.length > 0) {
      geminiResponse.additionalSearchTerms.forEach((term) => {
        suggestions.push({
          type: "genre",
          query: `genre:"${term}"`,
          displayText: `${term} music`,
          reason: `Explore ${term} genre`,
        });
      });
    }

    return suggestions;
  }
}

export const geminiService = new GeminiService();
