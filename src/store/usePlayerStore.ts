import { create } from 'zustand';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Song, QueueItem, RepeatMode, ViewMode, UserPlaylist } from '../types';
import { getSongSuggestions } from '../services/api';
import { getYTSongSuggestions } from '../services/youtube';

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
  downloadedSongs: Song[];

  // Audio features
  crossfade: number;
  sleepTimer: number | null;

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
  return (title || '')
    .toLowerCase()
    .replace(/\(from ".*?"\)/gi, '')
    .replace(/\[from ".*?"\]/gi, '')
    .replace(/\(.*? (remix|mix|edit|cover|lofi|flip|version|reprise|tribute|slowed|reverb)\)/gi, '')
    .replace(/\[.*? (remix|mix|edit|cover|lofi|flip|version|reprise|tribute|slowed|reverb)\]/gi, '')
    .replace(/\(original.*?\)/gi, '')
    .replace(/ - (single|ep|remix|mix|edit|cover|lofi|flip|version|reprise|tribute)$/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

const dedupeQueueItems = (items: QueueItem[]): QueueItem[] => {
  const seenIds = new Set<string>();
  const seenCoreTitles = new Set<string>();
  const seenArtistKeys = new Set<string>();

  return items.filter((item) => {
    if (!item.id || seenIds.has(item.id)) return false;
    seenIds.add(item.id);

    const coreTitle = getCoreTitle(item.name);
    const primaryArtist = (item.primaryArtists || '').split(',')[0].toLowerCase().trim();
    const artistKey = `${coreTitle}|${primaryArtist}`;

    // Aggressive deduplication:
    // 1. If we've seen this exact song/artist combo, skip.
    if (seenArtistKeys.has(artistKey)) return false;

    // 2. If we've seen this core title recently (preventing 5 different covers of one song in a row), skip.
    // We allow the same title if it's far apart in the queue, but for "Up Next", we want variety.
    if (seenCoreTitles.has(coreTitle)) return false;

    seenCoreTitles.add(coreTitle);
    seenArtistKeys.add(artistKey);

    return true;
  });
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
    let suggestions: Song[] = [];
    if (!song.id.startsWith('yt_')) {
      suggestions = await getSongSuggestions(song.id);
    }
    if (suggestions.length === 0) {
      suggestions = await getYTSongSuggestions(song);
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

  dominantColor: '#1a1a2e',

  playSong: (song, queueSongs) => {
    const state = get();
    let newQueue: QueueItem[];
    let newIndex: number;

    if (queueSongs && queueSongs.length > 0) {
      newQueue = dedupeQueueItems(queueSongs.map(toQueueItem));
      newIndex = queueSongs.findIndex(s => s.id === song.id);
      if (newIndex === -1) newIndex = 0;
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

    if (state.shuffle) {
      const current = newQueue[newIndex];
      const others = newQueue.filter((_, i) => i !== newIndex);
      for (let i = others.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [others[i], others[j]] = [others[j], others[i]];
      }
      newQueue = dedupeQueueItems([current, ...others]);
      newIndex = 0;
    }

    // Reorder the remaining queue to prioritize the current song's language
    const currentLang = (song.language || '').toLowerCase();
    const isCurrentTamil = isTamilSong(song);

    if (newQueue.length > 1 && !state.shuffle) {
      const played = newQueue.slice(0, newIndex + 1);
      const remaining = newQueue.slice(newIndex + 1);
      
      const sameLang: QueueItem[] = [];
      const otherLang: QueueItem[] = [];
      
      for (const item of remaining) {
        const isMatch = isCurrentTamil ? isTamilSong(item) : (currentLang && (item.language || '').toLowerCase().includes(currentLang));
        if (isMatch) {
          sameLang.push(item);
        } else {
          otherLang.push(item);
        }
      }
      newQueue = [...played, ...sameLang, ...otherLang];
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

    // Add to recently played
    get().addToRecentlyPlayed(song);

    // Auto-load suggestions for queue (prioritize matching language/vibe)
    // If playing from search, we prefer radio-mode (suggestions) over search-list
    const currentView = state.currentView;
    const isFromSearch = currentView === 'search';
    const shouldFetchSuggestions = isFromSearch || newQueue.length <= 5;

    if (shouldFetchSuggestions) {
      fetchVibeSuggestions(song).then(suggestions => {
        if (suggestions.length > 0) {
          const stateNow = get();
          const currentQueue = stateNow.queue;
          const curIndex = stateNow.queueIndex;
          if (curIndex === -1) return;

          const existingIds = new Set(currentQueue.map(q => q.id));
          const existingCoreKeys = new Set(currentQueue.map(q => `${getCoreTitle(q.name)}|${(q.primaryArtists || '').split(',')[0].toLowerCase().trim()}`));

          const newSuggestions = suggestions
            .filter(s => {
              const idExists = existingIds.has(s.id);
              const key = `${getCoreTitle(s.name)}|${(s.primaryArtists || '').split(',')[0].toLowerCase().trim()}`;
              const coreExists = existingCoreKeys.has(key);
              return !idExists && !coreExists;
            })
            .map(toQueueItem);
            
          if (newSuggestions.length > 0) {
            const sameLanguage = newSuggestions.filter(s => {
              if (isCurrentTamil) return isTamilSong(s);
              const sLang = (s.language || '').toLowerCase();
              return currentLang && sLang.includes(currentLang);
            });
            const otherLanguages = newSuggestions.filter(s => {
              if (isCurrentTamil) return !isTamilSong(s);
              const sLang = (s.language || '').toLowerCase();
              return !(currentLang && sLang.includes(currentLang));
            });
            const prioritized = [...sameLanguage, ...otherLanguages];
            
            const played = currentQueue.slice(0, curIndex + 1);
            const remaining = isFromSearch ? [] : currentQueue.slice(curIndex + 1); // Clear search list if from search to prioritize "vibe"
            
            set({ queue: dedupeQueueItems([...played, ...prioritized, ...remaining]) });
          }
        }
      });
    }
  },

  togglePlay: () => set(s => ({ isPlaying: !s.isPlaying })),
  pauseSong: () => set({ isPlaying: false }),
  resumeSong: () => set({ isPlaying: true }),

  nextSong: async () => {
    const { queue, queueIndex, repeat, currentSong } = get();
    if (queue.length === 0) return;

    let nextIndex: number;
    if (repeat === 'one') {
      nextIndex = queueIndex;
      set({ currentTime: 0 });
    } else if (queueIndex < queue.length - 1) {
      nextIndex = queueIndex + 1;
    } else if (repeat === 'all') {
      nextIndex = 0;
    } else {
      // Reached the end of the queue, and repeat is 'off'.
      // Autoplay: fetch suggestions based on current song to keep the vibe going!
      if (currentSong) {
        set({ isLoading: true });
        try {
          const suggestions = await fetchVibeSuggestions(currentSong);
          if (suggestions.length > 0) {
            const currentQueue = get().queue;
            const existingIds = new Set(currentQueue.map(q => q.id));
            const existingCoreKeys = new Set(currentQueue.map(q => `${getCoreTitle(q.name)}|${(q.primaryArtists || '').split(',')[0].toLowerCase().trim()}`));

            const newSuggestions = suggestions
              .filter(s => {
                const idExists = existingIds.has(s.id);
                const key = `${getCoreTitle(s.name)}|${(s.primaryArtists || '').split(',')[0].toLowerCase().trim()}`;
                const coreExists = existingCoreKeys.has(key);
                return !idExists && !coreExists;
              })
              .map(toQueueItem);
              
            if (newSuggestions.length > 0) {
              const currentLang = (currentSong.language || '').toLowerCase();
              const isCurrentTamil = isTamilSong(currentSong);
              
              const sameLanguage = newSuggestions.filter(s => {
                if (isCurrentTamil) return isTamilSong(s);
                const sLang = (s.language || '').toLowerCase();
                return currentLang && sLang.includes(currentLang);
              });
              const otherLanguages = newSuggestions.filter(s => {
                if (isCurrentTamil) return !isTamilSong(s);
                const sLang = (s.language || '').toLowerCase();
                return !(currentLang && sLang.includes(currentLang));
              });
              const prioritized = [...sameLanguage, ...otherLanguages];

              const updatedQueue = dedupeQueueItems([...currentQueue, ...prioritized]);
              const nextIdx = queueIndex + 1;
              const nextSong = updatedQueue[nextIdx];
              
              if (nextSong) {
                set({
                  queue: updatedQueue,
                  queueIndex: nextIdx,
                  currentSong: nextSong,
                  currentTime: 0,
                  isPlaying: true,
                  isLoading: false,
                });
                get().addToRecentlyPlayed(nextSong);
                return;
              }
            }
          }
        } catch (error) {
          console.error('Autoplay suggestion fetch failed:', error);
        }
      }
      set({ isPlaying: false, isLoading: false });
      return;
    }

    const nextSong = queue[nextIndex];
    if (nextSong) {
      set({
        currentSong: nextSong,
        queueIndex: nextIndex,
        currentTime: 0,
        isPlaying: true,
        isLoading: true,
      });
      get().addToRecentlyPlayed(nextSong);
    }
  },

  prevSong: () => {
    const { queue, queueIndex, currentTime } = get();
    if (currentTime > 3) {
      set({ currentTime: 0 });
      return;
    }
    if (queue.length === 0) return;

    const prevIndex = queueIndex > 0 ? queueIndex - 1 : queue.length - 1;
    const prevSong = queue[prevIndex];
    if (prevSong) {
      set({
        currentSong: prevSong,
        queueIndex: prevIndex,
        currentTime: 0,
        isPlaying: true,
        isLoading: true,
      });
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
    const state = get();
    const newShuffle = !state.shuffle;
    if (newShuffle) {
      const current = state.queue[state.queueIndex];
      const others = state.queue.filter((_, i) => i !== state.queueIndex);
      for (let i = others.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [others[i], others[j]] = [others[j], others[i]];
      }
      set({ queue: dedupeQueueItems([current, ...others]), queueIndex: 0, shuffle: true });
    } else {
      const currentSong = state.currentSong;
      const originalIndex = state.originalQueue.findIndex(q => q.id === currentSong?.id);
      set({ queue: dedupeQueueItems([...state.originalQueue]), queueIndex: Math.max(0, originalIndex), shuffle: false });
    }
    saveToStorage('shuffle', newShuffle);
  },

  toggleRepeat: () => {
    const modes: RepeatMode[] = ['off', 'all', 'one'];
    const current = get().repeat;
    const nextIndex = (modes.indexOf(current) + 1) % modes.length;
    const next = modes[nextIndex];
    set({ repeat: next });
    saveToStorage('repeat', next);
  },

  addToQueue: (song) => {
    set((state) => ({ queue: dedupeQueueItems([...state.queue, toQueueItem(song)]) }));
  },

  removeFromQueue: (index) => {
    const state = get();
    const newQueue = state.queue.filter((_, i) => i !== index);
    let newIndex = state.queueIndex;
    if (index < state.queueIndex) newIndex--;
    if (index === state.queueIndex && newIndex >= newQueue.length) newIndex = newQueue.length - 1;
    set({ queue: newQueue, queueIndex: newIndex });
  },

  clearQueue: () => set({ queue: [], queueIndex: -1 }),

  playFromQueue: (index) => {
    const song = get().queue[index];
    if (song) {
      set({
        currentSong: song,
        queueIndex: index,
        currentTime: 0,
        isPlaying: true,
        isLoading: true,
      });
      get().addToRecentlyPlayed(song);
    }
  },

  setView: (view, data) => {
    const { currentView, viewData, viewHistory } = get();
    const isSameView = currentView === view;
    const isSameData = JSON.stringify(viewData) === JSON.stringify(data);
    let newHistory = viewHistory;

    if (!isSameView || !isSameData) {
      newHistory = [...viewHistory, { view: currentView, data: viewData }].slice(-50);
    }

    set({
      currentView: view,
      viewData: data,
      showNowPlaying: false,
      isMobileMenuOpen: false,
      viewHistory: newHistory,
    });
  },
  goBack: () => {
    const { viewHistory } = get();
    if (viewHistory.length === 0) return;
    const newHistory = [...viewHistory];
    const prev = newHistory.pop();
    if (prev) {
      set({
        currentView: prev.view,
        viewData: prev.data,
        showNowPlaying: false,
        isMobileMenuOpen: false,
        viewHistory: newHistory,
      });
    }
  },
  setShowNowPlaying: (show) => set({ showNowPlaying: show }),
  setShowQueue: (show) => set({ showQueue: show }),
  setShowLyrics: (show) => set({ showLyrics: show }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),
  setPlayerBarMinimized: (minimized) => set({ isPlayerBarMinimized: minimized }),

  toggleLike: (song) => {
    const state = get();
    const isCurrentlyLiked = state.likedSongs.some(s => s.id === song.id);
    const newLiked = isCurrentlyLiked
      ? state.likedSongs.filter(s => s.id !== song.id)
      : [song, ...state.likedSongs];
    set({ likedSongs: newLiked });
    saveToStorage('likedSongs', newLiked);
  },

  isLiked: (id) => get().likedSongs.some(s => s.id === id),

  addToRecentlyPlayed: (song) => {
    const state = get();
    const filtered = state.recentlyPlayed.filter(s => s.id !== song.id);
    const newRecent = [song, ...filtered].slice(0, 50);
    set({ recentlyPlayed: newRecent });
    saveToStorage('recentlyPlayed', newRecent);
    void syncRecentSongs(newRecent);
  },

  addDownloadedSong: (song) => {
    const state = get();
    const filtered = state.downloadedSongs.filter(s => s.id !== song.id);
    const downloadedSongs = [song, ...filtered];
    set({ downloadedSongs });
    saveToStorage('downloadedSongs', downloadedSongs);
  },

  removeDownloadedSong: (songId) => {
    const downloadedSongs = get().downloadedSongs.filter(song => song.id !== songId);
    set({ downloadedSongs });
    saveToStorage('downloadedSongs', downloadedSongs);
  },

  isDownloaded: (id) => get().downloadedSongs.some(song => song.id === id),

  createPlaylist: (name, description = '') => {
    const newPlaylist: UserPlaylist = {
      id: `pl_${Date.now()}`,
      name,
      description,
      coverImage: '',
      songs: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const playlists = [newPlaylist, ...get().playlists];
    set({ playlists });
    saveToStorage('playlists', playlists);
    void syncPlaylists(playlists);
  },

  addToPlaylist: (playlistId, song) => {
    const playlists = get().playlists.map(p => {
      if (p.id === playlistId && !p.songs.some(s => s.id === song.id)) {
        return { ...p, songs: [...p.songs, song], updatedAt: Date.now() };
      }
      return p;
    });
    set({ playlists });
    saveToStorage('playlists', playlists);
    void syncPlaylists(playlists);
  },

  removeFromPlaylist: (playlistId, songId) => {
    const playlists = get().playlists.map(p => {
      if (p.id === playlistId) {
        return { ...p, songs: p.songs.filter(s => s.id !== songId), updatedAt: Date.now() };
      }
      return p;
    });
    set({ playlists });
    saveToStorage('playlists', playlists);
    void syncPlaylists(playlists);
  },

  deletePlaylist: (playlistId) => {
    const playlists = get().playlists.filter(p => p.id !== playlistId);
    set({ playlists });
    saveToStorage('playlists', playlists);
    void syncPlaylists(playlists);
  },

  hydrateCloudData: async () => {
    try {
      const cloudLibrary = await loadCloudLibrary();
      if (!cloudLibrary) return;

      set({
        recentlyPlayed: cloudLibrary.recentlyPlayed,
        playlists: cloudLibrary.playlists,
      });

      saveToStorage('recentlyPlayed', cloudLibrary.recentlyPlayed);
      saveToStorage('playlists', cloudLibrary.playlists);
    } catch (error) {
      console.error('Failed to hydrate cloud data:', error);
    }
  },

  setCrossfade: (seconds) => {
    set({ crossfade: seconds });
    saveToStorage('crossfade', seconds);
  },

  setSleepTimer: (minutes) => set({ sleepTimer: minutes }),

  setDominantColor: (color) => set({ dominantColor: color }),
}));
