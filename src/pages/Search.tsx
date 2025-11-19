import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SearchInput } from '../components/SearchInput';
import { SearchDropdown } from '../components/SearchDropdown';
import { SearchResults } from '../components/SearchResults';
import { ArtistSearchResults } from '../components/ArtistSearchResults';
import { TrackSearchResults } from '../components/TrackSearchResults';
import { PlaylistSearchResults } from '../components/PlaylistSearchResults';
import { NaturalLanguageResults } from '../components/NaturalLanguageResults';
import { useSearchLogic } from '../hooks/useSearchLogic';
import { useClickOutside } from '../hooks/useClickOutside';
import { useNaturalLanguageSearch } from '../hooks/useNaturalLanguageSearch';
import { MusicFilterBar, type MusicFilterState } from '../components/MusicFilterBar';
import { useSpotify } from '../hooks/useSpotify';
import type { SpotifyAlbum, SpotifyArtist, SpotifyTrack } from '../types';
import type { SearchSuggestion } from '../hooks/useNaturalLanguageSearch';

const DEFAULT_DECADES = ['2020s', '2010s', '2000s', '1990s', '1980s', '1970s', '1960s', '1950s', '1940s'];

const getYearFromDate = (dateString?: string): number | null => {
  if (!dateString) {
    return null;
  }

  if (dateString.length === 4) {
    const parsed = Number(dateString);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (dateString.length === 7 || dateString.length === 10) {
    const parsed = Number(dateString.slice(0, 4));
    return Number.isNaN(parsed) ? null : parsed;
  }

  const parsedDate = new Date(dateString);
  const year = parsedDate.getFullYear();
  return Number.isNaN(year) ? null : year;
};

const computeDecadeValue = (year: number | null): string | null => {
  if (!year || year <= 0) {
    return null;
  }

  return `${Math.floor(year / 10) * 10}s`;
};

const matchesGenreFilter = (filters: MusicFilterState, entityGenres: string[]) => {
  if (filters.genre === 'all') {
    return true;
  }

  if (entityGenres.length === 0) {
    return false;
  }

  return entityGenres.includes(filters.genre);
};

const matchesDecadeFilter = (filters: MusicFilterState, dateString?: string) => {
  if (filters.decade === 'all') {
    return true;
  }

  const year = getYearFromDate(dateString);
  const decade = computeDecadeValue(year);

  if (!decade) {
    return false;
  }

  return filters.decade === decade;
};

const matchesRatingFilter = (filters: MusicFilterState, popularity: number | undefined | null) => {
  const value = typeof popularity === 'number' ? popularity : null;

  switch (filters.rating) {
    case '5':
      return value !== null && value >= 95;
    case '4':
      return value !== null && value >= 85 && value <= 94;
    case '3':
      return value !== null && value >= 70 && value <= 84;
    case '2':
      return value !== null && value >= 55 && value <= 69;
    default:
      return true;
  }
};

const matchesExplicitFilter = (filters: MusicFilterState, explicit: boolean | undefined | null) => {
  switch (filters.explicit) {
    case 'explicit':
      return Boolean(explicit);
    case 'clean':
      return explicit === false || explicit === undefined || explicit === null;
    default:
      return true;
  }
};

export const Search: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getAvailableGenres, searchArtists, searchAlbums, searchTracks, searchPlaylists } = useSpotify();
  const [filters, setFilters] = useState<MusicFilterState>({
    genre: 'all',
    decade: 'all',
    rating: 'all',
    explicit: 'all',
  });
  const [genreSeeds, setGenreSeeds] = useState<string[]>([]);
  const [showInstructions, setShowInstructions] = useState(false);

  const {
    query,
    albumResults,
    artistResults,
    trackResults,
    playlistResults,
    localError,
    dropdownSuggestions,
    showDropdown,
    selectedIndex,
    hasSearched,
    loading,
    spotifyError,
    setQuery,
    setSelectedIndex,
    setShowDropdown,
    handleSearch,
    handleSuggestionSelect,
    handleClear,
    handleKeyDown,
    handleInputFocus,
    handleInputBlur
  } = useSearchLogic({
    onAlbumSelect: (album: SpotifyAlbum) => {
      navigate(`/album/${album.id}`);
    },
    onArtistSelect: (artist: SpotifyArtist) => {
      navigate(`/artist/${artist.id}`);
    },
    onTrackSelect: (track: SpotifyTrack) => {
      // For now, just log the track selection and play preview if available
      console.log('Selected track:', track.name, 'by', track.artists.map(a => a.name).join(', '));
      if (track.preview_url) {
        const audio = new Audio(track.preview_url);
        audio.play().catch(console.error);
      }
    }
  });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasInitialized = useRef(false);
  const shouldAutoSearch = useRef(false);
  const isClearing = useRef(false);
  const isTyping = useRef(false);

  // Natural Language Search
  const { 
    processNaturalLanguageQuery, 
    loading: nlLoading, 
    error: nlError, 
    lastResponse: nlResponse,
    clearResponse: clearNlResponse 
  } = useNaturalLanguageSearch();

  // Wrapper for search that includes AI processing
  const handleSearchWithAI = useCallback(() => {
    handleSearch();
    
    // Check if it's a natural language query after user explicitly searches
    if (query && query.trim().length >= 5) {
      const naturalLanguageIndicators = [
        'like', 'similar to', 'reminds me of', 'sounds like', 'albums like',
        'music like', 'artists like', 'recommend', 'suggest', 'find me',
        'what are some', 'i want', 'looking for', 'show me', 'give me'
      ];
      
      const lowerQuery = query.toLowerCase();
      const isNaturalLanguage = naturalLanguageIndicators.some(indicator => 
        lowerQuery.includes(indicator)
      );

      if (isNaturalLanguage) {
        // Silently fail if AI is unavailable - don't show error to user
        processNaturalLanguageQuery(query).catch(() => {
          // AI failed, but regular search results will still show
          console.log('AI search unavailable, showing regular results only');
        });
      }
    }
  }, [handleSearch, query, processNaturalLanguageQuery]);

  // Initialize query from URL on mount
  useEffect(() => {
    if (!hasInitialized.current && !isClearing.current) {
      const queryFromUrl = searchParams.get('q');
      if (queryFromUrl && queryFromUrl !== query) {
        setQuery(queryFromUrl);
        hasInitialized.current = true;
      }
    }
    // Reset clearing flag after URL is processed
    if (isClearing.current && !searchParams.get('q')) {
      isClearing.current = false;
    }
  }, [searchParams, query, setQuery]);

  // Trigger search after query is set from URL or genre click - NOT when typing
  useEffect(() => {
    if (hasInitialized.current && query && !hasSearched && !isTyping.current) {
      handleSearchWithAI();
      hasInitialized.current = false; // Reset flag
    }
    // Auto-search when genre/mood is clicked
    if (shouldAutoSearch.current && query && !isTyping.current) {
      handleSearchWithAI();
      shouldAutoSearch.current = false;
    }
  }, [query, hasSearched, handleSearchWithAI]);

  // Update URL when query changes (after search is performed)
  useEffect(() => {
    if (hasSearched && query) {
      setSearchParams({ q: query }, { replace: true });
    } else if (!query && hasSearched) {
      setSearchParams({}, { replace: true });
    }
  }, [query, hasSearched, setSearchParams]);

  // Wrapper to clear both regular and NL search results
  const handleClearAll = () => {
    // Set clearing flag to prevent URL re-initialization
    isClearing.current = true;
    hasInitialized.current = true;
    isTyping.current = false; // Reset typing flag
    // Clear all search state
    handleClear();
    clearNlResponse();
    // Clear URL params
    setSearchParams({}, { replace: true });
  };

  // Custom key handler that uses AI search wrapper
  const handleKeyDownWithAI = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      isTyping.current = false; // Clear typing flag on submit
      
      // Check if user selected a dropdown suggestion
      if (showDropdown && selectedIndex >= 0 && selectedIndex < dropdownSuggestions.length && dropdownSuggestions[selectedIndex]) {
        // User has selected a suggestion - use it
        handleSuggestionSelect(dropdownSuggestions[selectedIndex]);
      } else {
        // No suggestion selected - perform search with AI
        handleSearchWithAI();
      }
    } else {
      // For all other keys, use normal key handling
      handleKeyDown(e);
    }
  };

  // Wrapper for setQuery that marks user as actively typing
  const handleQueryChange = useCallback((newQuery: string) => {
    isTyping.current = true;
    setQuery(newQuery);
    
    // Clear typing flag after user stops typing for a bit
    const typingTimeout = setTimeout(() => {
      isTyping.current = false;
    }, 600);
    
    return () => clearTimeout(typingTimeout);
  }, [setQuery]);

  // Check for natural language queries and process them - DISABLED AUTO-TRIGGER
  // Only runs when user explicitly searches, not on every keystroke
  useEffect(() => {
    // Don't auto-process NL queries to prevent interference with typing
    // User must press Search button to trigger AI
    return () => {};
  }, []);

  const artistGenreMap = useMemo(() => {
    const map = new Map<string, string[]>();
    artistResults.forEach((artist) => {
      if (artist.genres && artist.genres.length > 0) {
        map.set(artist.id, artist.genres);
      }
    });
    return map;
  }, [artistResults]);

  useEffect(() => {
    let isMounted = true;

    const fetchGenres = async () => {
      const seeds = await getAvailableGenres();
      if (isMounted && seeds.length > 0) {
        setGenreSeeds(seeds);
      }
    };

    fetchGenres();

    return () => {
      isMounted = false;
    };
  }, [getAvailableGenres]);

  const availableGenres = useMemo(() => {
    if (genreSeeds.length > 0) {
      return genreSeeds;
    }

    const genreSet = new Set<string>();
    artistResults.forEach((artist) => {
      artist.genres?.forEach((genre) => {
        if (genre) {
          genreSet.add(genre);
        }
      });
    });

    return Array.from(genreSet).sort((a, b) => a.localeCompare(b));
  }, [artistResults, genreSeeds]);

  const availableDecades = useMemo(() => {
    const decadeSet = new Set<string>(DEFAULT_DECADES);

    trackResults.forEach((track) => {
      const year = getYearFromDate(track.album?.release_date);
      if (year) {
        decadeSet.add(`${Math.floor(year / 10) * 10}s`);
      }
    });

    albumResults.forEach((album) => {
      const year = getYearFromDate(album.release_date);
      if (year) {
        decadeSet.add(`${Math.floor(year / 10) * 10}s`);
      }
    });

    return Array.from(decadeSet).sort((a, b) => b.localeCompare(a));
  }, [albumResults, trackResults]);

  const filteredTrackResults = useMemo(() => {
    return trackResults.filter((track) => {
      const trackGenres = track.artists.flatMap((artist) => artistGenreMap.get(artist.id) ?? []);

      if (!matchesGenreFilter(filters, trackGenres)) {
        return false;
      }

      if (!matchesDecadeFilter(filters, track.album?.release_date)) {
        return false;
      }

      if (!matchesRatingFilter(filters, track.popularity ?? null)) {
        return false;
      }

      if (!matchesExplicitFilter(filters, track.explicit)) {
        return false;
      }

      return true;
    });
  }, [artistGenreMap, filters, trackResults]);

  const filteredAlbumResults = useMemo(() => {
    return albumResults.filter((album) => {
      const albumGenres = album.artists.flatMap((artist) => artistGenreMap.get(artist.id) ?? []);

      if (!matchesGenreFilter(filters, albumGenres)) {
        return false;
      }

      if (!matchesDecadeFilter(filters, album.release_date)) {
        return false;
      }

      if (!matchesRatingFilter(filters, album.popularity ?? null)) {
        return false;
      }

      if (filters.explicit === 'explicit') {
        return false;
      }

      return true;
    });
  }, [albumResults, artistGenreMap, filters]);

  const filteredArtistResults = useMemo(() => {
    if (filters.genre === 'all' && filters.decade === 'all' && filters.rating === 'all' && filters.explicit === 'all') {
      return artistResults;
    }

    if (filters.decade !== 'all' || filters.rating !== 'all' || filters.explicit !== 'all') {
      return [];
    }

    return artistResults.filter((artist) => matchesGenreFilter(filters, artist.genres ?? []));
  }, [artistResults, filters]);

  const handleFilterChange = (key: keyof MusicFilterState, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Handle click outside to close dropdown
  useClickOutside(
    dropdownRef,
    () => {
      if (showDropdown) {
        setShowDropdown(false);
        setSelectedIndex(-1);
      }
    },
    showDropdown
  );

  const error = localError || spotifyError;

  return (
    <div className="search-page">
      <div className="container">
        <div className="search-header">
          <h1>Search Music</h1>

          <form onSubmit={(e) => { e.preventDefault(); handleSearchWithAI(); }} className="search-form">
            <div className="search-input-group" ref={dropdownRef}>
              <SearchInput
                ref={inputRef}
                value={query}
                onChange={handleQueryChange}
                onSubmit={handleSearchWithAI}
                onClear={handleClearAll}
                onKeyDown={handleKeyDownWithAI}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                ariaExpanded={showDropdown}
                ariaControls="search-dropdown"
                ariaDescribedBy={error ? "search-error" : undefined}
                placeholder="Search for albums, artists, tracks..."
              />

              <SearchDropdown
                suggestions={dropdownSuggestions}
                isVisible={showDropdown}
                selectedIndex={selectedIndex}
                onSuggestionSelect={handleSuggestionSelect}
                onHover={setSelectedIndex}
              />
            </div>
          </form>
        </div>

        {/* Natural Language Search Results */}
        {nlResponse && nlResponse.isNaturalLanguage && !nlError && (
          <NaturalLanguageResults
            response={nlResponse}
            onArtistClick={async (artistName: string) => {
              try {
                const artists = await searchArtists(artistName);
                if (artists && artists.length > 0) {
                  navigate(`/artist/${artists[0].id}`);
                }
              } catch (error) {
                console.error('Error finding artist:', error);
              }
            }}
            onAlbumClick={async (albumName: string, artistName: string) => {
              try {
                const query = `${albumName} ${artistName}`;
                const albums = await searchAlbums(query);
                if (albums && albums.length > 0) {
                  navigate(`/album/${albums[0].id}`);
                }
              } catch (error) {
                console.error('Error finding album:', error);
              }
            }}
            onTrackClick={async (trackName: string, artistName: string) => {
              try {
                const query = `${trackName} ${artistName}`;
                const tracks = await searchTracks(query);
                if (tracks && tracks.length > 0) {
                  // Navigate to the album that contains this track
                  if (tracks[0].album?.id) {
                    navigate(`/album/${tracks[0].album.id}`);
                  }
                }
              } catch (error) {
                console.error('Error finding track:', error);
              }
            }}
            onPlaylistClick={async (playlistName: string) => {
              try {
                const playlists = await searchPlaylists(playlistName);
                if (playlists && playlists.length > 0) {
                  navigate(`/playlist/${playlists[0].id}`);
                }
              } catch (error) {
                console.error('Error finding playlist:', error);
              }
            }}
            onExecuteSearch={(searchQuery: string) => {
              shouldAutoSearch.current = true;
              setQuery(searchQuery);
            }}
          />
        )}

        {/* Error Display - Only show non-AI errors */}
        {error && (
          <div className="error-section">
            <p className="error-message" id="search-error">{error}</p>
          </div>
        )}

        {/* Search Instructions - Show when no search has been performed OR when empty search error */}
        {(!hasSearched || (error && error.includes('Please enter a search term'))) && !loading && !nlLoading && (
          <div className="search-instructions">
            <button 
              className="instructions-toggle"
              onClick={() => setShowInstructions(!showInstructions)}
              aria-expanded={showInstructions}
            >
              <span>How to Search</span>
              <span className={`toggle-icon ${showInstructions ? 'open' : ''}`}>▼</span>
            </button>
            {showInstructions && (
              <div className="instructions-content">
                <div className="instructions-grid">
                  <div className="instruction-item">
                    <h4>Basic Search</h4>
                    <p>Search for albums, artists, or tracks by name</p>
                    <ul>
                      <li><code>Blonde</code> - Find the album</li>
                      <li><code>Frank Ocean</code> - Find the artist</li>
                      <li><code>Nights</code> - Find the track</li>
                    </ul>
                  </div>
                  <div className="instruction-item">
                    <h4>AI-Powered Search</h4>
                    <p>Use natural language to discover music</p>
                    <ul>
                      <li><code>albums like Blonde by Frank Ocean</code></li>
                      <li><code>artists similar to Playboi Carti</code></li>
                      <li><code>songs like Nights</code></li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loading States */}
        {(loading || nlLoading) && (
          <div className="loading-section">
            {loading && <p className="loading-message">Searching music catalog...</p>}
            {nlLoading && <p className="loading-message">AI is analyzing your request...</p>}
          </div>
        )}

        {/* Results Section - Show albums, artists, tracks, and playlists */}
        {(albumResults.length > 0 || artistResults.length > 0 || trackResults.length > 0 || playlistResults.length > 0) && (
          <div className="unified-results">
            {(filteredAlbumResults.length > 0 || filteredArtistResults.length > 0 || filteredTrackResults.length > 0 || playlistResults.length > 0) && (
              <MusicFilterBar
                filters={filters}
                onChange={handleFilterChange}
                genres={availableGenres}
                decades={availableDecades}
                label="Refine Results"
                className="search-filter-controls"
              />
            )}

            {filteredAlbumResults.length > 0 && (
              <SearchResults
                results={filteredAlbumResults}
                query={query}
                hasSearched={hasSearched}
                isLoading={loading}
                error={error}
              />
            )}

            {filteredArtistResults.length > 0 && (
              <ArtistSearchResults
                results={filteredArtistResults}
                query={query}
                hasSearched={hasSearched}
                isLoading={loading}
                error={error}
              />
            )}

            {filteredTrackResults.length > 0 && (
              <TrackSearchResults
                tracks={filteredTrackResults}
              />
            )}

            {playlistResults.length > 0 && (
              <PlaylistSearchResults
                playlists={playlistResults}
              />
            )}

            {filteredAlbumResults.length === 0 &&
              filteredArtistResults.length === 0 &&
              filteredTrackResults.length === 0 &&
              playlistResults.length === 0 && (
                <div className="no-results">
                  <p>No results match the current filters.</p>
                </div>
              )}
          </div>
        )}

        {/* No results message */}
        {!loading && albumResults.length === 0 && artistResults.length === 0 && trackResults.length === 0 && hasSearched && (
          <div className="no-results">
            <p>No albums, artists, or tracks found for "{query}". Try a different search term.</p>
          </div>
        )}
      </div>
    </div>
  );
};
