import { create } from 'zustand';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Song, QueueItem, RepeatMode, ViewMode, UserPlaylist } from '../types';
import { getSongSuggestions, searchSongs } from '../services/api';
import { getYTSongSuggestions } from '../services/youtube';
import { getSimilarTracks } from '../services/lastfm';

type RecentSongRow = {
  id: string;
  song_id: string;
  name: string;
  primary_artists: string;
  album: string;
  image: string;
  played_at: number;
};

type PlaylistRow = {
  id: string;
  name: string;
  description: string;
  created_at: number;
  updated_at: number;
};

type PlaylistSongRow = {
  playlist_id: string;
  song_id: string;
  name: string;
  primary_artists: string;
  image: string;
  added_at: number;
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const supabase: SupabaseClient | null = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

interface PlayerState {
  // Current playback
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isLoading: boolean;

  // Queue
  queue: QueueItem[];
  queueIndex: number;
  originalQueue: QueueItem[];

  // Playback modes
  shuffle: boolean;
  repeat: RepeatMode;

  // UI State
  currentView: ViewMode;
  viewData: any;
  viewHistory: { view: ViewMode; data?: any }[];
  showNowPlaying: boolean;
  showQueue: boolean;
  showLyrics: boolean;
  searchQuery: string;
  isMobileMenuOpen: boolean;
  isPlayerBarMinimized: boolean;

  // Library
  likedSongs: Song[];
  recentlyPlayed: Song[];
  playlists: UserPlaylist[];
  downloadedSongs: Song[];

  // Audio features
  crossfade: number;
  sleepTimer: number | null;
  sleepTimerRemaining: number | null;

  // Dynamic background
  dominantColor: string;

  // Actions
  playSong: (song: Song, queue?: Song[]) => void;
  togglePlay: () => void;
  pauseSong: () => void;
  resumeSong: () => void;
  nextSong: () => void;
  prevSong: () => void;
  seekTo: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setIsLoading: (isLoading: boolean) => void;

  toggleShuffle: () => void;
  toggleRepeat: () => void;
  addToQueue: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  playFromQueue: (index: number) => void;

  setView: (view: ViewMode, data?: any) => void;
  goBack: () => void;
  setShowNowPlaying: (show: boolean) => void;
  setShowQueue: (show: boolean) => void;
  setShowLyrics: (show: boolean) => void;
  setSearchQuery: (query: string) => void;
  setMobileMenuOpen: (open: boolean) => void;
  setPlayerBarMinimized: (minimized: boolean) => void;

  toggleLike: (song: Song) => void;
  isLiked: (id: string) => boolean;
  addToRecentlyPlayed: (song: Song) => void;
  addDownloadedSong: (song: Song) => void;
  removeDownloadedSong: (songId: string) => void;
  isDownloaded: (id: string) => boolean;

  createPlaylist: (name: string, description?: string) => void;
  addToPlaylist: (playlistId: string, song: Song) => void;
  removeFromPlaylist: (playlistId: string, songId: string) => void;
  deletePlaylist: (playlistId: string) => void;

  hydrateCloudData: () => Promise<void>;

  setCrossfade: (seconds: number) => void;
  setSleepTimer: (minutes: number | null) => void;

  setDominantColor: (color: string) => void;
}

const loadFromStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const saveToStorage = (key: string, value: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage might be full
  }
};

const songFromRecentRow = (row: RecentSongRow): Song => ({
  id: row.song_id,
  name: row.name,
  album: { id: '', name: row.album, url: '' },
  year: '',
  duration: 0,
  language: '',
  playCount: 0,
  hasLyrics: false,
  label: '',
  primaryArtists: row.primary_artists,
  primaryArtistsId: '',
  featuredArtists: '',
  artists: [],
  image: row.image ? [{ quality: '500x500', url: row.image }] : [],
  downloadUrl: [],
  copyright: '',
  url: '',
});

const getCoreTitle = (title: string): string => {
  if (!title) return '';
  let core = title.toLowerCase();

  // 1. Remove anything in parentheses or brackets that looks like a version/metadata
  core = core.replace(/[\(\[][^\]\)]*(instrumental|karaoke|remix|mix|edit|cover|lofi|flip|version|reprise|tribute|slowed|reverb|from|original|ost|bgm|theme|soundtrack|official|video|audio|lyrics|full|hd|4k|hq|quality|jiosaavn|spotify|apple|video|song)[^\]\)]*[\)\]]/gi, '');

  // 2. Remove common separators and everything after them
  const separators = ['-', '|', '–', '—', ':', '/'];
  for (const sep of separators) {
    if (core.includes(sep)) {
      const parts = core.split(sep);
      if (/^\d{4}$/.test(parts[0].trim())) {
        core = parts[1] || parts[0];
      } else {
        core = parts[0];
      }
      break;
    }
  }

  // 3. Remove standalone common noise words
  const noise = ['official', 'video', 'audio', 'song', 'full', 'lyrics', 'hd', '4k', 'hq', 'track', 'music'];
  noise.forEach(word => {
    core = core.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
  });

  // 4. Remove any remaining empty parentheses
  core = core.replace(/[\(\[]\s*[\)\]]/g, '');

  return core.replace(/\s+/g, ' ').trim();
};

const isDuplicateTrack = (songA: Song, songB: Song): boolean => {
  if (songA.id === songB.id) return true;

  const cleanA = songA.name.toLowerCase();
  const cleanB = songB.name.toLowerCase();

  const normalizePhonetic = (str: string): string => {
    return str.toLowerCase()
      .replace(/[^a-z0-9]/gi, '')
      .replace(/([a-z])\1+/g, '$1')
      .replace(/ae/g, 'e')
      .replace(/ai/g, 'e')
      .replace(/y/g, 'i')
      .replace(/oo/g, 'u')
      .replace(/aa/g, 'a')
      .replace(/h/g, '');
  };

  const phoneA = normalizePhonetic(cleanA);
  const phoneB = normalizePhonetic(cleanB);

  if (phoneA && phoneB) {
    if (phoneA === phoneB) return true;
    const minLen = Math.min(phoneA.length, phoneB.length);
    if (minLen >= 5 && (phoneA.includes(phoneB) || phoneB.includes(phoneA))) {
      return true;
    }
  }

  const phoneCoreA = normalizePhonetic(getCoreTitle(songA.name));
  const phoneCoreB = normalizePhonetic(getCoreTitle(songB.name));

  if (phoneCoreA && phoneCoreB) {
    if (phoneCoreA === phoneCoreB) return true;
    const minLen = Math.min(phoneCoreA.length, phoneCoreB.length);
    if (minLen >= 5 && (phoneCoreA.includes(phoneCoreB) || phoneCoreB.includes(phoneCoreA))) {
      return true;
    }
  }

  const coreA = getCoreTitle(songA.name);
  const coreB = getCoreTitle(songB.name);

  // If core titles match exactly and they have at least one common artist
  if (coreA && coreB && coreA === coreB) {
    const artistA = (songA.primaryArtists || '').toLowerCase().split(',')[0].trim();
    const artistB = (songB.primaryArtists || '').toLowerCase().split(',')[0].trim();
    if (artistA === artistB) return true;
  }

  // Duration + Artist overlap check (highly robust for foreign titles)
  const durationDiff = Math.abs((songA.duration || 0) - (songB.duration || 0));
  if (durationDiff < 15) {
    const artistA = (songA.primaryArtists || '').toLowerCase().split(',')[0].trim();
    const artistB = (songB.primaryArtists || '').toLowerCase().split(',')[0].trim();
    if (artistA && artistB && (artistA.includes(artistB) || artistB.includes(artistA))) {
      return true;
    }
  }

  return false;
};

const dedupeQueueItems = (items: QueueItem[]): QueueItem[] => {
  const seenIds = new Set<string>();
  const deduped: QueueItem[] = [];

  for (const item of items) {
    if (!item.id || seenIds.has(item.id)) continue;
    const isDup = deduped.some(acceptedItem => isDuplicateTrack(acceptedItem, item));
    if (isDup) continue;

    seenIds.add(item.id);
    deduped.push(item);
  }

  return deduped;
};

const playlistSongFromRow = (row: PlaylistSongRow): Song => ({
  id: row.song_id,
  name: row.name,
  album: { id: '', name: '', url: '' },
  year: '',
  duration: 0,
  language: '',
  playCount: 0,
  hasLyrics: false,
  label: '',
  primaryArtists: row.primary_artists,
  primaryArtistsId: '',
  artists: [],
  image: row.image ? [{ quality: '500x500', url: row.image }] : [],
  downloadUrl: [],
  url: '',
});

const playlistToRow = (playlist: UserPlaylist): PlaylistRow => ({
  id: playlist.id,
  name: playlist.name,
  description: playlist.description,
  created_at: playlist.createdAt,
  updated_at: playlist.updatedAt,
});

const songToRecentRow = (song: Song): RecentSongRow => ({
  id: song.id,
  song_id: song.id,
  primary_artists: song.primaryArtists,
  album: song.album?.name || '',
  image: song.image?.[0]?.url || '',
  played_at: Date.now(),
});

async function syncRecentSongs(songs: Song[]) {
  if (!supabase) return;
  const rows = songs.slice(0, 50).map(songToRecentRow);
  const { error: deleteError } = await supabase.from('recent_songs').delete().neq('id', '__all__');
  if (deleteError) throw deleteError;
  if (rows.length === 0) return;
  const { error: insertError } = await supabase.from('recent_songs').insert(rows);
  if (insertError) throw insertError;
}

async function syncPlaylists(playlists: UserPlaylist[]) {
  if (!supabase) return;

  const { error: deleteSongsError } = await supabase.from('playlist_songs').delete().neq('playlist_id', '__all__');
  if (deleteSongsError) throw deleteSongsError;

  const { error: deletePlaylistsError } = await supabase.from('playlists').delete().neq('id', '__all__');
  if (deletePlaylistsError) throw deletePlaylistsError;

  if (playlists.length === 0) return;

  const playlistRows = playlists.map(playlistToRow);
  const { error: playlistInsertError } = await supabase.from('playlists').insert(playlistRows);
  if (playlistInsertError) throw playlistInsertError;

  const songRows: PlaylistSongRow[] = playlists.flatMap((playlist) =>
    playlist.songs.map((song) => ({
      playlist_id: playlist.id,
      song_id: song.id,
      name: song.name,
      primary_artists: song.primaryArtists,
      image: song.image?.[0]?.url || '',
      added_at: playlist.updatedAt,
    }))
  );

  if (songRows.length === 0) return;

  const { error: songInsertError } = await supabase.from('playlist_songs').insert(songRows);
  if (songInsertError) throw songInsertError;
}

async function loadCloudLibrary() {
  if (!supabase) return null;

  const [{ data: recentSongs, error: recentError }, { data: playlists, error: playlistError }, { data: playlistSongs, error: playlistSongsError }] = await Promise.all([
    supabase.from('recent_songs').select('*').order('played_at', { ascending: false }).limit(50),
    supabase.from('playlists').select('*').order('updated_at', { ascending: false }),
    supabase.from('playlist_songs').select('*').order('added_at', { ascending: false }),
  ]);

  if (recentError) throw recentError;
  if (playlistError) throw playlistError;
  if (playlistSongsError) throw playlistSongsError;

  const groupedSongs = new Map<string, Song[]>();
  for (const row of (playlistSongs || []) as PlaylistSongRow[]) {
    const current = groupedSongs.get(row.playlist_id) || [];
    current.push(playlistSongFromRow(row));
    groupedSongs.set(row.playlist_id, current);
  }

  return {
    recentlyPlayed: (recentSongs || []).map(songFromRecentRow),
    playlists: (playlists || []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      coverImage: '',
      songs: groupedSongs.get(row.id) || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })) as UserPlaylist[],
  };
}

let queueCounter = 0;
const toQueueItem = (song: Song): QueueItem => ({
  ...song,
  queueId: `q_${Date.now()}_${queueCounter++}`,
});

const isTamilArtist = (item: Song | QueueItem): boolean => {
  const artists = (item.primaryArtists || '').toLowerCase();
  const tamilArtists = [
    'anirudh', 'rahman', 'harris jayaraj', 'yuvan', 'santhosh narayanan', 
    'g.v. prakash', 'gv prakash', 'imman', 'ilayaraja', 'ilaiyaraaja', 
    'deva', 'vidyasagar', 's. p. balasubrahmanyam', 'spb', 'chithra', 
    'janaki', 'shreya ghoshal', 'sid sriram', 'karthik', 'hariharan', 
    'vijay yesudas', 'unnikrishnan', 'swetha mohan', 'chinmayi', 
    'pradeep kumar', 'dhee', 'saindhavi', 'shakthisree', 'anuradha sriram'
  ];
  return tamilArtists.some(artist => artists.includes(artist));
};

const isTamilSong = (item: Song | QueueItem): boolean => {
  const sLang = (item.language || '').toLowerCase();
  return sLang.includes('tamil') || isTamilArtist(item);
};

const fetchVibeSuggestions = async (song: Song): Promise<Song[]> => {
  try {
    // 1. Try Last.fm Suggestions (extremely high-quality recommendations database)
    const similarQueries = await getSimilarTracks(song);
    let suggestions: Song[] = [];
    
    if (similarQueries.length > 0) {
      // Search for the top 5 similar songs on the music API
      const searchPromises = similarQueries.slice(0, 5).map(query => searchSongs(query, 1, 1));
      const searchResults = await Promise.allSettled(searchPromises);
      suggestions = searchResults
        .flatMap(r => r.status === 'fulfilled' ? r.value.results : []);
    }

    // 2. Fallback to Saavn Suggestions if Last.fm returned nothing
    if (suggestions.length < 5 && !song.id.startsWith('yt_')) {
      const native = await getSongSuggestions(song.id);
      suggestions = dedupeQueueItems([...suggestions, ...native].map(toQueueItem));
    }

    // 3. Last fallback: YouTube
    if (suggestions.length < 3) {
      const yt = await getYTSongSuggestions(song);
      suggestions = dedupeQueueItems([...suggestions, ...yt].map(toQueueItem));
    }
    return suggestions;
  } catch (e) {
    console.error('Failed to fetch vibe suggestions:', e);
    return [];
  }
};

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: loadFromStorage('volume', 0.8),
  isMuted: false,
  isLoading: false,

  queue: [],
  queueIndex: -1,
  originalQueue: [],

  shuffle: loadFromStorage('shuffle', false),
  repeat: loadFromStorage('repeat', 'off') as RepeatMode,

  currentView: 'home',
  viewData: null,
  viewHistory: [],
  showNowPlaying: false,
  showQueue: false,
  showLyrics: false,
  searchQuery: '',
  isMobileMenuOpen: false,
  isPlayerBarMinimized: false,

  likedSongs: loadFromStorage('likedSongs', []),
  recentlyPlayed: loadFromStorage('recentlyPlayed', []),
  playlists: loadFromStorage('playlists', []),
  downloadedSongs: loadFromStorage('downloadedSongs', []),

  crossfade: loadFromStorage('crossfade', 0),
  sleepTimer: null,
  sleepTimerRemaining: null,

  dominantColor: '#1a1a2e',

  playSong: (song, queueSongs) => {
    const state = get();
    let newQueue: QueueItem[];
    let newIndex: number;

    const isFromSearch = state.currentView === 'search';

    if (isFromSearch) {
      // Apple Music Style: Clear repetitive results and start a radio
      newQueue = [toQueueItem(song)];
      newIndex = 0;
    } else if (queueSongs && queueSongs.length > 0) {
      newQueue = dedupeQueueItems(queueSongs.map(toQueueItem));
      newIndex = newQueue.findIndex((item) => item.id === song.id);
      if (newIndex === -1) newIndex = 0;
    } else {
      const existingIndex = state.queue.findIndex(q => q.id === song.id);
      if (existingIndex !== -1) {
        newQueue = state.queue;
        newIndex = existingIndex;
      } else {
        newQueue = dedupeQueueItems([...state.queue, toQueueItem(song)]);
        newIndex = newQueue.length - 1;
      }
    }

    set({
      currentSong: song,
      queue: newQueue,
      queueIndex: newIndex,
      originalQueue: queueSongs ? dedupeQueueItems(queueSongs.map(toQueueItem)) : newQueue,
      isPlaying: true,
      currentTime: 0,
      isLoading: true,
    });

    get().addToRecentlyPlayed(song);

    // Fetch Apple-style radio suggestions
    fetchVibeSuggestions(song).then(suggestions => {
      if (suggestions.length > 0) {
        const stateNow = get();
        const currentQueue = stateNow.queue;
        const curIndex = stateNow.queueIndex;
        if (curIndex === -1) return;

        const existingIds = new Set(currentQueue.map(q => q.id));
        const newSuggestions = suggestions
          .filter(s => !existingIds.has(s.id) && !isDuplicateTrack(song, s))
          .map(toQueueItem);

        if (newSuggestions.length > 0) {
          const played = currentQueue.slice(0, curIndex + 1);
          const remaining = isFromSearch ? [] : currentQueue.slice(curIndex + 1);
          set({ queue: dedupeQueueItems([...played, ...newSuggestions, ...remaining]) });
        }
      }
    });
  },

  togglePlay: () => set(s => ({ isPlaying: !s.isPlaying })),
  pauseSong: () => set({ isPlaying: false }),
  resumeSong: () => set({ isPlaying: true }),

  nextSong: async () => {
    const { queue, queueIndex, repeat, currentSong } = get();
    if (queue.length === 0) return;

    if (repeat === 'one') {
      set({ currentTime: 0 });
      return;
    }

    if (queueIndex < queue.length - 1) {
      const nextIdx = queueIndex + 1;
      set({ currentSong: queue[nextIdx], queueIndex: nextIdx, currentTime: 0, isPlaying: true });
      return;
    }

    if (repeat === 'all') {
      set({ currentSong: queue[0], queueIndex: 0, currentTime: 0, isPlaying: true });
      return;
    }

    // Autoplay logic
    if (currentSong) {
      set({ isLoading: true });
      const suggestions = await fetchVibeSuggestions(currentSong);
      const newSuggestions = suggestions.filter(s => !get().queue.some(q => q.id === s.id)).map(toQueueItem);
      if (newSuggestions.length > 0) {
        const updatedQueue = [...get().queue, ...newSuggestions];
        set({ queue: updatedQueue, currentSong: newSuggestions[0], queueIndex: queueIndex + 1, currentTime: 0, isPlaying: true, isLoading: false });
      }
    }
  },

  prevSong: () => {
    const { queue, queueIndex, currentTime } = get();
    if (currentTime > 3) {
      set({ currentTime: 0 });
      return;
    }
    if (queueIndex > 0) {
      const prevIdx = queueIndex - 1;
      set({ currentSong: queue[prevIdx], queueIndex: prevIdx, currentTime: 0, isPlaying: true });
    }
  },

  seekTo: (time) => set({ currentTime: time }),
  setVolume: (volume) => {
    set({ volume, isMuted: volume === 0 });
    saveToStorage('volume', volume);
  },
  toggleMute: () => set(s => ({ isMuted: !s.isMuted })),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setIsLoading: (isLoading) => set({ isLoading }),

  toggleShuffle: () => {
    const { queue, queueIndex, shuffle, originalQueue, currentSong } = get();
    if (!shuffle) {
      const current = queue[queueIndex];
      const others = queue.filter((_, i) => i !== queueIndex);
      for (let i = others.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [others[i], others[j]] = [others[j], others[i]];
      }
      set({ queue: [current, ...others], queueIndex: 0, shuffle: true });
    } else {
      const originalIndex = originalQueue.findIndex(q => q.id === currentSong?.id);
      set({ queue: [...originalQueue], queueIndex: Math.max(0, originalIndex), shuffle: false });
    }
  },

  toggleRepeat: () => {
    const modes: RepeatMode[] = ['off', 'all', 'one'];
    const next = modes[(modes.indexOf(get().repeat) + 1) % modes.length];
    set({ repeat: next });
    saveToStorage('repeat', next);
  },

  addToQueue: (song) => set(s => ({ queue: dedupeQueueItems([...s.queue, toQueueItem(song)]) })),
  removeFromQueue: (index) => {
    const { queue, queueIndex } = get();
    const newQueue = queue.filter((_, i) => i !== index);
    set({ queue: newQueue, queueIndex: index < queueIndex ? queueIndex - 1 : queueIndex });
  },
  clearQueue: () => set({ queue: [], queueIndex: -1 }),
  playFromQueue: (index) => set({ currentSong: get().queue[index], queueIndex: index, currentTime: 0, isPlaying: true }),

  setView: (view, data) => set(s => ({ currentView: view, viewData: data, viewHistory: [...s.viewHistory, { view: s.currentView, data: s.viewData }].slice(-50) })),
  goBack: () => {
    const history = [...get().viewHistory];
    const last = history.pop();
    if (last) set({ currentView: last.view, viewData: last.data, viewHistory: history });
  },
  setShowNowPlaying: (show) => set({ showNowPlaying: show }),
  setShowQueue: (show) => set({ showQueue: show }),
  setShowLyrics: (show) => set({ showLyrics: show }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),
  setPlayerBarMinimized: (minimized) => set({ isPlayerBarMinimized: minimized }),

  toggleLike: (song) => {
    const liked = get().likedSongs.some(s => s.id === song.id)
      ? get().likedSongs.filter(s => s.id !== song.id)
      : [song, ...get().likedSongs];
    set({ likedSongs: liked });
    saveToStorage('likedSongs', liked);
  },
  isLiked: (id) => get().likedSongs.some(s => s.id === id),

  addToRecentlyPlayed: (song) => {
    const recent = [song, ...get().recentlyPlayed.filter(s => s.id !== song.id)].slice(0, 50);
    set({ recentlyPlayed: recent });
    saveToStorage('recentlyPlayed', recent);
    void syncRecentSongs(recent);
  },

  addDownloadedSong: (song) => {
    const downloaded = [song, ...get().downloadedSongs.filter(s => s.id !== song.id)];
    set({ downloadedSongs: downloaded });
    saveToStorage('downloadedSongs', downloaded);
  },
  removeDownloadedSong: (songId) => {
    const downloaded = get().downloadedSongs.filter(s => s.id !== songId);
    set({ downloadedSongs: downloaded });
    saveToStorage('downloadedSongs', downloaded);
  },
  isDownloaded: (id) => get().downloadedSongs.some(s => s.id === id),

  createPlaylist: (name, description = '') => {
    const playlists = [{ id: `pl_${Date.now()}`, name, description, coverImage: '', songs: [], createdAt: Date.now(), updatedAt: Date.now() }, ...get().playlists];
    set({ playlists });
    saveToStorage('playlists', playlists);
    void syncPlaylists(playlists);
  },
  addToPlaylist: (id, song) => {
    const playlists = get().playlists.map(p => p.id === id && !p.songs.some(s => s.id === song.id) ? { ...p, songs: [...p.songs, song], updatedAt: Date.now() } : p);
    set({ playlists });
    saveToStorage('playlists', playlists);
    void syncPlaylists(playlists);
  },
  removeFromPlaylist: (id, songId) => {
    const playlists = get().playlists.map(p => p.id === id ? { ...p, songs: p.songs.filter(s => s.id !== songId), updatedAt: Date.now() } : p);
    set({ playlists });
    saveToStorage('playlists', playlists);
    void syncPlaylists(playlists);
  },
  deletePlaylist: (id) => {
    const playlists = get().playlists.filter(p => p.id !== id);
    set({ playlists });
    saveToStorage('playlists', playlists);
    void syncPlaylists(playlists);
  },

  hydrateCloudData: async () => {
    const cloud = await loadCloudLibrary();
    if (cloud) {
      set({ recentlyPlayed: cloud.recentlyPlayed, playlists: cloud.playlists });
      saveToStorage('recentlyPlayed', cloud.recentlyPlayed);
      saveToStorage('playlists', cloud.playlists);
    }
  },

  setCrossfade: (s) => { set({ crossfade: s }); saveToStorage('crossfade', s); },
  setSleepTimer: (m) => {
    if ((globalThis as any)._sleepTimerInterval) {
      clearInterval((globalThis as any)._sleepTimerInterval);
      (globalThis as any)._sleepTimerInterval = null;
    }

    if (m === null) {
      set({ sleepTimer: null, sleepTimerRemaining: null });
      return;
    }

    const seconds = m * 60;
    set({ sleepTimer: m, sleepTimerRemaining: seconds });

    (globalThis as any)._sleepTimerInterval = setInterval(() => {
      const state = get();
      const remaining = state.sleepTimerRemaining;
      if (remaining === null || remaining <= 0) {
        clearInterval((globalThis as any)._sleepTimerInterval);
        (globalThis as any)._sleepTimerInterval = null;
        set({ sleepTimer: null, sleepTimerRemaining: null });
        return;
      }

      const nextRemaining = remaining - 1;
      if (nextRemaining === 0) {
        clearInterval((globalThis as any)._sleepTimerInterval);
        (globalThis as any)._sleepTimerInterval = null;
        get().setIsPlaying(false);
        set({ sleepTimer: null, sleepTimerRemaining: null });
      } else {
        set({ sleepTimerRemaining: nextRemaining });
      }
    }, 1000);
  },
  setDominantColor: (c) => set({ dominantColor: c }),
}));
