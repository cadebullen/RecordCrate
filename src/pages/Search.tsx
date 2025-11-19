import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SearchInput } from '../components/SearchInput';
import { SearchDropdown } from '../components/SearchDropdown';
import { SearchResults } from '../components/SearchResults';
import { ArtistSearchResults } from '../components/ArtistSearchResults';
import { TrackSearchResults } from '../components/TrackSearchResults';
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
  const { getAvailableGenres, searchArtists, searchAlbums, searchTracks } = useSpotify();
  const [filters, setFilters] = useState<MusicFilterState>({
    genre: 'all',
    decade: 'all',
    rating: 'all',
    explicit: 'all',
  });
  const [genreSeeds, setGenreSeeds] = useState<string[]>([]);

  const {
    query,
    albumResults,
    artistResults,
    trackResults,
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

  // Initialize query from URL params on mount
  useEffect(() => {
    if (!hasInitialized.current) {
      const queryFromUrl = searchParams.get('q');
      if (queryFromUrl && queryFromUrl !== query) {
        setQuery(queryFromUrl);
        hasInitialized.current = true;
      }
    }
  }, [searchParams]);

  // Trigger search after query is set from URL
  useEffect(() => {
    if (hasInitialized.current && query && !hasSearched) {
      handleSearch();
      hasInitialized.current = false; // Reset flag
    }
  }, [query]);

  // Update URL when query changes (after search is performed)
  useEffect(() => {
    if (hasSearched && query) {
      setSearchParams({ q: query }, { replace: true });
    } else if (!query && hasSearched) {
      setSearchParams({}, { replace: true });
    }
  }, [query, hasSearched]);

  // Natural Language Search
  const { 
    processNaturalLanguageQuery, 
    loading: nlLoading, 
    error: nlError, 
    lastResponse: nlResponse,
    clearResponse: clearNlResponse 
  } = useNaturalLanguageSearch();

  // Check for natural language queries and process them
  useEffect(() => {
    if (query && hasSearched) {
      // Simple heuristic to detect natural language queries
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
        processNaturalLanguageQuery(query).catch(console.error);
      } else {
        clearNlResponse();
      }
    } else {
      clearNlResponse();
    }
  }, [query, hasSearched, processNaturalLanguageQuery, clearNlResponse]);

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

          <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="search-form">
            <div className="search-input-group" ref={dropdownRef}>
              <SearchInput
                ref={inputRef}
                value={query}
                onChange={setQuery}
                onSubmit={handleSearch}
                onClear={handleClear}
                onKeyDown={handleKeyDown}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                ariaExpanded={showDropdown}
                ariaControls="search-dropdown"
                ariaDescribedBy={error ? "search-error" : undefined}
                placeholder="Search for albums, artists, tracks... or try 'albums like Blonde by Frank Ocean'"
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
            onExecuteSearch={(searchQuery: string) => {
              setQuery(searchQuery);
              handleSearch();
            }}
          />
        )}

        {/* Error Display - Only show non-AI errors */}
        {error && (
          <div className="error-section">
            <p className="error-message" id="search-error">{error}</p>
          </div>
        )}

        {/* Loading States */}
        {(loading || nlLoading) && (
          <div className="loading-section">
            {loading && <p className="loading-message">Searching music catalog...</p>}
            {nlLoading && <p className="loading-message">AI is analyzing your request...</p>}
          </div>
        )}

        {/* Results Section - Show albums, artists, and tracks */}
        {(albumResults.length > 0 || artistResults.length > 0 || trackResults.length > 0) && (
          <div className="unified-results">
            <MusicFilterBar
              filters={filters}
              onChange={handleFilterChange}
              genres={availableGenres}
              decades={availableDecades}
              label="Refine Results"
              className="search-filter-controls"
            />

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

            {filteredAlbumResults.length === 0 &&
              filteredArtistResults.length === 0 &&
              filteredTrackResults.length === 0 && (
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
