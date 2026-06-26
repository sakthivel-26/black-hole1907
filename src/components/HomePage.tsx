import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FiChevronRight,
  FiDisc,
  FiHeadphones,
  FiMoreHorizontal,
  FiMusic,
  FiPlay,
  FiRadio,
} from 'react-icons/fi';
import { searchSongs, getImageUrl, formatDuration } from '../services/api';
import { usePlayerStore } from '../store/usePlayerStore';
import type { Song } from '../types';

interface ShelfConfig {
  title: string;
  subtitle: string;
  curator: string;
  query: string;
}

interface ShelfSection extends ShelfConfig {
  songs: Song[];
  loading: boolean;
}

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date());

const QUICK_FILTERS = [
  { label: 'Tamil', query: `latest tamil songs ${CURRENT_YEAR}` },
  { label: 'Hindi', query: `latest hindi songs ${CURRENT_YEAR}` },
  { label: 'Telugu', query: `latest telugu songs ${CURRENT_YEAR}` },
  { label: 'Punjabi', query: `latest punjabi songs ${CURRENT_YEAR}` },
  { label: 'International', query: `english songs ${CURRENT_YEAR}` },
  { label: 'Love Songs', query: 'romantic tamil songs' },
];

const FEATURED_SHELVES: ShelfConfig[] = [
  {
    title: "Everyone's Listening To...",
    subtitle: 'Fresh picks with huge replay value.',
    curator: 'Black Hole Tamil',
    query: `trending tamil songs ${CURRENT_MONTH} ${CURRENT_YEAR}`,
  },
  {
    title: 'DJ Mixes',
    subtitle: 'High-energy playlists for quick starts.',
    curator: 'Black Hole DJ',
    query: `latest dj mix tamil ${CURRENT_YEAR}`,
  },
  {
    title: 'Late Night Playback',
    subtitle: 'Warm vocals, softer textures, slower nights.',
    curator: 'Black Hole Chill',
    query: `fresh lofi tamil songs ${CURRENT_YEAR}`,
  },
];

function chunkSongs(songs: Song[], size: number) {
  const chunks: Song[][] = [];
  for (let index = 0; index < songs.length; index += size) {
    chunks.push(songs.slice(index, index + size));
  }
  return chunks;
}

export default function HomePage() {
  const {
    playSong,
    recentlyPlayed,
    likedSongs,
    setView,
    setSearchQuery,
  } = usePlayerStore();
  const [trendingSongs, setTrendingSongs] = useState<Song[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [shelves, setShelves] = useState<ShelfSection[]>(
    FEATURED_SHELVES.map((section) => ({ ...section, songs: [], loading: true }))
  );

  useEffect(() => {
    let active = true;

    searchSongs(`latest trending tamil songs ${CURRENT_MONTH} ${CURRENT_YEAR}`, 1, 12)
      .then((data) => {
        if (!active) return;
        setTrendingSongs(data.results);
      })
      .catch(() => {
        if (!active) return;
        setTrendingSongs([]);
      })
      .finally(() => {
        if (active) setTrendingLoading(false);
      });

    FEATURED_SHELVES.forEach((section, index) => {
      searchSongs(section.query, 1, 10)
        .then((data) => {
          if (!active) return;
          setShelves((previous) =>
            previous.map((entry, entryIndex) =>
              entryIndex === index ? { ...entry, songs: data.results, loading: false } : entry
            )
          );
        })
        .catch(() => {
          if (!active) return;
          setShelves((previous) =>
            previous.map((entry, entryIndex) =>
              entryIndex === index ? { ...entry, loading: false } : entry
            )
          );
        });
    });

    return () => {
      active = false;
    };
  }, []);

  const trendingColumns = chunkSongs(trendingSongs, 4);

  const handleQuickFilter = (query: string) => {
    setSearchQuery(query);
    setView('search');
  };

  return (
    <div className="px-4 pb-32 pt-6 md:px-8 md:pb-24">
      <header className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.35em] text-white/35">Browse</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">Listen Now</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55 md:text-base">
              Trending songs, big soundtracks, and fast ways into Tamil, Hindi, Telugu, and Punjabi music.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {QUICK_FILTERS.map((filter) => (
              <button
                key={filter.label}
                onClick={() => handleQuickFilter(filter.query)}
                className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white/75 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="mb-14">
        <SectionHeading title="Trending Songs" />

        {trendingLoading ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, columnIndex) => (
              <div key={columnIndex} className="rounded-[26px] border border-white/8 bg-white/[0.03] p-4">
                {Array.from({ length: 4 }).map((__, rowIndex) => (
                  <div
                    key={rowIndex}
                    className={`flex items-center gap-3 py-3 ${
                      rowIndex < 3 ? 'border-b border-white/8' : ''
                    }`}
                  >
                    <div className="h-14 w-14 rounded-xl shimmer" />
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 h-4 w-3/4 rounded-full shimmer" />
                      <div className="h-3 w-1/2 rounded-full shimmer" />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          trendingColumns.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {trendingColumns.map((column, columnIndex) => (
                <div
                  key={columnIndex}
                  className="rounded-[26px] border border-white/8 bg-white/[0.03] px-4 py-2 shadow-[0_16px_50px_rgba(0,0,0,0.18)]"
                >
                  {column.map((song, index) => (
                    <button
                      key={song.id}
                      onClick={() => playSong(song, trendingSongs)}
                      className={`group flex w-full items-center gap-4 py-3 text-left ${
                        index < column.length - 1 ? 'border-b border-white/8' : ''
                      }`}
                    >
                      <div className="h-14 w-14 overflow-hidden rounded-xl bg-white/6">
                        {getImageUrl(song.image, 'medium') ? (
                          <img
                            src={getImageUrl(song.image, 'medium')}
                            alt={song.name}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-white/35">
                            <FiMusic size={22} />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-[17px] font-medium text-white transition group-hover:text-[#ff5d73]">
                          {song.name}
                        </p>
                        <p className="line-clamp-1 text-sm text-white/50">{song.primaryArtists}</p>
                      </div>

                      <div className="hidden text-xs text-white/35 sm:block">
                        {song.duration > 0 ? formatDuration(song.duration) : ''}
                      </div>

                      <FiMoreHorizontal className="text-white/30 transition group-hover:text-white/70" size={18} />
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[26px] border border-white/8 bg-white/[0.03] px-6 py-12 text-center text-white/45">
              Trending songs could not be loaded right now.
            </div>
          )
        )}
      </section>

      {recentlyPlayed.length > 0 && (
        <section className="mb-14">
          <SectionHeading title="Recently Played" />
          <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar">
            {recentlyPlayed.slice(0, 8).map((song) => (
              <PosterCard
                key={song.id}
                eyebrow="Recent"
                title={song.name}
                subtitle={song.primaryArtists}
                imageUrl={getImageUrl(song.image, 'high')}
                onClick={() => playSong(song, recentlyPlayed)}
              />
            ))}
          </div>
        </section>
      )}

      {shelves.map((section, sectionIndex) => (
        <section key={section.title} className="mb-14">
          <SectionHeading title={section.title} />
          <p className="mb-4 text-sm text-white/45">{section.subtitle}</p>

          <div className="flex gap-5 overflow-x-auto pb-2 hide-scrollbar">
            {section.loading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="w-[240px] flex-shrink-0">
                    <div className="aspect-square rounded-[24px] shimmer" />
                    <div className="mt-3 h-4 w-4/5 rounded-full shimmer" />
                    <div className="mt-2 h-3 w-1/2 rounded-full shimmer" />
                  </div>
                ))
              : section.songs.map((song, index) => (
                  <PosterCard
                    key={`${section.title}-${song.id}`}
                    eyebrow={index === 0 ? section.curator : sectionIndex % 2 === 0 ? 'Apple-style Mix' : 'Featured'}
                    title={song.album?.name || song.name}
                    subtitle={song.primaryArtists}
                    imageUrl={getImageUrl(song.image, 'high')}
                    onClick={() => playSong(song, section.songs)}
                  />
                ))}
          </div>
        </section>
      ))}

      {likedSongs.length > 0 && (
        <section className="mb-6">
          <SectionHeading title="Saved For You" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {likedSongs.slice(0, 6).map((song) => (
              <motion.button
                key={song.id}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => playSong(song, likedSongs)}
                className="flex items-center gap-4 rounded-[22px] border border-white/8 bg-white/[0.04] px-4 py-3 text-left"
              >
                <div className="h-16 w-16 overflow-hidden rounded-2xl bg-white/6">
                  {getImageUrl(song.image, 'medium') ? (
                    <img
                      src={getImageUrl(song.image, 'medium')}
                      alt={song.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-white/35">
                      <FiDisc size={20} />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-base font-medium text-white">{song.name}</p>
                  <p className="line-clamp-1 text-sm text-white/45">{song.primaryArtists}</p>
                </div>

                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ff375f] text-white shadow-[0_10px_30px_rgba(255,55,95,0.25)]">
                  <FiPlay size={16} className="ml-0.5" />
                </div>
              </motion.button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <h2 className="text-[2rem] font-semibold tracking-tight text-white">{title}</h2>
      <FiChevronRight className="mt-1 text-white/50" size={20} />
    </div>
  );
}

function PosterCard({
  eyebrow,
  title,
  subtitle,
  imageUrl,
  onClick,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-[240px] flex-shrink-0 text-left"
    >
      <div className="relative aspect-square overflow-hidden rounded-[24px] bg-[#2b2b2e] shadow-[0_22px_60px_rgba(0,0,0,0.24)]">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover transition duration-300 hover:scale-[1.03]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#5d2141] via-[#432256] to-[#2c315f] text-white/60">
            <FiHeadphones size={30} />
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">
          <span>{eyebrow}</span>
          <span className="rounded-full border border-white/12 bg-black/20 px-2 py-1 normal-case tracking-normal text-white/75">
            <FiRadio size={12} />
          </span>
        </div>
      </div>

      <p className="mt-3 line-clamp-2 text-[1.05rem] font-medium leading-6 text-white">{title}</p>
      <p className="mt-1 line-clamp-2 text-sm leading-5 text-white/45">{subtitle}</p>
    </motion.button>
  );
}
