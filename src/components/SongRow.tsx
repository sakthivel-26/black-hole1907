import { usePlayerStore } from '../store/usePlayerStore';
import { getImageUrl, formatDuration } from '../services/api';
import type { Song } from '../types';
import { motion } from 'framer-motion';
import { FiPlay, FiHeart, FiPlus } from 'react-icons/fi';

interface Props {
  song: Song;
  index?: number;
  onPlay: () => void;
  showAlbum?: boolean;
}

export default function SongRow({ song, index, onPlay, showAlbum = true }: Props) {
  const { currentSong, isPlaying, toggleLike, isLiked, addToQueue } = usePlayerStore();
  const isCurrentSong = currentSong?.id === song.id;
  const liked = isLiked(song.id);
  const imageUrl = getImageUrl(song.image, 'low');

  return (
    <motion.div
      whileHover={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
      className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer group relative ${
        isCurrentSong ? 'bg-white/5' : ''
      }`}
      onClick={onPlay}
    >
      {/* Index / Play Icon */}
      <div className="w-8 flex items-center justify-center flex-shrink-0">
        {isCurrentSong && isPlaying ? (
          <div className="flex items-end gap-0.5 h-4">
            <div className="w-1 bg-primary rounded-full animate-pulse" style={{ height: '60%', animationDelay: '0ms' }} />
            <div className="w-1 bg-primary rounded-full animate-pulse" style={{ height: '100%', animationDelay: '150ms' }} />
            <div className="w-1 bg-primary rounded-full animate-pulse" style={{ height: '40%', animationDelay: '300ms' }} />
          </div>
        ) : (
          <>
            <span className="text-sm text-white/30 group-hover:hidden">{index || ''}</span>
            <FiPlay size={14} className="text-white hidden group-hover:block" />
          </>
        )}
      </div>

      {/* Image */}
      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-white/5">
        {imageUrl && <img src={imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />}
      </div>

      {/* Song Info */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium line-clamp-1 ${isCurrentSong ? 'text-primary' : 'text-white'}`}>
          {song.name}
        </p>
        <p className="text-xs text-white/40 line-clamp-1">{song.primaryArtists}</p>
      </div>

      {/* Album */}
      {showAlbum && (
        <p className="hidden md:block text-xs text-white/30 w-32 line-clamp-1">{song.album?.name}</p>
      )}

      {/* Duration */}
      <span className="text-xs text-white/30 tabular-nums hidden sm:block">
        {song.duration > 0 ? formatDuration(song.duration) : ''}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); toggleLike(song); }}
          className={`p-1.5 rounded-full hover:bg-white/10 ${liked ? 'text-primary opacity-100' : 'text-white/40'}`}
        >
          <FiHeart className={liked ? 'fill-current' : ''} size={14} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); addToQueue(song); }}
          className="p-1.5 rounded-full hover:bg-white/10 text-white/40"
          title="Add to queue"
        >
          <FiPlus size={14} />
        </button>
      </div>
    </motion.div>
  );
}
