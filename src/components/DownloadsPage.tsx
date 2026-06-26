import { motion } from 'framer-motion';
import { FiDownload, FiMusic, FiPlay, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { downloadSongFile, getAudioQualityLabel, getImageUrl } from '../services/api';
import { usePlayerStore } from '../store/usePlayerStore';

export default function DownloadsPage() {
  const {
    downloadedSongs,
    playSong,
    removeDownloadedSong,
    addDownloadedSong,
  } = usePlayerStore();

  const handleRedownload = async (song: (typeof downloadedSongs)[number]) => {
    const loadingToast = toast.loading(`Downloading ${song.name}...`);
    try {
      const result = await downloadSongFile(song);
      addDownloadedSong(song);
      toast.success(`Saved ${result.fileName}`, { id: loadingToast });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Download failed.', { id: loadingToast });
    }
  };

  return (
    <div className="px-4 pb-32 pt-6 md:px-8 md:pb-24">
      <header className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.35em] text-white/35">Library</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white md:text-5xl">Downloads</h1>
          <p className="mt-2 text-sm text-white/50">
            Offline-ready tracks you saved from Black Hole. Playback still uses the highest stream quality available from the source.
          </p>
        </div>

        <div className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/70">
          {downloadedSongs.length} saved songs
        </div>
      </header>

      {downloadedSongs.length === 0 ? (
        <div className="rounded-[28px] border border-white/8 bg-white/[0.04] px-6 py-16 text-center text-white/40">
          <FiDownload className="mx-auto mb-4" size={44} />
          <p className="text-lg font-medium text-white">No downloads yet</p>
          <p className="mt-2 text-sm text-white/45">Use the download button from the player to save songs here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {downloadedSongs.map((song) => (
            <motion.div
              key={song.id}
              whileHover={{ y: -2 }}
              className="flex flex-col gap-4 rounded-[24px] border border-white/8 bg-white/[0.04] p-4 md:flex-row md:items-center"
            >
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 overflow-hidden rounded-2xl bg-white/[0.06]">
                  {getImageUrl(song.image, 'medium') ? (
                    <img
                      src={getImageUrl(song.image, 'medium')}
                      alt={song.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/25">
                      <FiMusic size={22} />
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="line-clamp-1 text-lg font-medium text-white">{song.name}</p>
                  <p className="line-clamp-1 text-sm text-white/45">{song.primaryArtists}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.25em] text-white/30">
                    {getAudioQualityLabel(song.downloadUrl)}
                  </p>
                </div>
              </div>

              <div className="flex flex-1 items-center justify-end gap-2">
                <button
                  onClick={() => playSong(song, downloadedSongs)}
                  className="inline-flex items-center gap-2 rounded-full bg-[#ff375f] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#ff5878]"
                >
                  <FiPlay size={16} className="ml-0.5" />
                  Play
                </button>
                <button
                  onClick={() => handleRedownload(song)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                >
                  <FiRefreshCw size={15} />
                  Download again
                </button>
                <button
                  onClick={() => removeDownloadedSong(song.id)}
                  className="rounded-full p-3 text-white/35 transition hover:bg-white/[0.06] hover:text-white"
                  title="Remove from downloads"
                >
                  <FiTrash2 size={16} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
