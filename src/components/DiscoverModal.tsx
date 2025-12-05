import React, { useState, useEffect } from 'react';
import { FlipCard } from './FlipCard';
import type { SpotifyTrack, SpotifyAlbum } from '../types';
import { spotifyService } from '../services/spotify';
import '../styles/components/DiscoverModal.css';

interface DiscoverModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'discoverModal_randomContent';

export const DiscoverModal: React.FC<DiscoverModalProps> = ({ isOpen, onClose }) => {
  const [track, setTrack] = useState<SpotifyTrack | null>(null);
  const [album, setAlbum] = useState<SpotifyAlbum | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Random search terms for variety
  const searchTerms = [
    'love', 'life', 'night', 'day', 'time',
    'heart', 'soul', 'dream', 'star', 'moon', 'sun', 'fire', 'water',
    'rock', 'pop', 'jazz', 'soul', 'funk', 'indie', 'electronic', 'hip hop'
  ];

  const getRandomSearchTerm = () => {
    return searchTerms[Math.floor(Math.random() * searchTerms.length)];
  };

  const fetchRandomTrack = async () => {
    try {
      const searchTerm = getRandomSearchTerm();
      const tracks = await spotifyService.searchTracks(searchTerm);
      
      if (tracks.length > 0) {
        // Get a random track from the results
        const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
        return randomTrack;
      }
      
      return null;
    } catch (err) {
      console.error('Error fetching random track:', err);
      return null;
    }
  };

  const fetchRandomAlbum = async () => {
    try {
      const searchTerm = getRandomSearchTerm();
      const albums = await spotifyService.searchAlbums(searchTerm);
      
      if (albums.length > 0) {
        // Get a random album from the results
        const randomAlbum = albums[Math.floor(Math.random() * albums.length)];
        return randomAlbum;
      }
      
      return null;
    } catch (err) {
      console.error('Error fetching random album:', err);
      return null;
    }
  };

  const loadRandomContent = async () => {
    setLoading(true);
    setError(null);

    try {
      const [randomTrack, randomAlbum] = await Promise.all([
        fetchRandomTrack(),
        fetchRandomAlbum()
      ]);

      if (!randomTrack || !randomAlbum) {
        setError('Failed to load random content. Please try again.');
      } else {
        setTrack(randomTrack);
        setAlbum(randomAlbum);
        // Save to localStorage for persistence
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ track: randomTrack, album: randomAlbum }));
      }
    } catch (err) {
      console.error('Error loading random content:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGetAnother = () => {
    // Clear localStorage before fetching new content
    localStorage.removeItem(STORAGE_KEY);
    loadRandomContent();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Load content when modal opens
  useEffect(() => {
    if (isOpen) {
      // Try to load from localStorage first
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const { track: storedTrack, album: storedAlbum } = JSON.parse(stored);
          setTrack(storedTrack);
          setAlbum(storedAlbum);
        } catch (err) {
          console.error('Error parsing stored content:', err);
          // If parsing fails, load new content
          loadRandomContent();
        }
      } else if (!track && !album) {
        // No stored content and no current content, load new
        loadRandomContent();
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="discover-modal-overlay" onClick={handleOverlayClick}>
      <div className="discover-modal">
        <button className="modal-close" onClick={onClose} aria-label="Close modal">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="modal-content">
          <div className="modal-header">
            <h2>Discover Random Music</h2>
            <p>Click the card to flip between a random track and album</p>
          </div>

          {loading && (
            <div className="modal-loading">
              <div className="loading-spinner"></div>
              <p>Finding something amazing...</p>
            </div>
          )}

          {error && (
            <div className="modal-error">
              <p>{error}</p>
              <button onClick={handleGetAnother} className="retry-btn">
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && track && album && (
            <>
              <FlipCard track={track} album={album} />
              
              <div className="modal-actions">
                <button onClick={handleGetAnother} className="get-another-btn">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                  </svg>
                  Get Another Card
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
