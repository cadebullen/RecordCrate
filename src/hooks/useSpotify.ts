import { useState, useCallback } from 'react';
import { spotifyService } from '../services/spotify';
import type {
  DiscographyEntry,
  FilterType,
  SpotifyAlbum,
  SpotifyArtist,
  SpotifyTrack,
  SpotifyPlaylist,
} from '../types';

export const useSpotify = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchAlbums = useCallback(async (query: string): Promise<SpotifyAlbum[]> => {
    setLoading(true);
    setError(null);

    try {
      const results = await spotifyService.searchAlbums(query);
      return results;
    } catch (error) {
      console.error('Failed to search albums', error);
      setError('Failed to search albums');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const searchArtists = useCallback(async (query: string): Promise<SpotifyArtist[]> => {
    setLoading(true);
    setError(null);

    try {
      const results = await spotifyService.searchArtists(query);
      return results;
    } catch (error) {
      console.error('Failed to search artists', error);
      setError('Failed to search artists');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const searchTracks = useCallback(async (query: string): Promise<SpotifyTrack[]> => {
    setLoading(true);
    setError(null);

    try {
      const results = await spotifyService.searchTracks(query);
      return results;
    } catch (error) {
      console.error('Failed to search tracks', error);
      setError('Failed to search tracks');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const searchPlaylists = useCallback(async (query: string): Promise<SpotifyPlaylist[]> => {
    setLoading(true);
    setError(null);

    try {
      const results = await spotifyService.searchPlaylists(query);
      return results;
    } catch (error) {
      console.error('Failed to search playlists', error);
      setError('Failed to search playlists');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getAlbum = useCallback(async (id: string): Promise<SpotifyAlbum | null> => {
    setLoading(true);
    setError(null);

    try {
      const album = await spotifyService.getAlbum(id);
      return album;
    } catch (error) {
      console.error('Failed to fetch album', error);
      setError('Failed to fetch album');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getPopularTracks = useCallback(
    async (
      page: number,
      limit: number = 50
    ): Promise<{ entries: DiscographyEntry[]; hasMore: boolean }> => {
      if (page === 0) {
        setLoading(true);
      }
      setError(null);

      try {
        const result = await spotifyService.getPopularTracks(page, limit);
        return result;
      } catch (error) {
        console.error('Failed to fetch popular tracks', error);
        setError('Failed to fetch popular tracks');
        return { entries: [], hasMore: false };
      } finally {
        if (page === 0) {
          setLoading(false);
        }
      }
    },
    []
  );

  const getAvailableGenres = useCallback(async (): Promise<string[]> => {
    try {
      const genres = await spotifyService.getAvailableGenres();
      return genres.sort((a, b) => a.localeCompare(b));
    } catch (err) {
      console.error('Failed to fetch available genres', err);
      return [];
    }
  }, []);

  const getFilteredContent = useCallback(async (filterType: FilterType): Promise<{
    albums: SpotifyAlbum[];
    artists?: SpotifyArtist[];
  }> => {
    setLoading(true);
    setError(null);

    try {
      let albums: SpotifyAlbum[] = [];
      let artists: SpotifyArtist[] = [];

      switch (filterType) {
        case 'new-releases-week':
          albums = await spotifyService.getNewReleasesByTimeframe('week');
          break;
        case 'new-releases-month':
          albums = await spotifyService.getNewReleasesByTimeframe('month');
          break;
        case 'new-releases-year':
          albums = await spotifyService.getNewReleasesByTimeframe('year');
          break;
        case 'popular-week':
        case 'popular-month':
        case 'popular-year':
          albums = await spotifyService.getPopularAlbums();
          break;
        case 'personal-week':
          albums = await spotifyService.getPersonalTopAlbums('week');
          artists = await spotifyService.getPersonalTopArtists('week');
          break;
        case 'personal-6months':
          albums = await spotifyService.getPersonalTopAlbums('6months');
          artists = await spotifyService.getPersonalTopArtists('6months');
          break;
        case 'personal-alltime':
          albums = await spotifyService.getPersonalTopAlbums('alltime');
          artists = await spotifyService.getPersonalTopArtists('alltime');
          break;
        default:
          albums = await spotifyService.getNewReleases();
      }

      return { albums, artists };
    } catch (error) {
      console.error('Failed to fetch filtered content', error);
      setError('Failed to fetch content');
      return { albums: [], artists: [] };
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    searchAlbums,
    searchArtists,
    searchTracks,
    searchPlaylists,
    getAlbum,
    getFilteredContent,
    getPopularTracks,
    getAvailableGenres,
  };
};
