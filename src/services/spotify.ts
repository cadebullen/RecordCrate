const API_BASE = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:4000';
import axios from 'axios';
import type {
  DiscographyEntry,
  SpotifyAlbum,
  SpotifyArtist,
  SpotifyTrack,
  SpotifyPlaylist,
  SpotifyUser,
} from '../types';

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI || 'http://localhost:5173/callback';

const SCOPES = [
  'user-read-private',
  'user-read-email',
  'user-top-read',
  'user-library-read',
  'user-read-recently-played'
].join(' ');

// DEFAULT_MARKET removed; no longer required in no-auth discography flow.

class SpotifyService {
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private userAccessToken: string | null = null;
  private refreshToken: string | null = null;
  private pendingTokenExchange: Promise<{ access_token: string; refresh_token: string }> | null = null;

  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      'grant_type=client_credentials',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
        },
      }
    );

    this.accessToken = response.data.access_token;
    this.tokenExpiry = Date.now() + response.data.expires_in * 1000;

    return this.accessToken!;
  }

  async getAvailableGenres(): Promise<string[]> {
    // Prefer backend to avoid exposing secrets in the client
    try {
      const resp = await axios.get(`${API_BASE}/api/discography/genres`);
      const genres = resp.data?.genres ?? [];
      if (Array.isArray(genres) && genres.length > 0) return genres;
    } catch (err) {
      console.debug('Backend genre fetch failed, falling back to client credentials (if available):', err);
    }

    // Fallback (dev-only): direct Spotify call using client credentials
    try {
      const token = await this.getAccessToken();
      const response = await axios.get('https://api.spotify.com/v1/recommendations/available-genre-seeds', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data.genres ?? [];
    } catch (err) {
      console.debug('Direct Spotify genre fetch failed (likely no creds). Returning empty genres.', err);
      return [];
    }
  }

  async searchAlbums(query: string): Promise<SpotifyAlbum[]> {
    const token = await this.getAccessToken();

    const response = await axios.get(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(
        query
      )}&type=album&limit=20`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data.albums.items;
  }

  async searchArtists(query: string): Promise<SpotifyArtist[]> {
    const token = await this.getAccessToken();

    const response = await axios.get(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(
        query
      )}&type=artist&limit=20`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data.artists.items;
  }

  async searchTracks(query: string): Promise<SpotifyTrack[]> {
    const token = await this.getAccessToken();

    const response = await axios.get(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(
        query
      )}&type=track&limit=20`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data.tracks.items;
  }

  async searchPlaylists(query: string): Promise<SpotifyPlaylist[]> {
    const token = await this.getAccessToken();

    const response = await axios.get(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(
        query
      )}&type=playlist&limit=20`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data.playlists.items;
  }

  async getPlaylist(id: string): Promise<SpotifyPlaylist & { tracks: { items: Array<{ track: SpotifyTrack }> } }> {
    const token = await this.getAccessToken();

    const response = await axios.get(
      `https://api.spotify.com/v1/playlists/${id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  }

  async getAlbum(id: string): Promise<SpotifyAlbum> {
    const token = await this.getAccessToken();

    const response = await axios.get(
      `https://api.spotify.com/v1/albums/${id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  }

  async getArtist(id: string): Promise<SpotifyArtist> {
    const token = await this.getAccessToken();

    const response = await axios.get(
      `https://api.spotify.com/v1/artists/${id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  }

  async getArtistAlbums(id: string): Promise<SpotifyAlbum[]> {
    const token = await this.getAccessToken();

    const response = await axios.get(
      `https://api.spotify.com/v1/artists/${id}/albums?include_groups=album,single&limit=20`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data.items;
  }

  async getArtistTopTracks(id: string): Promise<SpotifyTrack[]> {
    const token = await this.getAccessToken();

    const response = await axios.get(
      `https://api.spotify.com/v1/artists/${id}/top-tracks?market=US`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data.tracks;
  }

  async getNewReleases(limit: number = 20): Promise<SpotifyAlbum[]> {
    const token = await this.getAccessToken();

    const response = await axios.get(
      `https://api.spotify.com/v1/browse/new-releases?limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data.albums.items;
  }

  async getNewReleasesByTimeframe(timeframe: 'week' | 'month' | 'year'): Promise<SpotifyAlbum[]> {
    const token = await this.getAccessToken();

    // Calculate date range based on timeframe
    const now = new Date();
    const startDate = new Date();

    switch (timeframe) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    const startYear = startDate.getFullYear();
    const endYear = now.getFullYear();

    // Search for albums released in the timeframe
    const response = await axios.get(
      `https://api.spotify.com/v1/search?q=year:${startYear}-${endYear}&type=album&limit=50`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    // Filter albums by exact date range
    const albums = response.data.albums.items.filter((album: SpotifyAlbum) => {
      const releaseDate = new Date(album.release_date);
      return releaseDate >= startDate && releaseDate <= now;
    });

    // Sort by release date (newest first)
    return albums.sort((a: SpotifyAlbum, b: SpotifyAlbum) =>
      new Date(b.release_date).getTime() - new Date(a.release_date).getTime()
    ).slice(0, 20);
  }

  async getPopularAlbums(): Promise<SpotifyAlbum[]> {
    const token = await this.getAccessToken();

    // Get featured playlists which often contain popular albums
    const playlistsResponse = await axios.get(
      'https://api.spotify.com/v1/browse/featured-playlists?limit=10',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const albums: SpotifyAlbum[] = [];
    const albumIds = new Set<string>();

    // Get tracks from featured playlists and extract unique albums
    for (const playlist of playlistsResponse.data.playlists.items.slice(0, 3)) {
      try {
        const tracksResponse = await axios.get(
          `https://api.spotify.com/v1/playlists/${playlist.id}/tracks?limit=50`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        for (const item of tracksResponse.data.items) {
          if (item.track && item.track.album && !albumIds.has(item.track.album.id)) {
            albumIds.add(item.track.album.id);
            albums.push(item.track.album);
          }
        }
      } catch (error) {
        console.warn('Failed to fetch playlist tracks:', error);
      }
    }

    return albums.slice(0, 20);
  }

  private parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current);
    return values.map((value) => value.trim());
  }

  // Removed legacy CSV ID extraction; replaced by a no-auth pipeline below.

  // Lightweight no-auth enrichment via Spotify oEmbed
  private async fetchOEmbed(url: string): Promise<{ title?: string; author_name?: string; thumbnail_url?: string } | null> {
    try {
      const resp = await axios.get('https://open.spotify.com/oembed', { params: { url } });
      return resp.data ?? null;
    } catch {
      return null;
    }
  }

  private normalizePopularityFromStreams(
    streams: Array<number | null>,
    fallbackFromPosition: (idx: number) => number
  ): number[] {
    const valid = streams.filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
    if (valid.length === 0) {
      return streams.map((_, idx) => fallbackFromPosition(idx));
    }
    const max = Math.max(...valid);
    const min = Math.min(...valid);
    if (max === min) {
      return streams.map(() => 90);
    }
    return streams.map((s, idx) => {
      if (typeof s !== 'number' || Number.isNaN(s)) return fallbackFromPosition(idx);
      const score = 60 + 40 * ((s - min) / (max - min));
      return Math.max(55, Math.min(100, Math.round(score)));
    });
  }

  // Removed legacy track details fetch; not used in no-auth flow.

  async getPopularTracks(
    page: number,
    limit: number = 50
  ): Promise<{ entries: DiscographyEntry[]; hasMore: boolean }> {
    // Prefer backend (production-safe)
    try {
      const resp = await axios.get(`${API_BASE}/api/discography/top-tracks`, { params: { page, limit } });
      if (resp.data && Array.isArray(resp.data.entries)) {
        return { entries: resp.data.entries, hasMore: !!resp.data.hasMore };
      }
    } catch (err) {
      console.debug('Backend top-tracks fetch failed, attempting client fallback:', err);
    }

    // Fallback path (no-login, no secrets): Spotify Charts CSV + oEmbed thumbnails
    try {
      const csvResponse = await axios.get(
        'https://spotifycharts.com/regional/global/daily/latest/download',
        { responseType: 'text' }
      );

      const lines: string[] = csvResponse.data
        .split('\n')
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 0 && !l.toLowerCase().startsWith('"position"'));

      if (lines.length === 0) return { entries: [], hasMore: false };

      const start = page * limit;
      const end = Math.min(start + limit, lines.length);
  const slice: string[] = lines.slice(start, end);
      const hasMore = end < lines.length;

      // Pre-parse streams to normalize popularity across the window
      const streamsForWindow: Array<number | null> = slice.map((line: string) => {
        const cols = this.parseCsvLine(line);
        const raw = cols[3] ?? '';
        const numeric = Number(String(raw).replace(/[,\s]/g, ''));
        return Number.isFinite(numeric) ? numeric : null;
      });
      const popularityScaled = this.normalizePopularityFromStreams(streamsForWindow, (idx) => {
        const position = start + idx + 1;
        const approx = 100 - (position - 1);
        return Math.max(55, Math.min(100, approx));
      });

      const entries: DiscographyEntry[] = [];
      for (let i = 0; i < slice.length; i += 1) {
        const line = slice[i];
        const cols = this.parseCsvLine(line);
        // Expected columns: Position, Track Name, Artist, Streams, URL
        if (cols.length < 5) continue;
        const trackName = cols[1] ?? '';
        const artistName = cols[2] ?? '';
        const url = cols[4] ?? '';
        const idMatch = url.match(/track\/([a-zA-Z0-9]+)/);
        const trackId = idMatch?.[1] ?? `${start + i}`;

        // oEmbed thumbnail/title, no auth
        const oembed = await this.fetchOEmbed(url);
        const imageUrl = oembed?.thumbnail_url ?? null;

        entries.push({
          id: trackId,
          type: 'track',
          name: trackName || oembed?.title || 'Unknown',
          artists: [{ id: '', name: artistName || oembed?.author_name || 'Unknown' }],
          imageUrl,
          releaseDate: '',
          releaseYear: 0,
          popularity: popularityScaled[i] ?? 60,
          explicit: false,
          albumName: undefined,
          genres: [],
          externalUrl: url,
        });
      }

      return { entries, hasMore };
    } catch (error) {
      console.error('Failed to assemble global top tracks (no-auth CSV path). Trying curated samples...', error);

      // Final fallback: curated static samples (minimal, no auth, no external CSV needed)
      const samples: Array<{ name: string; artist: string; url: string }> = [
        {
          name: 'Blinding Lights',
          artist: 'The Weeknd',
          url: 'https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b',
        },
        {
          name: 'Levitating',
          artist: 'Dua Lipa',
          url: 'https://open.spotify.com/track/463CkQjx2Zk1yXoBuierM9',
        },
        {
          name: 'As It Was',
          artist: 'Harry Styles',
          url: 'https://open.spotify.com/track/4LRPiXqCikLlN15c3yImP7',
        },
        {
          name: 'Watermelon Sugar',
          artist: 'Harry Styles',
          url: 'https://open.spotify.com/track/6UelLqGlWMcVH1E5c4H7lY',
        },
        {
          name: 'drivers license',
          artist: 'Olivia Rodrigo',
          url: 'https://open.spotify.com/track/5wANPM4fQCJwkGd4rN57mH',
        },
      ];

      const entries: DiscographyEntry[] = [];
      for (let i = 0; i < samples.length; i += 1) {
        const { name, artist, url } = samples[i];
        const idMatch = url.match(/track\/([a-zA-Z0-9]+)/);
        const trackId = idMatch?.[1] ?? String(i);
        const oembed = await this.fetchOEmbed(url);
        const imageUrl = oembed?.thumbnail_url ?? null;
        entries.push({
          id: trackId,
          type: 'track',
          name,
          artists: [{ id: '', name: artist }],
          imageUrl,
          releaseDate: '',
          releaseYear: 0,
          popularity: Math.max(55, 100 - i * 3),
          explicit: false,
          albumName: undefined,
          genres: [],
          externalUrl: url,
        });
      }

      return { entries, hasMore: false };
    }
  }

  async getTopArtists(): Promise<SpotifyArtist[]> {
    const token = await this.getAccessToken();

    // Search for popular artists across different genres
    const genres = ['pop', 'rock', 'hip-hop', 'electronic', 'indie', 'jazz'];
    const artists: SpotifyArtist[] = [];
    const artistIds = new Set<string>();

    for (const genre of genres) {
      try {
        const response = await axios.get(
          `https://api.spotify.com/v1/search?q=genre:${genre}&type=artist&limit=10`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        for (const artist of response.data.artists.items) {
          if (!artistIds.has(artist.id)) {
            artistIds.add(artist.id);
            artists.push(artist);
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch ${genre} artists:`, error);
      }
    }

    // Sort by popularity and return top 20
    return artists
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, 20);
  }

  // OAuth Authentication Methods
  getAuthUrl(): string {
    // Prefer the configured REDIRECT_URI, but at runtime fall back to the current origin
    // Use 127.0.0.1 instead of localhost per Spotify requirements
    const runtimeRedirect = (typeof window !== 'undefined')
      ? (REDIRECT_URI || `${window.location.origin}/callback`)
      : (REDIRECT_URI || 'http://127.0.0.1:5173/callback');
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: CLIENT_ID,
      scope: SCOPES,
      redirect_uri: runtimeRedirect,
      show_dialog: 'true'
    });
    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<{ access_token: string, refresh_token: string }> {
    // Prevent duplicate token exchange attempts with the same code
    if (this.pendingTokenExchange) {
      return this.pendingTokenExchange;
    }
    // Use the configured REDIRECT_URI, but fall back to the current origin at runtime
    // Use 127.0.0.1 instead of localhost per Spotify requirements
    const effectiveRedirect = (typeof window !== 'undefined')
      ? (REDIRECT_URI || `${window.location.origin}/callback`)
      : (REDIRECT_URI || 'http://127.0.0.1:5173/callback');
    this.pendingTokenExchange = (async () => {
      try {
      const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: effectiveRedirect,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
          },
        }
      );

      this.userAccessToken = response.data.access_token;
      this.refreshToken = response.data.refresh_token;

      // Store tokens in localStorage for persistence
      if (this.userAccessToken) {
        localStorage.setItem('spotify_access_token', this.userAccessToken);
      }
      if (this.refreshToken) {
        localStorage.setItem('spotify_refresh_token', this.refreshToken);
      }

      return {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token
      };
      } catch (err: unknown) {
        // Log the full response body when available to help debugging
        if (axios.isAxiosError(err)) {
          const data = err.response?.data as { error?: string; error_description?: string } | undefined;
          console.error('Token exchange error:', data ?? err.message);
          const desc = data?.error_description;
          if (data?.error === 'invalid_grant' || (typeof desc === 'string' && desc.toLowerCase().includes('redirect'))) {
            throw new Error('Invalid redirect URI or authorization code. Please check your Spotify app settings.');
          }
        } else {
          console.error('Token exchange error:', err);
        }
        throw err;
      }
    })();
    try {
      const result = await this.pendingTokenExchange;
      return result;
    } finally {
      this.pendingTokenExchange = null;
    }
  }

  async refreshAccessToken(): Promise<string | null> {
    if (!this.refreshToken) {
      this.refreshToken = localStorage.getItem('spotify_refresh_token');
    }

    if (!this.refreshToken) return null;

    try {
      const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
          },
        }
      );

      if (response.data.access_token) {
        this.userAccessToken = response.data.access_token;
        localStorage.setItem('spotify_access_token', this.userAccessToken ?? "");
      }

      if (response.data.refresh_token) {
        this.refreshToken = response.data.refresh_token;
        localStorage.setItem('spotify_refresh_token', this.refreshToken ?? "");
      }

      return this.userAccessToken;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Failed to refresh access token:', error.response?.data ?? error.message);
      } else {
        console.error('Failed to refresh access token:', error);
      }
      return null;
    }
  }

  async getUserAccessToken(): Promise<string | null> {
    if (this.userAccessToken) return this.userAccessToken;
    const storedToken = localStorage.getItem('spotify_access_token');
    if (storedToken) {
      this.userAccessToken = storedToken;
      return storedToken;
    }

    return await this.refreshAccessToken();
  }

  // Test if the current token is valid
  async validateToken(): Promise<boolean> {
    const token = await this.getUserAccessToken();
    if (!token) return false;

    try {
      await axios.get('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return true;
    } catch {
      return false;
    }
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('spotify_access_token');
  }

  logout(): void {
    this.userAccessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_refresh_token');
  }

  // User Profile Methods
  async getCurrentUser(): Promise<SpotifyUser | null> {
    const token = await this.getUserAccessToken();
    if (!token) return null;

    try {
      const response = await axios.get('https://api.spotify.com/v1/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error) {
      console.error('Failed to get user profile:', error);
      await this.refreshAccessToken();
      return null;
    }
  }

  // Album Methods
  async getAlbumWithTracks(id: string): Promise<SpotifyAlbum> {
    const token = await this.getAccessToken();

    const response = await axios.get(
      `https://api.spotify.com/v1/albums/${id}?market=US`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data;
  }

  async getAlbumTracks(albumId: string): Promise<SpotifyTrack[]> {
    const token = await this.getAccessToken();

    const response = await axios.get(
      `https://api.spotify.com/v1/albums/${albumId}/tracks`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return response.data.items;
  }

  // Enhanced personal data methods with real user data
  async getPersonalTopAlbums(timeframe: 'week' | '6months' | 'alltime'): Promise<SpotifyAlbum[]> {
    const token = await this.getUserAccessToken();
    if (!token) {
      console.log(`Getting personal top albums for ${timeframe} (mock data - not logged in)`);
      return this.getPopularAlbums();
    }

    try {
      let timeRange = 'medium_term';
      switch (timeframe) {
        case 'week':
          timeRange = 'short_term';
          break;
        case 'alltime':
          timeRange = 'long_term';
          break;
      }

      const response = await axios.get(
        `https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=${timeRange}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Extract unique albums from top tracks
      const albums: SpotifyAlbum[] = [];
      const albumIds = new Set<string>();

      for (const track of response.data.items) {
        if (!albumIds.has(track.album.id)) {
          albumIds.add(track.album.id);
          albums.push(track.album);
        }
      }

      return albums.slice(0, 20);
    } catch (error) {
      console.error('Failed to get personal top albums:', error);
      return this.getPopularAlbums();
    }
  }

  async getPersonalTopArtists(timeframe: 'week' | '6months' | 'alltime'): Promise<SpotifyArtist[]> {
    const token = await this.getUserAccessToken();
    if (!token) {
      console.log(`Getting personal top artists for ${timeframe} (mock data - not logged in)`);
      return this.getTopArtists();
    }

    try {
      let timeRange = 'medium_term';
      switch (timeframe) {
        case 'week':
          timeRange = 'short_term';
          break;
        case 'alltime':
          timeRange = 'long_term';
          break;
      }

      const response = await axios.get(
        `https://api.spotify.com/v1/me/top/artists?limit=20&time_range=${timeRange}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data.items;
    } catch (error) {
      console.error('Failed to get personal top artists:', error);
      return this.getTopArtists();
    }
  }

  // Get user's top tracks
  async getPersonalTopTracks(timeframe: 'short_term' | 'medium_term' | 'long_term' = 'medium_term'): Promise<SpotifyTrack[]> {
    try {
      const token = await this.getUserAccessToken();
      if (!token) return [];

      const response = await axios.get(
        `https://api.spotify.com/v1/me/top/tracks?time_range=${timeframe}&limit=50`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data.items;
    } catch (error) {
      console.error('Failed to get personal top tracks:', error);
      return [];
    }
  }

  // Get user's followed artists
  async getFollowedArtists(): Promise<SpotifyArtist[]> {
    try {
      const token = await this.getUserAccessToken();
      if (!token) return [];

      const response = await axios.get(
        'https://api.spotify.com/v1/me/following?type=artist&limit=50',
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data.artists.items;
    } catch (error) {
      console.error('Failed to get followed artists:', error);
      return [];
    }
  }
}

export const spotifyService = new SpotifyService();