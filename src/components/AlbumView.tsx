import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FiArrowLeft, FiDownload, FiPlay, FiPlus, FiShuffle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { downloadSongFile, formatDuration, getAlbumById, getAudioQualityLabel, getImageUrl, getBestAudioQuality } from '../services/api';
import { usePlayerStore } from '../store/usePlayerStore';
import type { Album } from '../types';
import SongRow from './SongRow';

export default function AlbumView() {
  const { viewData, playSong, setView, addDownloadedSong } = usePlayerStore();
  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!viewData?.id) return;

    let active = true;
    setLoading(true);
    getAlbumById(viewData.id)
      .then((data) => {
        if (!active) return;
        setAlbum(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [viewData?.id]);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-primary" />
      </div>
    );
  }

  if (!album) return null;

  const imageUrl = getImageUrl(album.image, 'high');
  const totalDuration = album.songs.reduce((accumulator, song) => accumulator + song.duration, 0);
  const qualityLabel = album.songs[0] ? getAudioQualityLabel(album.songs[0].downloadUrl) : '';
  const releaseLabel = [album.language, album.year].filter(Boolean).join(' • ');

  const handleAlbumDownload = async () => {
    if (album.songs.length === 0) return;
    const loadingToast = toast.loading(`Downloading ${album.songs[0].name}...`);
    try {
      const result = await downloadSongFile(album.songs[0]);
      addDownloadedSong(album.songs[0]);
      toast.success(`Saved in ${result.quality}`, { id: loadingToast });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Download failed.', { id: loadingToast });
    }
  };

  return (
    <div className="px-4 pb-32 pt-6 md:px-8 md:pb-24">
      <button
        onClick={() => setView('search')}
        className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.08] hover:text-white"
      >
        <FiArrowLeft size={16} />
        Back
      </button>

      <div className="relative overflow-hidden rounded-[36px] border border-white/8 bg-[#232326] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] md:p-8">
        <div className="absolute inset-0">
          {imageUrl && (
            <img
              src={imageUrl}
              alt=""
              className="h-full w-full object-cover opacity-[0.18]"
              style={{ filter: 'blur(110px) brightness(0.42)' }}
            />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(35,35,38,0.96),rgba(35,35,38,0.82))]" />
        </div>

        <div className="relative z-10 grid gap-8 lg:grid-cols-[360px_1fr]">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mx-auto w-full max-w-[360px] overflow-hidden rounded-[30px] shadow-[0_22px_70px_rgba(0,0,0,0.34)]"
          >
            {imageUrl ? (
              <img src={imageUrl} alt={album.name} className="aspect-square w-full object-cover" />
            ) : (
              <div className="aspect-square w-full bg-white/[0.07]" />
            )}
          </motion.div>

          <div className="flex flex-col justify-center">
            <p className="text-[11px] uppercase tracking-[0.35em] text-white/35">Album</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white md:text-5xl">
              {album.name}
            </h1>
            <p className="mt-2 text-2xl text-[#ff5f79]">{album.primaryArtists}</p>
            <p className="mt-3 text-sm text-white/50">{releaseLabel || 'Soundtrack release'}</p>

            <div className="mt-6 max-w-2xl text-lg leading-8 text-white/62">
              {album.songs[0]?.label
                ? `${album.songs[0].label} soundtrack with ${album.songCount} songs and ${formatDuration(totalDuration)} of music.`
                : `Original soundtrack with ${album.songCount} songs and ${formatDuration(totalDuration)} of music.`}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={() => album.songs.length > 0 && playSong(album.songs[0], album.songs)}
                className="inline-flex items-center gap-3 rounded-full bg-white px-8 py-3.5 text-lg font-semibold text-black transition hover:scale-[1.02]"
              >
                <FiPlay size={20} className="ml-0.5" />
                Play
              </button>

              <button
                onClick={() => {
                  if (album.songs.length === 0) return;
                  const shuffled = [...album.songs].sort(() => Math.random() - 0.5);
                  playSong(shuffled[0], shuffled);
                }}
                className="rounded-full border border-white/10 bg-white/[0.05] p-4 text-white/75 transition hover:bg-white/[0.08] hover:text-white"
                title="Shuffle"
              >
                <FiShuffle size={22} />
              </button>

              <button
                onClick={handleAlbumDownload}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-5 py-3.5 text-sm text-white/72 transition hover:bg-white/[0.08] hover:text-white"
              >
                <FiDownload size={16} />
                Download
              </button>

              <button
                className="rounded-full border border-white/10 bg-white/[0.05] p-4 text-white/72 transition hover:bg-white/[0.08] hover:text-white"
                title="More actions"
              >
                <FiPlus size={20} />
              </button>
            </div>

            <div className="mt-8 border-t border-white/8 pt-6 text-sm text-white/42">
              <p>{album.songCount} songs, {formatDuration(totalDuration)} total</p>
              <p className="mt-2">{qualityLabel ? `${qualityLabel} • source maximum ${getBestAudioQuality(album.songs[0]?.downloadUrl)}` : 'Quality info unavailable'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10 space-y-1 border-t border-white/8 pt-4">
        {album.songs.map((song, index) => (
          <SongRow
            key={song.id}
            song={song}
            index={index + 1}
            onPlay={() => playSong(song, album.songs)}
            showAlbum={false}
          />
        ))}
      </div>
    </div>
  );
}
