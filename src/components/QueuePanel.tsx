import { usePlayerStore } from '../store/usePlayerStore';
import { getImageUrl, formatDuration } from '../services/api';
import { motion } from 'framer-motion';
import { FiX, FiTrash2, FiPlay, FiHeart } from 'react-icons/fi';

export default function QueuePanel() {
  const {
    queue, queueIndex, currentSong, showQueue,
    playFromQueue, removeFromQueue, clearQueue, setShowQueue,
    toggleLike, isLiked,
  } = usePlayerStore();

  if (!showQueue) return null;

  const upNext = queue.slice(queueIndex + 1);


  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25 }}
      className="fixed right-0 top-0 bottom-0 w-full md:w-96 z-[90] glass-strong flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <h2 className="text-lg font-bold">Queue</h2>
        <div className="flex items-center gap-2">
          {upNext.length > 0 && (
            <button
              onClick={clearQueue}
              className="p-2 text-white/40 hover:text-white transition-colors"
              title="Clear queue"
            >
              <FiTrash2 size={16} />
            </button>
          )}
          <button
            onClick={() => setShowQueue(false)}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <FiX size={20} />
          </button>
        </div>
      </div>

      {/* Now Playing */}
      {currentSong && (
        <div className="px-4 py-3 border-b border-white/5">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Now Playing</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
              {currentSong.image?.length > 0 && (
                <img src={getImageUrl(currentSong.image, 'low')} alt="" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-primary line-clamp-1">{currentSong.name}</p>
              <p className="text-xs text-white/40 line-clamp-1">{currentSong.primaryArtists}</p>
            </div>
          </div>
        </div>
      )}

      {/* Up Next */}
      <div className="flex-1 overflow-y-auto hide-scrollbar">
        {upNext.length > 0 && (
          <div className="px-4 py-3">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-2">
              Up Next ({upNext.length})
            </p>
            <div className="space-y-1">
              {upNext.map((song, i) => (
                <motion.div
                  key={song.queueId}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer group"
                  onClick={() => playFromQueue(queueIndex + 1 + i)}
                >
                  <div className="w-9 h-9 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                    {song.image?.length > 0 && (
                      <img src={getImageUrl(song.image, 'low')} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white/80 line-clamp-1">{song.name}</p>
                    <p className="text-xs text-white/30 line-clamp-1">{song.primaryArtists}</p>
                  </div>
                  <span className="text-xs text-white/20 tabular-nums">
                    {song.duration > 0 ? formatDuration(song.duration) : ''}
                  </span>
                  <div className="flex items-center gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleLike(song); }}
                      className={`p-1.5 rounded-full hover:bg-white/10 transition-colors ${isLiked(song.id) ? 'text-primary' : 'text-white/40'}`}
                      title="Add to favorites"
                    >
                      <FiHeart className={isLiked(song.id) ? 'fill-current' : ''} size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFromQueue(queueIndex + 1 + i); }}
                      className="p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-red-400 transition-colors"
                      title="Remove from queue"
                    >
                      <FiX size={14} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {upNext.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-white/20">
            <FiPlay size={32} className="mb-2" />
            <p className="text-sm">Queue is empty</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
