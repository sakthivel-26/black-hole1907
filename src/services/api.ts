import type { Song, Album, Artist, Playlist, SearchResult, ImageQuality, DownloadUrl } from '../types';

const API_BASE_URLS = [
  import.meta.env.VITE_API_BASE_URL?.trim(),
  'https://saavn.sumit.co/api',
  'https://saavn.dev/api',
].filter(Boolean) as string[];

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

// Cache for API responses
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const FRESH_QUERY_TTL = 30 * 60 * 1000; // 30 minutes
const SEARCH_STOP_WORDS = new Set([
  'movie',
  'movies',
  'song',
  'songs',
  'album',
  'albums',
  'music',
  'track',
  'tracks',
  'ost',
  'soundtrack',
  'original',
  'motion',
  'picture',
  'from',
  'by',
  'bgm',
  'theme',
]);
const REMIX_LIKE_WORDS = ['remix', 'mix', 'mashup', 'cover', 'reprise', 'edit', 'instrumental', 'live', 'karaoke', 'slowed', 'speed up', 'sped up', 'nightcore', 'emulation', '16-bit', '16bit', 'tribute', 'rework', 'medley'];
const FRESH_QUERY_WORDS = ['latest', 'trending', 'new', 'today', 'daily', 'fresh', 'update'];
const SOUNDTRACK_QUERY_WORDS = ['movie', 'movies', 'album', 'albums', 'ost', 'soundtrack', 'bgm', 'theme', 'original'];
const INTERNATIONAL_QUERY_WORDS = ['international', 'english', 'global', 'western', 'hollywood'];
const NON_ORIGINAL_HINTS = ['instrumental', 'karaoke', 'nightcore', 'slowed', 'sped up', 'speed up', 'lofi', 'lo-fi', 'ambient', 'flip', 'cover', 'tribute', 'reprise', 'edit', 'version', 'remix', 'mix'];

async function fetchApi<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const cacheUrl = new URL(`${API_BASE_URLS[0]}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value) cacheUrl.searchParams.set(key, value);
    });
  }

  const cacheKey = cacheUrl.toString();
  const cached = cache.get(cacheKey);
  const ttl = endpoint.includes('/search/')
    ? getSearchCacheTtl(params?.query || '')
    : CACHE_TTL;

  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }

  let lastError: unknown;

  for (const baseUrl of API_BASE_URLS) {
    const url = new URL(`${baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) url.searchParams.set(key, value);
      });
    }

    try {
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const json: ApiResponse<T> = await response.json();
      if (!json.success) {
        throw new Error('API returned unsuccessful response');
      }

      cache.set(cacheKey, { data: json.data, timestamp: Date.now() });
      return json.data;
    } catch (error) {
      lastError = error;
    }
  }

  console.error(`API fetch error for ${endpoint}:`, lastError);
  throw lastError instanceof Error ? lastError : new Error('Unable to fetch API response');
}

// Normalize the response to ensure consistent data
function normalizeSong(song: any): Song {
  return {
    id: song.id || '',
    name: decodeHtml(song.name || song.title || ''),
    album: {
      id: song.album?.id || '',
      name: decodeHtml(song.album?.name || ''),
      url: song.album?.url || '',
    },
    year: song.year || '',
    duration: Number(song.duration) || 0,
    language: song.language || '',
    playCount: Number(song.playCount) || 0,
    hasLyrics: song.hasLyrics === 'true' || song.hasLyrics === true,
    label: song.label || '',
    primaryArtists: decodeHtml(song.primaryArtists || song.artists?.primary?.map((a: any) => a.name).join(', ') || ''),
    primaryArtistsId: song.primaryArtistsId || '',
    featuredArtists: decodeHtml(song.featuredArtists || ''),
    artists: (song.artists?.all || song.artists?.primary || []).map((a: any) => ({
      id: a.id || '',
      name: decodeHtml(a.name || ''),
      role: a.role || '',
      image: a.image || [],
      type: a.type || 'artist',
      url: a.url || '',
    })),
    image: song.image || [],
    downloadUrl: song.downloadUrl || [],
    copyright: song.copyright || '',
    url: song.url || '',
  };
}

function normalizeAlbum(album: any): Album {
  return {
    id: album.id || '',
    name: decodeHtml(album.name || album.title || ''),
    year: album.year || '',
    image: album.image || [],
    songs: (album.songs || []).map(normalizeSong),
    primaryArtists: decodeHtml(
      album.primaryArtists ||
      album.artists?.primary?.map((artist: any) => artist.name).join(', ') ||
      album.artist ||
      ''
    ),
    songCount: album.songCount || album.songs?.length || 0,
    language: album.language || '',
    url: album.url || '',
  };
}

function normalizeArtist(artist: any): Artist {
  return {
    id: artist.id || '',
    name: decodeHtml(artist.name || artist.title || ''),
    role: artist.role || '',
    image: artist.image || [],
    type: artist.type || 'artist',
    url: artist.url || '',
  };
}

function decodeHtml(html: string): string {
  const txt = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
}

function normalizeQueryText(value: string): string {
  return decodeHtml(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim();
}

function normalizePhoneticText(value: string): string {
  return normalizeQueryText(value)
    .replace(/aa+/g, 'a')
    .replace(/ee+/g, 'e')
    .replace(/ii+/g, 'i')
    .replace(/oo+/g, 'o')
    .replace(/uu+/g, 'u')
    .replace(/kh/g, 'k')
    .replace(/gh/g, 'g')
    .replace(/ch/g, 'c')
    .replace(/sh/g, 's')
    .replace(/th/g, 't')
    .replace(/ph/g, 'f')
    .replace(/zh/g, 'l')
    .replace(/gn/g, 'n')
    .replace(/[aeiou]/g, '')
    .replace(/(.)\1+/g, '$1')
    .replace(/\s+/g, '');
}

function hasKeyword(query: string, keywords: string[]): boolean {
  const normalized = normalizeQueryText(query);
  return keywords.some((keyword) => normalized.includes(keyword));
}

export function isFreshSongsQuery(query: string): boolean {
  return hasKeyword(query, FRESH_QUERY_WORDS);
}

export function isSoundtrackStyleQuery(query: string): boolean {
  return hasKeyword(query, SOUNDTRACK_QUERY_WORDS);
}

function isInternationalOriginalQuery(query: string): boolean {
  return hasKeyword(query, INTERNATIONAL_QUERY_WORDS);
}

function hasRemixLikeTag(song: Song): boolean {
  const songName = normalizeQueryText(song.name);
  const albumName = normalizeQueryText(song.album?.name || '');
  return REMIX_LIKE_WORDS.some((keyword) => songName.includes(keyword) || albumName.includes(keyword));
}

function isLikelyOriginalInternationalTrack(song: Song): boolean {
  const language = (song.language || '').toLowerCase();
  const looksEnglish = language.includes('english') || language === 'eng';
  if (!looksEnglish) return false;
  if (hasRemixLikeTag(song)) return false;
  if (!normalizeQueryText(song.primaryArtists)) return false;
  return true;
}

function hasNonOriginalHints(song: Song): boolean {
  const title = normalizeQueryText(song.name);
  const album = normalizeQueryText(song.album?.name || '');
  const artists = normalizeQueryText(song.primaryArtists || '');
  const language = (song.language || '').toLowerCase();

  if (!artists) return true;
  if (language.includes('instrumental')) return true;

  return NON_ORIGINAL_HINTS.some((hint) => title.includes(hint) || album.includes(hint) || artists.includes(hint));
}

function shouldForceOriginalFiltering(query: string, songs: Song[]): boolean {
  if (songs.length === 0) return false;
  if (isInternationalOriginalQuery(query)) return true;

  const asciiLikeQuery = /^[a-z0-9\s'"-]+$/i.test(query.trim());
  if (!asciiLikeQuery) return false;

  const sample = songs.slice(0, 10);
  const suspiciousCount = sample.filter(hasNonOriginalHints).length;
  return suspiciousCount >= Math.ceil(sample.length * 0.6);
}

function getSearchCacheTtl(query: string): number {
  return isFreshSongsQuery(query) ? FRESH_QUERY_TTL : CACHE_TTL;
}

function buildSearchVariants(query: string): string[] {
  const normalized = normalizeQueryText(query);
  if (!normalized) return [query];

  const words = normalized.split(' ').filter(Boolean);
  // Avoid using generic stop words and fresh query words in sub-queries
  const filterWords = new Set([...SEARCH_STOP_WORDS, ...FRESH_QUERY_WORDS]);
  const focusedWords = words.filter((word) => !filterWords.has(word));
  const compactQuery = focusedWords.join(' ');

  const variants = [
    query.trim(),
    compactQuery,
  ];

  if (compactQuery) {
    variants.push(
      `${compactQuery} original motion picture soundtrack`,
      `${compactQuery} original version`
    );
  }

  return Array.from(new Set(variants.map((item) => item.trim()).filter(Boolean)));
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function scoreTextMatch(haystack: string, query: string): number {
  if (!haystack || !query) return 0;

  const haystackWords = haystack.split(' ');
  const queryWords = query.split(' ').filter((word) => !SEARCH_STOP_WORDS.has(word));
  let score = 0;

  for (const word of queryWords) {
    if (haystack === word) score += 40;
    else if (haystack.startsWith(word)) score += 18;
    else if (haystackWords.includes(word)) score += 14;
    else if (haystack.includes(word)) score += 8;
  }

  return score;
}

// Compute Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  const alen = a.length;
  const blen = b.length;
  if (alen === 0) return blen;
  if (blen === 0) return alen;
  const matrix = Array.from({ length: blen + 1 }, (_, i) => new Array(alen + 1).fill(0));
  for (let i = 0; i <= blen; i++) matrix[i][0] = i;
  for (let j = 0; j <= alen; j++) matrix[0][j] = j;
  for (let i = 1; i <= blen; i++) {
    for (let j = 1; j <= alen; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[blen][alen];
}

function similarityScore(a: string, b: string): number {
  if (!a || !b) return 0;
  const aa = a.trim();
  const bb = b.trim();
  const dist = levenshteinDistance(aa, bb);
  const maxLen = Math.max(aa.length, bb.length);
  if (maxLen === 0) return 0;
  return Math.max(0, 1 - dist / maxLen);
}

function scoreAlbumResult(album: Album, query: string): number {
  const normalizedQuery = normalizeQueryText(query);
  const normalizedName = normalizeQueryText(album.name);
  const normalizedArtists = normalizeQueryText(album.primaryArtists);
  let score = 0;

  if (normalizedName === normalizedQuery) score += 140;
  if (normalizedName.startsWith(normalizedQuery)) score += 80;
  if (normalizedName.includes(normalizedQuery)) score += 50;
  if (normalizedArtists.includes(normalizedQuery)) score += 18;
  score += scoreTextMatch(normalizedName, normalizedQuery);
  score += Math.floor(scoreTextMatch(normalizedArtists, normalizedQuery) * 0.6);
  if (normalizedName.includes('original motion picture soundtrack')) score += 40;
  if (normalizedName.includes('original soundtrack')) score += 28;
  if (normalizedName.includes('ost')) score += 16;
  if (normalizedName === '3') score += normalizedQuery.includes('3') ? 60 : 0;

  return score;
}

async function fetchAlbumSearchCandidates(query: string): Promise<Album[]> {
  const variantResults = await Promise.allSettled(
    buildSearchVariants(query).map((variant) => fetchApi<any>('/search/albums', { query: variant }))
  );

  const albums = variantResults
    .flatMap((result) => (result.status === 'fulfilled' ? result.value.results || [] : []))
    .map(normalizeAlbum);

  return uniqueById(albums).sort((first, second) => scoreAlbumResult(second, query) - scoreAlbumResult(first, query));
}

function scoreSongResult(song: Song, query: string): number {
  const normalizedQuery = normalizeQueryText(query);
  const phoneticQuery = normalizePhoneticText(query);
  const songName = normalizeQueryText(song.name);
  const songPhonetic = normalizePhoneticText(song.name);
  const albumName = normalizeQueryText(song.album?.name || '');
  const albumPhonetic = normalizePhoneticText(song.album?.name || '');
  const artists = normalizeQueryText(song.primaryArtists);
  const artistPhonetic = normalizePhoneticText(song.primaryArtists);
  const songYear = Number(song.year) || 0;
  const currentYear = new Date().getFullYear();

  let score = 0;
  // Strong boost for exact title match (normalized)
  if (songName === normalizedQuery) score += 220;
  
  // Clean boost when query matches the album name exactly (soundtrack searches)
  const cleanQuery = normalizedQuery.replace(/\b(songs|song|movie|soundtrack|ost|bgm|theme)\b/gi, '').trim();
  const cleanAlbum = albumName.replace(/\b(songs|song|movie|soundtrack|ost|bgm|theme)\b/gi, '').trim();
  if (cleanAlbum && cleanQuery && cleanAlbum === cleanQuery) {
    score += 280; // Highly popular soundtrack album songs go first
  }

  // Partial title/album matches
  if (songName.includes(normalizedQuery)) score += 72;
  if (albumName.includes(normalizedQuery)) score += 36;
  // Stronger boost when the query matches the artist string
  if (artists.includes(normalizedQuery)) score += 80;
  score += scoreTextMatch(songName, normalizedQuery);
  score += Math.floor(scoreTextMatch(albumName, normalizedQuery) * 0.9);

  const remixPenalty = REMIX_LIKE_WORDS.reduce((total, keyword) => {
    const matchesSong = songName.includes(keyword);
    const matchesAlbum = albumName.includes(keyword);
    return total + (matchesSong || matchesAlbum ? 1 : 0);
  }, 0);
  score -= remixPenalty * 22;

  if (isInternationalOriginalQuery(query)) {
    const language = (song.language || '').toLowerCase();
    const looksEnglish = language.includes('english') || language === 'eng';
    if (!looksEnglish) score -= 120;
    if (remixPenalty > 0) score -= 140;
    if (artists.includes(normalizedQuery)) score += 24;
  }

  if (songName.includes('original') || albumName.includes('original')) score += 18;
  if (songName.includes('soundtrack') || albumName.includes('soundtrack') || albumName.includes('ost')) score += 14;

  if (phoneticQuery) {
    score += Math.round(similarityScore(songPhonetic, phoneticQuery) * 120);
    score += Math.round(similarityScore(albumPhonetic, phoneticQuery) * 50);
    score += Math.round(similarityScore(artistPhonetic, phoneticQuery) * 36);
  }

  // Popularity boost to prefer original/popular tracks when titles collide
  try {
    const popularityBonus = Math.min(Number(song.playCount) / 10000, 120);
    score += Math.round(popularityBonus);
  } catch {
    // ignore
  }

  if (songYear > 0) {
    const age = currentYear - songYear;
    if (age >= 25) score += 12;
    else if (age >= 15) score += 8;
    else if (age >= 8) score += 4;
  }

  if (isFreshSongsQuery(query)) {
    if (songYear >= currentYear) score += 48;
    else if (songYear === currentYear - 1) score += 28;
    score += Math.min(song.playCount / 250000, 30);
  }

  // Fuzzy similarity bonus to surface near-matches (typos, word order, diacritics)
  try {
    const titleSim = similarityScore(songName, normalizedQuery);
    score += Math.round(titleSim * 70);

    const combined = `${songName} ${artists}`.trim();
    const combinedSim = similarityScore(combined, normalizedQuery);
    score += Math.round(combinedSim * 30);

    const phoneticTitleSim = similarityScore(songPhonetic, phoneticQuery);
    score += Math.round(phoneticTitleSim * 40);
  } catch {
    // ignore errors in similarity scoring
  }

  // Small tiebreaker: prefer English-tagged tracks for common English queries
  try {
    const englishy = /[a-z]/i.test(query) && query.split(' ').length >= 2;
    if (englishy && (song.language || '').toLowerCase().includes('english')) score += 24;
  } catch {}

  return score;
}

// Search APIs
export async function searchAll(query: string): Promise<SearchResult> {
  return fetchApi<SearchResult>('/search', { query });
}

export async function searchSongs(query: string, page = 1, limit = 30): Promise<{ results: Song[]; total: number }> {
  const variantResults = await Promise.allSettled(
    buildSearchVariants(query).slice(0, 3).map((variant) =>
      fetchApi<any>('/search/songs', { query: variant, page: String(page), limit: String(limit) })
    )
  );

  const songs = variantResults
    .flatMap((result) => (result.status === 'fulfilled' ? result.value.results || [] : []))
    .map(normalizeSong);

  const rankedSongs = uniqueById(songs).sort((first, second) => scoreSongResult(second, query) - scoreSongResult(first, query));

  let filteredSongs = rankedSongs;
  if (shouldForceOriginalFiltering(query, rankedSongs)) {
    const originalInternational = rankedSongs.filter((song) => {
      if (isInternationalOriginalQuery(query)) {
        return isLikelyOriginalInternationalTrack(song);
      }

      // For noisy latin-title searches, keep only tracks that look like original releases.
      return !hasNonOriginalHints(song);
    });

    if (originalInternational.length > 0) {
      filteredSongs = originalInternational;
    } else {
      // Fallback: keep a cleaner subset (artist present, no remix-like tags) if strict original filtering finds none.
      const cleaner = rankedSongs.filter((song) => {
        const artists = normalizeQueryText(song.primaryArtists || '');
        return !!artists && !hasRemixLikeTag(song);
      });
      if (cleaner.length > 0) {
        filteredSongs = cleaner;
      }
    }
  }

  if (filteredSongs.length > 0) {
    return {
      results: filteredSongs.slice(0, limit),
      total: filteredSongs.length,
    };
  }

  const data = await fetchApi<any>('/search/songs', { query, page: String(page), limit: String(limit) });
  return {
    results: (data.results || []).map(normalizeSong),
    total: data.total || 0,
  };
}

export async function searchAlbums(query: string): Promise<{ results: Album[]; total: number }> {
  const rankedResults = await fetchAlbumSearchCandidates(query);
  if (rankedResults.length > 0) {
    return {
      results: rankedResults,
      total: rankedResults.length,
    };
  }

  const data = await fetchApi<any>('/search/albums', { query });
  return {
    results: (data.results || []).map(normalizeAlbum),
    total: data.total || 0,
  };
}

export async function searchArtists(query: string): Promise<{ results: Artist[]; total: number }> {
  const data = await fetchApi<any>('/search/artists', { query });
  return {
    results: (data.results || []).map(normalizeArtist),
    total: data.total || 0,
  };
}

// Song APIs
export async function getSongById(id: string): Promise<Song[]> {
  const data = await fetchApi<any>('/songs', { id });
  return (Array.isArray(data) ? data : data?.songs || [data]).map(normalizeSong);
}

export async function getSongSuggestions(id: string): Promise<Song[]> {
  try {
    const data = await fetchApi<any>(`/songs/${id}/suggestions`);
    return (Array.isArray(data) ? data : []).map(normalizeSong);
  } catch {
    return [];
  }
}

export async function getSongLyrics(id: string): Promise<{ lyrics: string; hasLyrics: boolean }> {
  try {
    const data = await fetchApi<any>(`/songs/${id}/lyrics`);
    return { lyrics: data.lyrics || '', hasLyrics: !!data.lyrics };
  } catch {
    return { lyrics: '', hasLyrics: false };
  }
}

// Album APIs
export async function getAlbumById(id: string): Promise<Album> {
  const data = await fetchApi<any>(`/albums`, { id });
  return normalizeAlbum(data);
}

// Artist APIs
export async function getArtistById(id: string): Promise<any> {
  return fetchApi<any>(`/artists`, { id });
}

export async function getArtistSongs(id: string, page = 1): Promise<{ results: Song[]; total: number }> {
  try {
    const data = await fetchApi<any>(`/artists/${id}/songs`, { page: String(page) });
    const primaryResults = (data.results || data.songs || []).map(normalizeSong);
    if (primaryResults.length > 0) {
      return {
        results: primaryResults,
        total: data.total || primaryResults.length,
      };
    }

    // Fallback 1: some APIs expose songs under /artists?id={id}
    const artistPayload = await fetchApi<any>(`/artists`, { id });
    const artistTopSongs = (artistPayload.topSongs || artistPayload.songs || artistPayload.singles || []).map(normalizeSong);
    if (artistTopSongs.length > 0) {
      return {
        results: uniqueById(artistTopSongs),
        total: artistTopSongs.length,
      };
    }

    // Fallback 2: if still empty, search by artist name and keep tracks credited to that artist
    const artistName = decodeHtml(artistPayload.name || '').trim();
    if (!artistName) {
      return { results: [], total: 0 };
    }

    const searchData = await fetchApi<any>('/search/songs', { query: artistName, page: String(page), limit: '50' });
    const normalizedArtistName = normalizeQueryText(artistName);
    const byArtist = (searchData.results || [])
      .map(normalizeSong)
      .filter((song) => {
        const inPrimaryArtists = normalizeQueryText(song.primaryArtists).includes(normalizedArtistName);
        const inSongTitle = normalizeQueryText(song.name).includes(normalizedArtistName);
        return inPrimaryArtists || inSongTitle;
      });

    const deduped = uniqueById(byArtist);
    return {
      results: deduped,
      total: deduped.length,
    };
  } catch {
    return { results: [], total: 0 };
  }
}

export async function getArtistAlbums(id: string): Promise<{ results: Album[]; total: number }> {
  try {
    const data = await fetchApi<any>(`/artists/${id}/albums`);
    return {
      results: data.results || [],
      total: data.total || 0,
    };
  } catch {
    return { results: [], total: 0 };
  }
}

// Playlist APIs
export async function getPlaylistById(id: string): Promise<Playlist> {
  const data = await fetchApi<any>(`/playlists`, { id });
  return {
    id: data.id,
    name: decodeHtml(data.name || ''),
    description: data.description || '',
    image: data.image || [],
    songs: (data.songs || []).map(normalizeSong),
    songCount: data.songCount || 0,
    url: data.url || '',
  };
}

// Home Page / Charts
export async function getHomePage(): Promise<any> {
  try {
    const data = await fetchApi<any>('/modules', { language: 'hindi,english,tamil,telugu' });
    return data;
  } catch {
    return null;
  }
}

// Get trending / charts
export async function getCharts(): Promise<any[]> {
  try {
    const homeData = await getHomePage();
    return homeData?.charts || homeData?.trending?.albums || [];
  } catch {
    return [];
  }
}

// Helper: Get best quality image
export function getImageUrl(images: ImageQuality[] | undefined, quality: 'low' | 'medium' | 'high' = 'high'): string {
  if (!images || images.length === 0) return '';
  const qualityMap: Record<string, string[]> = {
    high: ['500x500', '150x150', '50x50'],
    medium: ['150x150', '500x500', '50x50'],
    low: ['50x50', '150x150', '500x500'],
  };
  for (const q of qualityMap[quality]) {
    const found = images.find(i => i.quality === q);
    if (found?.url) return found.url;
  }
  return images[images.length - 1]?.url || '';
}

// Helper: Get best quality download URL
export function getDownloadUrl(urls: DownloadUrl[] | undefined): string {
  if (!urls || urls.length === 0) return '';
  const qualities = ['320kbps', '160kbps', '96kbps', '48kbps', '12kbps'];
  for (const q of qualities) {
    const found = urls.find(u => u.quality === q);
    if (found?.url) return found.url;
  }
  return urls[urls.length - 1]?.url || '';
}

export function getBestAudioQuality(urls: DownloadUrl[] | undefined): string {
  if (!urls || urls.length === 0) return '';
  const qualities = ['320kbps', '160kbps', '96kbps', '48kbps', '12kbps'];
  for (const quality of qualities) {
    if (urls.some((entry) => entry.quality === quality)) {
      return quality;
    }
  }
  return urls[urls.length - 1]?.quality || '';
}

export function getAudioQualityLabel(urls: DownloadUrl[] | undefined): string {
  const quality = getBestAudioQuality(urls);
  return quality ? `Max quality ${quality} AAC` : 'Quality unavailable';
}

function sanitizeFileName(value: string): string {
  return value.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '').trim();
}

export async function downloadSongFile(song: Song): Promise<{ quality: string; fileName: string }> {
  const url = getDownloadUrl(song.downloadUrl);
  const quality = getBestAudioQuality(song.downloadUrl) || 'unknown';
  if (!url) {
    throw new Error('No downloadable audio URL available for this song.');
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not download song (${response.status}).`);
  }

  const blob = await response.blob();

  // Store the audio binary in IndexedDB for local offline playback
  try {
    const { set: idbSet } = await import('idb-keyval');
    await idbSet(`song_file_${song.id}`, blob);
  } catch (err) {
    console.warn('Failed to save song to offline database:', err);
  }

  const extension = blob.type.includes('mp4') || blob.type.includes('aac') ? 'm4a' : 'mp3';
  const fileName = sanitizeFileName(`${song.name} - ${song.primaryArtists} [${quality}].${extension}`);
  
  // Trigger file download (works natively on browsers)
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);

  return { quality, fileName };
}

// Format duration
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
