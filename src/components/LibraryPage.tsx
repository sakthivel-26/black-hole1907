import { useState } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { getImageUrl } from '../services/api';

import { motion } from 'framer-motion';
import { FiHeart, FiClock, FiPlus, FiMusic, FiList, FiTrash2 } from 'react-icons/fi';
import SongRow from './SongRow';

type LibraryTab = 'liked' | 'recent' | 'playlists';

export default function LibraryPage() {
  const {
    likedSongs, recentlyPlayed, playlists,
    playSong, createPlaylist, deletePlaylist, setView,
  } = usePlayerStore();
  const [activeTab, setActiveTab] = useState<LibraryTab>('liked');
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [playlistName, setPlaylistName] = useState('');

  const handleCreatePlaylist = () => {
    if (playlistName.trim()) {
      createPlaylist(playlistName.trim());
      setPlaylistName('');
      setShowCreatePlaylist(false);
    }
  };

  return (
    <div className="pb-32 md:pb-24 px-4 md:px-8">
      <h1 className="text-3xl font-bold pt-4 mb-6">Your Library</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <TabButton active={activeTab === 'liked'} onClick={() => setActiveTab('liked')} icon={<FiHeart />} label="Liked" count={likedSongs.length} />
        <TabButton active={activeTab === 'recent'} onClick={() => setActiveTab('recent')} icon={<FiClock />} label="Recent" count={recentlyPlayed.length} />
        <TabButton active={activeTab === 'playlists'} onClick={() => setActiveTab('playlists')} icon={<FiList />} label="Playlists" count={playlists.length} />
      </div>

      {/* Liked Songs */}
      {activeTab === 'liked' && (
        <div>
          {likedSongs.length === 0 ? (
            <EmptyState icon={<FiHeart size={48} />} message="No liked songs yet" sub="Tap the heart icon on any song to add it here" />
          ) : (
            <div>
              <button
                onClick={() => likedSongs.length > 0 && playSong(likedSongs[0], likedSongs)}
                className="mb-4 px-6 py-2.5 bg-primary rounded-full text-sm font-medium hover:bg-primary-dark transition-colors"
              >
                Play All
              </button>
              <div className="space-y-0.5">
                {likedSongs.map((song, i) => (
                  <SongRow key={song.id} song={song} index={i + 1} onPlay={() => playSong(song, likedSongs)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent */}
      {activeTab === 'recent' && (
        <div>
          {recentlyPlayed.length === 0 ? (
            <EmptyState icon={<FiClock size={48} />} message="No recently played songs" sub="Start listening to see your history here" />
          ) : (
            <div className="space-y-0.5">
              {recentlyPlayed.map((song, i) => (
                <SongRow key={`${song.id}-${i}`} song={song} index={i + 1} onPlay={() => playSong(song, recentlyPlayed)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Playlists */}
      {activeTab === 'playlists' && (
        <div>
          <button
            onClick={() => setShowCreatePlaylist(true)}
            className="flex items-center gap-3 w-full p-4 rounded-2xl glass-card mb-4"
          >
            <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center">
              <FiPlus size={24} className="text-primary" />
            </div>
            <span className="font-medium">Create New Playlist</span>
          </button>

          {showCreatePlaylist && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mb-4 p-4 glass-card"
            >
              <input
                type="text"
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                placeholder="Playlist name"
                className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 mb-3"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreatePlaylist()}
              />
              <div className="flex gap-2">
                <button onClick={handleCreatePlaylist} className="px-4 py-1.5 bg-primary rounded-full text-sm font-medium">Create</button>
                <button onClick={() => setShowCreatePlaylist(false)} className="px-4 py-1.5 bg-white/10 rounded-full text-sm">Cancel</button>
              </div>
            </motion.div>
          )}

          {playlists.length === 0 && !showCreatePlaylist && (
            <EmptyState icon={<FiMusic size={48} />} message="No playlists yet" sub="Create a playlist to organize your music" />
          )}

          <div className="space-y-2">
            {playlists.map((playlist) => (
              <motion.div
                key={playlist.id}
                whileHover={{ scale: 1.01 }}
                className="flex items-center gap-3 p-3 rounded-xl glass-card cursor-pointer"
                onClick={() => setView('playlist', playlist)}
              >
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/5 flex items-center justify-center flex-shrink-0">
                  {playlist.songs.length > 0 && playlist.songs[0].image?.length > 0 ? (
                    <img src={getImageUrl(playlist.songs[0].image, 'low')} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <FiMusic size={20} className="text-white/20" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium line-clamp-1">{playlist.name}</p>
                  <p className="text-xs text-white/40">{playlist.songs.length} songs</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deletePlaylist(playlist.id); }}
                  className="p-2 text-white/20 hover:text-red-400 transition-colors"
                >
                  <FiTrash2 size={16} />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
        active ? 'bg-primary text-white' : 'bg-white/10 text-white/60 hover:bg-white/15'
      }`}
    >
      {icon}
      {label}
      <span className={`text-xs ${active ? 'text-white/70' : 'text-white/30'}`}>{count}</span>
    </button>
  );
}

function EmptyState({ icon, message, sub }: { icon: React.ReactNode; message: string; sub: string }) {
  return (
    <div className="text-center py-16 text-white/30">
      <div className="flex justify-center mb-4">{icon}</div>
      <p className="text-lg font-medium">{message}</p>
      <p className="text-sm mt-1">{sub}</p>
    </div>
  );
}
