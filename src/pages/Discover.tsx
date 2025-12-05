import React, { useState, useEffect, useCallback } from 'react';
import { AlbumCard } from '../components/AlbumCard';
import { ArtistCard } from '../components/ArtistCard';
import { FilterTabs } from '../components/FilterTabs';
import { DiscoverModal } from '../components/DiscoverModal';
import AlbumStreakCalendar, { type AlbumStreakCalendarEntry } from '../components/AlbumStreakCalendar';
import { useSpotify } from '../hooks/useSpotify';
import { useAuth } from '../context/useAuth';
import type { SpotifyAlbum, SpotifyArtist, FilterType, AlbumReview } from '../types';
import '../styles/pages/Discover.css';

export const Discover: React.FC = () => {
  const [albums, setAlbums] = useState<SpotifyAlbum[]>([]);
  const [artists, setArtists] = useState<SpotifyArtist[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>('new-releases-week');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { loading, error, getFilteredContent } = useSpotify();
  const {
    isSpotifyLinked,
    linkSpotifyAccount,
    loadingSpotify,
  } = useAuth();
  const [calendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [dailyEntries, setDailyEntries] = useState<AlbumStreakCalendarEntry[]>([]);
  const canTrackStreak = isSpotifyLinked;

  const loadStreakCalendar = useCallback(() => {
    const now = calendarMonth;
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let aiLog: Record<string, unknown>;
    try {
      aiLog = JSON.parse(localStorage.getItem('aiDailyAlbumLog') ?? '{}') as Record<string, unknown>;
    } catch {
      aiLog = {};
    }

    let storedReviews: AlbumReview[];
    try {
      storedReviews = JSON.parse(localStorage.getItem('albumReviews') ?? '[]') as AlbumReview[];
    } catch {
      storedReviews = [];
    }

    const reviewDates = new Set(
      storedReviews
        .map((review) => review.createdAt?.split('T')[0])
        .filter((date): date is string => Boolean(date) && date.startsWith(monthPrefix))
    );

    const logDates = Object.keys(aiLog).filter((date) => date.startsWith(monthPrefix));
    const nextEntries: AlbumStreakCalendarEntry[] = [];

    logDates.forEach((date) => {
      const rated = reviewDates.has(date);
      nextEntries.push({
        date,
        status: rated ? 'completed' : 'pending',
      });
      if (rated) {
        reviewDates.delete(date);
      }
    });

    reviewDates.forEach((date) => {
      nextEntries.push({
        date,
        status: 'completed',
      });
    });

    if (nextEntries.length === 0) {
      nextEntries.push({
        date: `${monthPrefix}-${String(new Date().getDate()).padStart(2, '0')}`,
        status: 'pending',
      });
    }

    setDailyEntries(nextEntries);
  }, [calendarMonth]);

  useEffect(() => {
    const fetchContent = async () => {
      const { albums: fetchedAlbums, artists: fetchedArtists } = 
        await getFilteredContent(activeFilter);
      setAlbums(fetchedAlbums);
      setArtists(fetchedArtists || []);
    };

    fetchContent();
  }, [activeFilter, getFilteredContent]);

  useEffect(() => {
    loadStreakCalendar();
  }, [loadStreakCalendar]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'aiDailyAlbumLog' || event.key === 'albumReviews') {
        loadStreakCalendar();
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [loadStreakCalendar]);

  const getContentTitle = () => {
    switch (activeFilter) {
      case 'new-releases-week':
        return 'New Releases This Week';
      case 'new-releases-month':
        return 'New Releases This Month';
      case 'new-releases-year':
        return 'New Releases This Year';
      case 'popular-week':
        return 'Most Popular This Week';
      case 'popular-month':
        return 'Most Popular This Month';
      case 'popular-year':
        return 'Most Popular This Year';
      case 'personal-week':
        return 'Your Top Music This Week';
      case 'personal-6months':
        return 'Your Top Music (6 Months)';
      case 'personal-alltime':
        return 'Your All-Time Favorites';
      default:
        return 'Featured Albums';
    }
  };

  const showPersonalNote = activeFilter.startsWith('personal');

  if (loading) return <div className="loading">Loading content...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="discover">
      <div className="container">
        <section className="hero">
          <h1>Discover Music</h1>
          <p>Explore new releases, popular albums, and personalized recommendations</p>
          <button 
            className="random-discover-btn"
            onClick={() => setIsModalOpen(true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
            </svg>
            Random Discovery
          </button>
        </section>

        <section className="streak-calendar-section">
          <div className={`calendar-lock-wrapper ${!canTrackStreak ? 'locked' : ''}`}>
            <AlbumStreakCalendar
              month={calendarMonth}
              entries={dailyEntries}
              description="Log a rating for each AI pick to keep the streak alive. We'll fill in the green tiles once your teammates wire in the daily recommendations."
            />
            {!canTrackStreak && (
              <div className="calendar-lock-overlay">
                <p>Log in with Spotify to unlock your AI recommendation streak tracker.</p>
                <button
                  type="button"
                  className="spotify-login-btn large"
                  onClick={linkSpotifyAccount}
                  disabled={loadingSpotify}
                >
                  {loadingSpotify ? 'Opening Spotify…' : 'Login with Spotify'}
                </button>
              </div>
            )}
          </div>
          {!canTrackStreak && (
            <p className="streak-login-note">
              To track your rating streak for the daily AI recommendation, connect your Spotify account.
            </p>
          )}
        </section>

        <section className="content-filters">
          <FilterTabs 
            activeFilter={activeFilter} 
            onFilterChange={setActiveFilter} 
          />
        </section>

        {showPersonalNote && (
          <div className="personal-note">
            <p>
              <strong>Note:</strong> Personal listening data requires Spotify account 
              connection. Currently showing popular content as placeholder.
            </p>
          </div>
        )}

        <section className="filtered-content">
          <h2>{getContentTitle()}</h2>
          
          {albums.length > 0 && (
            <div className="content-section">
              <h3>Albums</h3>
              <div className="album-grid">
                {albums.map((album) => (
                  <AlbumCard
                    key={album.id}
                    album={album}
                  />
                ))}
              </div>
            </div>
          )}

          {artists.length > 0 && (
            <div className="content-section">
              <h3>Artists</h3>
              <div className="artist-grid">
                {artists.map((artist) => (
                  <ArtistCard
                    key={artist.id}
                    artist={artist}
                    onClick={() => console.log('Navigate to artist:', artist.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
      
      <DiscoverModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
};
