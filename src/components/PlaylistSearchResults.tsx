import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SpotifyPlaylist } from '../types';
import '../styles/components/PlaylistSearchResults.css';

interface PlaylistSearchResultsProps {
    playlists: SpotifyPlaylist[];
}

export const PlaylistSearchResults: React.FC<PlaylistSearchResultsProps> = ({ playlists }) => {
    const navigate = useNavigate();
    const carouselRef = useRef<HTMLDivElement>(null);
    const isScrollingRef = useRef<boolean>(false);
    const scrollIntervalRef = useRef<number | null>(null);

    const scrollLeft = () => {
        if (carouselRef.current) {
            carouselRef.current.scrollBy({ left: -300, behavior: 'smooth' });
        }
    };

    const scrollRight = () => {
        if (carouselRef.current) {
            carouselRef.current.scrollBy({ left: 300, behavior: 'smooth' });
        }
    };

    const startContinuousScroll = (direction: 'left' | 'right') => {
        if (isScrollingRef.current) return;
        
        isScrollingRef.current = true;
        const scrollFn = direction === 'left' ? scrollLeft : scrollRight;
        
        // Initial scroll
        scrollFn();
        
        // Continue scrolling while button is held
        scrollIntervalRef.current = window.setInterval(scrollFn, 200);
    };

    const stopContinuousScroll = () => {
        isScrollingRef.current = false;
        if (scrollIntervalRef.current) {
            clearInterval(scrollIntervalRef.current);
            scrollIntervalRef.current = null;
        }
    };

    useEffect(() => {
        return () => {
            if (scrollIntervalRef.current) {
                clearInterval(scrollIntervalRef.current);
            }
        };
    }, []);

    if (playlists.length === 0) {
        return null;
    }

    const getPlaylistImage = (playlist: SpotifyPlaylist): string | null => {
        if (playlist.images && playlist.images.length > 0 && playlist.images[0]) {
            return playlist.images[0].url;
        }
        return null;
    };

    const handlePlaylistClick = (playlist: SpotifyPlaylist) => {
        // Navigate to playlist detail page
        navigate(`/playlist/${playlist.id}`);
    };

    return (
        <div className="search-results">
            <div className="carousel-header">
                <h2>Playlists ({playlists.length})</h2>
                {playlists.length > 3 && (
                    <div className="carousel-controls">
                        <button 
                            className="carousel-btn carousel-btn-left" 
                            onMouseDown={() => startContinuousScroll('left')}
                            onMouseUp={stopContinuousScroll}
                            onMouseLeave={stopContinuousScroll}
                            onTouchStart={() => startContinuousScroll('left')}
                            onTouchEnd={stopContinuousScroll}
                            aria-label="Scroll left"
                        >
                            ←
                        </button>
                        <button 
                            className="carousel-btn carousel-btn-right" 
                            onMouseDown={() => startContinuousScroll('right')}
                            onMouseUp={stopContinuousScroll}
                            onMouseLeave={stopContinuousScroll}
                            onTouchStart={() => startContinuousScroll('right')}
                            onTouchEnd={stopContinuousScroll}
                            aria-label="Scroll right"
                        >
                            →
                        </button>
                    </div>
                )}
            </div>
            <div className="playlist-carousel" ref={carouselRef}>
                {playlists.filter(playlist => playlist && playlist.id).map((playlist) => (
                    <div 
                        key={playlist.id} 
                        className="playlist-card"
                        onClick={() => handlePlaylistClick(playlist)}
                        role="button"
                        tabIndex={0}
                    >
                        <div className="playlist-cover">
                            {getPlaylistImage(playlist) ? (
                                <img 
                                    src={getPlaylistImage(playlist)!} 
                                    alt={playlist.name}
                                />
                            ) : (
                                <div className="playlist-placeholder">🎵</div>
                            )}
                        </div>
                        <div className="playlist-info">
                            <h3 className="playlist-name">{playlist.name}</h3>
                            <p className="playlist-owner">
                                By {playlist.owner?.display_name || 'Unknown'}
                            </p>
                            <p className="playlist-tracks">
                                {playlist.tracks?.total || 0} {playlist.tracks?.total === 1 ? 'track' : 'tracks'}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
