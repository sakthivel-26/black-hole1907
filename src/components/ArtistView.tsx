import { useEffect, useState } from 'react';
import { usePlayerStore } from '../store/usePlayerStore';
import { getArtistById, getArtistSongs, getImageUrl } from '../services/api';
import type { Song } from '../types';
import { motion } from 'framer-motion';
import { FiPlay, FiArrowLeft } from 'react-icons/fi';
import SongRow from './SongRow';

export default function ArtistView() {
  const { viewData, playSong, setView } = usePlayerStore();
  const [artist, setArtist] = useState<any>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (viewData?.id) {
      setLoading(true);
      Promise.allSettled([
        getArtistById(viewData.id),
        getArtistSongs(viewData.id),
      ]).then(([artistRes, songsRes]) => {
        if (artistRes.status === 'fulfilled') setArtist(artistRes.value);
        if (songsRes.status === 'fulfilled') setSongs(songsRes.value.results);
        setLoading(false);
      });
    }
  }, [viewData?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-10 h-10 border-2 border-white/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const imageUrl = getImageUrl(artist?.image || viewData?.image, 'high');
  const name = artist?.name || viewData?.name || '';

  return (
    <div className="pb-32 md:pb-24">
      {/* Header */}
      <div className="relative">
        <div className="absolute inset-0 h-80 z-0 overflow-hidden">
          {imageUrl && (
            <img src={imageUrl} alt="" className="w-full h-full object-cover" style={{ filter: 'blur(60px) brightness(0.3)' }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black" />
        </div>

        <div className="relative z-10 px-4 md:px-8 pt-4 pb-6">
          <button
            onClick={() => setView('home')}
            className="p-2 rounded-full hover:bg-white/10 transition-colors mb-4"
          >
            <FiArrowLeft size={20} />
          </button>

          <div className="flex flex-col items-center md:items-start gap-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-40 h-40 rounded-full overflow-hidden shadow-2xl bg-white/5"
            >
              {imageUrl && <img src={imageUrl} alt={name} className="w-full h-full object-cover" />}
            </motion.div>

            <div className="text-center md:text-left">
              <p className="text-xs uppercase tracking-wider text-white/40 mb-1">Artist</p>
              <h1 className="text-3xl md:text-4xl font-bold">{name}</h1>
              {artist?.fanCount && (
                <p className="text-sm text-white/40 mt-1">{Number(artist.fanCount).toLocaleString()} fans</p>
              )}
            </div>
          </div>

          {songs.length > 0 && (
            <div className="flex gap-3 mt-6 justify-center md:justify-start">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => playSong(songs[0], songs)}
                className="flex items-center gap-2 px-8 py-3 bg-primary rounded-full font-medium"
              >
                <FiPlay size={18} className="ml-0.5" />
                Play
              </motion.button>
            </div>
          )}
        </div>
      </div>

      {/* Songs */}
      {songs.length > 0 && (
        <div className="px-4 md:px-8 mt-4">
          <h2 className="text-xl font-bold mb-3">Popular Songs</h2>
          <div className="space-y-0.5">
            {songs.map((song, i) => (
              <SongRow key={song.id} song={song} index={i + 1} onPlay={() => playSong(song, songs)} />
            ))}
          </div>
        </div>
      )}

      {songs.length === 0 && (
        <div className="px-4 md:px-8 mt-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
            <p className="text-base font-medium text-white/85">No songs available right now</p>
            <p className="mt-2 text-sm text-white/45">
              The artist profile loaded, but this source did not return tracks at the moment.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
