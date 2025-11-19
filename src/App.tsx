import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { Home } from './pages/Home';
import { Discover } from './pages/Discover';
import { Discography } from './pages/Discography';
import { Search } from './pages/Search';
import { Profile } from './pages/Profile';
import { AlbumDetail } from './pages/AlbumDetail';
import { ArtistDetail } from './pages/ArtistDetail';
import { PlaylistDetail } from './pages/PlaylistDetail';
import { SpotifyCallback } from './pages/SpotifyCallback';
import './styles/global.css';
import './styles/index.css';
import './App.css';


function App() {
  return (
      <Router>
        <div className="App">
          <Header />
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/discover" element={<Discover />} />
              <Route path="/discography" element={<Discography />} />
              <Route path="/search" element={<Search />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/album/:albumId" element={<AlbumDetail />} />
              <Route path="/artist/:id" element={<ArtistDetail />} />
              <Route path="/playlist/:id" element={<PlaylistDetail />} />
              <Route path="/callback" element={<SpotifyCallback />} />
            </Routes>
          </main>
        </div>
      </Router>
  );
}

export default App;
