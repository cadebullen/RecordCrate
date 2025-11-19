import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Music } from 'lucide-react';
import { spotifyService } from '../services/spotify';
import type { SpotifyPlaylist, SpotifyTrack } from '../types';
import '../styles/pages/PlaylistDetail.css';

interface PlaylistWithTracks extends SpotifyPlaylist {
    tracks: {
        href: string;
        items: Array<{
            track: SpotifyTrack;
            added_at: string;
        }>;
        total: number;
    };
}

export const PlaylistDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [playlist, setPlaylist] = useState<PlaylistWithTracks | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [localLoading, setLocalLoading] = useState(true);
    const [localError, setLocalError] = useState<string | null>(null);

    const tracksPerPage = 20;

    useEffect(() => {
        const fetchPlaylistData = async () => {
            if (!id) return;

            setLocalLoading(true);
            setLocalError(null);

            try {
                const playlistData = await spotifyService.getPlaylist(id);
                // Filter out null tracks that sometimes come from Spotify API
                if (playlistData.tracks?.items) {
                    playlistData.tracks.items = playlistData.tracks.items.filter(
                        item => item && item.track && item.track.id
                    );
                }
                setPlaylist(playlistData as PlaylistWithTracks);
            } catch (err) {
                setLocalError('Failed to load playlist information');
                console.error('Error fetching playlist data:', err);
            } finally {
                setLocalLoading(false);
            }
        };

        fetchPlaylistData();
    }, [id]);

    const formatDuration = (ms: number): string => {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const getTotalDuration = (): string => {
        if (!playlist?.tracks?.items) return '0:00';
        const totalMs = playlist.tracks.items.reduce((sum, item) => {
            return sum + (item.track?.duration_ms || 0);
        }, 0);
        const hours = Math.floor(totalMs / 3600000);
        const minutes = Math.floor((totalMs % 3600000) / 60000);
        if (hours > 0) {
            return `${hours} hr ${minutes} min`;
        }
        return `${minutes} min`;
    };

    const handleTrackClick = (track: SpotifyTrack) => {
        if (track.album?.id) {
            navigate(`/album/${track.album.id}`);
        } else if (track.external_urls?.spotify) {
            window.open(track.external_urls.spotify, '_blank');
        }
    };

    const handleArtistClick = (artistId: string, event: React.MouseEvent) => {
        event.stopPropagation();
        navigate(`/artist/${artistId}`);
    };

    // Pagination
    const totalPages = Math.ceil((playlist?.tracks?.items.length || 0) / tracksPerPage);
    const startIndex = (currentPage - 1) * tracksPerPage;
    const endIndex = startIndex + tracksPerPage;
    const currentTracks = playlist?.tracks?.items.slice(startIndex, endIndex) || [];

    const handleNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handlePrevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    if (localLoading) {
        return (
            <div className="main-content">
                <div className="container">
                    <div className="loading-container">
                        <div className="loading-spinner"></div>
                        <p className="loading-message">Loading playlist...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (localError || !playlist) {
        return (
            <div className="main-content">
                <div className="container">
                    <div className="error-message">
                        {localError || 'Playlist not found'}
                    </div>
                    <button
                        onClick={() => navigate('/search')}
                        className="search-button back-button"
                    >
                        Back to Search
                    </button>
                </div>
            </div>
        );
    }

    const getPlaylistImage = () => {
        return playlist.images && playlist.images.length > 0
            ? playlist.images[0].url
            : null;
    };

    return (
        <div className="main-content">
            <div className="container">
                <button className="back-button" onClick={() => {
                    if (window.history.length > 1) {
                        navigate(-1);
                    } else {
                        navigate('/');
                    }
                }}>
                    <ArrowLeft size={20} />
                    Back
                </button>

                <div className="playlist-detail">
                    {/* Playlist Header */}
                    <div className="playlist-header">
                        <div className="playlist-cover-large">
                            {getPlaylistImage() ? (
                                <img
                                    src={getPlaylistImage()!}
                                    alt={playlist.name}
                                    className="playlist-image"
                                />
                            ) : (
                                <div className="playlist-image-placeholder">
                                    <Music size={80} />
                                </div>
                            )}
                        </div>
                        <div className="playlist-info-header">
                            <span className="playlist-type">Playlist</span>
                            <h1 className="playlist-name">{playlist.name}</h1>
                            {playlist.description && (
                                <p className="playlist-description">{playlist.description}</p>
                            )}
                            <div className="playlist-meta">
                                <span className="playlist-owner">
                                    By {playlist.owner?.display_name || 'Unknown'}
                                </span>
                                <span className="playlist-dot">•</span>
                                <span className="playlist-tracks-count">
                                    {playlist.tracks?.total || 0} songs
                                </span>
                                <span className="playlist-dot">•</span>
                                <span className="playlist-duration">
                                    {getTotalDuration()}
                                </span>
                            </div>
                            <a
                                href={playlist.external_urls.spotify}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="spotify-link"
                            >
                                <ExternalLink size={16} />
                                Open in Spotify
                            </a>
                        </div>
                    </div>

                    {/* Tracks Section */}
                    {playlist.tracks?.items && playlist.tracks.items.length > 0 && (
                        <section className="playlist-tracks-section">
                            <div className="section-header">
                                <h2 className="section-title">Tracks</h2>
                                {totalPages > 1 && (
                                    <div className="pagination-info">
                                        Page {currentPage} of {totalPages}
                                    </div>
                                )}
                            </div>

                            <div className="tracks-list">
                                <div className="tracks-header">
                                    <span className="track-number">#</span>
                                    <span className="track-title">Title</span>
                                    <span className="track-album">Album</span>
                                    <span className="track-duration">⏱</span>
                                </div>

                                {currentTracks.map((item, index) => {
                                    const track = item.track;
                                    if (!track) return null;

                                    return (
                                        <div
                                            key={track.id || `track-${index}`}
                                            className="track-row"
                                            onClick={() => handleTrackClick(track)}
                                        >
                                            <span className="track-number">
                                                {startIndex + index + 1}
                                            </span>
                                            <div className="track-info">
                                                <div className="track-name">{track.name}</div>
                                                <div className="track-artists">
                                                    {track.artists?.map((artist, idx) => (
                                                        <React.Fragment key={artist.id}>
                                                            <span
                                                                className="artist-link"
                                                                onClick={(e) => handleArtistClick(artist.id, e)}
                                                            >
                                                                {artist.name}
                                                            </span>
                                                            {idx < track.artists.length - 1 && ', '}
                                                        </React.Fragment>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="track-album-name">
                                                {track.album?.name || 'Unknown Album'}
                                            </div>
                                            <span className="track-duration">
                                                {formatDuration(track.duration_ms)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {totalPages > 1 && (
                                <div className="pagination-controls">
                                    <button
                                        onClick={handlePrevPage}
                                        disabled={currentPage === 1}
                                        className="pagination-button"
                                    >
                                        Previous
                                    </button>
                                    <span className="pagination-text">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <button
                                        onClick={handleNextPage}
                                        disabled={currentPage === totalPages}
                                        className="pagination-button"
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
};
