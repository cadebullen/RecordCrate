import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SpotifyTrack, SpotifyAlbum } from '../types';
import '../styles/components/FlipCard.css';

interface FlipCardProps {
  track: SpotifyTrack | null;
  album: SpotifyAlbum | null;
  onFlip?: () => void;
}

export const FlipCard: React.FC<FlipCardProps> = ({ track, album, onFlip }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const navigate = useNavigate();
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    onFlip?.();
  };

  // Touch handlers for mobile devices
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const deltaX = Math.abs(touchEndX - touchStartX.current);
    const deltaY = Math.abs(touchEndY - touchStartY.current);
    
    // If it's a tap (minimal movement), flip the card
    if (deltaX < 10 && deltaY < 10) {
      handleFlip();
    }
  };

  const handleTrackClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (track?.id) {
      // Navigate to track's album detail page
      if (track.album?.id) {
        navigate(`/album/${track.album.id}`);
      }
    }
  };

  const handleAlbumClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (album?.id) {
      navigate(`/album/${album.id}`);
    }
  };

  const handleArtistClick = (e: React.MouseEvent, artistId: string) => {
    e.stopPropagation();
    navigate(`/artist/${artistId}`);
  };

  const getImageUrl = (images: Array<{ url: string; height: number; width: number }> = []) => {
    return images.find(img => img.height >= 300)?.url || images[0]?.url || '/placeholder-album.png';
  };

  return (
    <div 
      className="flip-card-container" 
      onClick={handleFlip}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      ref={cardRef}
    >
      <div className={`flip-card ${isFlipped ? 'flipped' : ''}`}>
        {/* Front side - Track */}
        <div className="flip-card-face flip-card-front">
          {track ? (
            <>
              <div className="card-image">
                <img 
                  src={getImageUrl(track.album?.images)} 
                  alt={track.name}
                />
              </div>
              <div className="card-content">
                <div className="card-label">Random Track</div>
                <h3 className="card-title">{track.name}</h3>
                <p className="card-artist">
                  {track.artists.map((artist, idx) => (
                    <React.Fragment key={artist.id}>
                      <span
                        className="artist-link"
                        onClick={(e) => handleArtistClick(e, artist.id)}
                      >
                        {artist.name}
                      </span>
                      {idx < track.artists.length - 1 && ', '}
                    </React.Fragment>
                  ))}
                </p>
                {track.album && (
                  <p className="card-album">from {track.album.name}</p>
                )}
                {track.preview_url && (
                  <audio controls className="track-preview" onClick={(e) => e.stopPropagation()}>
                    <source src={track.preview_url} type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>
                )}
                <button
                  className="view-details-btn"
                  onClick={handleTrackClick}
                >
                  View Song
                </button>
                <div className="flip-hint">Click to flip</div>
              </div>
            </>
          ) : (
            <div className="card-loading">
              <p>Loading track...</p>
            </div>
          )}
        </div>

        {/* Back side - Album */}
        <div className="flip-card-face flip-card-back">
          {album ? (
            <>
              <div className="card-image">
                <img 
                  src={getImageUrl(album.images)} 
                  alt={album.name}
                />
              </div>
              <div className="card-content">
                <div className="card-label">Random Album</div>
                <h3 className="card-title">{album.name}</h3>
                <p className="card-artist">
                  {album.artists.map((artist, idx) => (
                    <React.Fragment key={artist.id}>
                      <span
                        className="artist-link"
                        onClick={(e) => handleArtistClick(e, artist.id)}
                      >
                        {artist.name}
                      </span>
                      {idx < album.artists.length - 1 && ', '}
                    </React.Fragment>
                  ))}
                </p>
                <p className="card-meta">
                  {album.release_date?.split('-')[0]} • {album.total_tracks} tracks
                </p>
                <button
                  className="view-details-btn"
                  onClick={handleAlbumClick}
                >
                  View Album
                </button>
                <div className="flip-hint">Click to flip back</div>
              </div>
            </>
          ) : (
            <div className="card-loading">
              <p>Loading album...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
