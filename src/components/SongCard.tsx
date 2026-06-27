import { motion } from 'framer-motion';
import { FiPlay } from 'react-icons/fi';
import { getImageUrl } from '../services/api';
import type { Song } from '../types';

interface Props {
  song: Song;
  onPlay: () => void;
}

export default function SongCard({ song, onPlay }: Props) {
  const imageUrl = getImageUrl(song.image, 'medium');

  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className="w-40 flex-shrink-0 cursor-pointer group"
      onClick={onPlay}
    >
      <div className="relative w-40 h-40 rounded-2xl overflow-hidden mb-2 bg-white/5">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={song.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20">
            <FiPlay size={32} />
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            whileHover={{ opacity: 1, scale: 1 }}
            className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          >
            <FiPlay size={20} className="text-white ml-0.5" />
          </motion.div>
        </div>
      </div>
      <p className="text-sm font-medium text-white line-clamp-1">{song.name}</p>
      <p className="text-xs text-white/40 line-clamp-1">{song.primaryArtists}</p>
    </motion.div>
  );
}
