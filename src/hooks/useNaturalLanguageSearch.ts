import { useState, useCallback } from 'react';
import { backend } from '../services/backend';

export interface NaturalLanguageRecommendation {
  type: 'album' | 'artist' | 'track' | 'playlist';
  name: string;
  artist?: string;
  reason: string;
  searchQuery: string;
}

export interface SearchSuggestion {
  type: 'album' | 'artist' | 'track' | 'genre' | 'playlist';
  query: string;
  displayText: string;
  reason: string;
}

export interface NaturalLanguageResponse {
  isNaturalLanguage: boolean;
  originalQuery?: string;
  interpretation?: string;
  recommendations?: NaturalLanguageRecommendation[];
  searchSuggestions?: SearchSuggestion[];
  additionalSearchTerms?: string[];
  message?: string;
}

export const useNaturalLanguageSearch = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<NaturalLanguageResponse | null>(null);

  const processNaturalLanguageQuery = useCallback(async (query: string): Promise<NaturalLanguageResponse> => {
    setLoading(true);
    setError(null);

    try {
      const data = await backend.processNaturalLanguageSearch(query) as NaturalLanguageResponse;
      
      // If backend returns null (AI unavailable), treat as error
      if (!data) {
        setError('AI search unavailable');
        setLastResponse(null);
        throw new Error('AI search unavailable');
      }
      
      setLastResponse(data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process natural language query';
      setError(errorMessage);
      setLastResponse(null); // Clear any previous response
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearResponse = useCallback(() => {
    setLastResponse(null);
    setError(null);
  }, []);

  return {
    processNaturalLanguageQuery,
    loading,
    error,
    lastResponse,
    clearError,
    clearResponse
  };
};