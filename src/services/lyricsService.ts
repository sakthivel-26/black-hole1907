import { getSongLyrics } from './api';
import type { Song } from '../types';

export interface SyncedLine {
  time: number;
  text: string;
}

export interface LyricsData {
  text: string;
  isSynced: boolean;
  lines: SyncedLine[];
}

const lyricsCache = new Map<string, LyricsData>();
const activeRequests = new Map<string, Promise<LyricsData>>();

// Parse LRC format into SyncedLine array
export function parseLRC(lrcText: string): SyncedLine[] {
  if (!lrcText) return [];
  const lines = lrcText.split('\n');
  const result: SyncedLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2})\]/;

  for (const line of lines) {
    const match = timeRegex.exec(line);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseFloat(match[2]);
      const time = minutes * 60 + seconds;
      const text = line.replace(timeRegex, '').trim();
      result.push({ time, text });
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

export async function getLyrics(song: Song, duration?: number): Promise<LyricsData> {
  if (lyricsCache.has(song.id)) {
    return lyricsCache.get(song.id)!;
  }

  if (activeRequests.has(song.id)) {
    return activeRequests.get(song.id)!;
  }

  const promise = (async (): Promise<LyricsData> => {
    const cleanArtist = song.primaryArtists.split(',')[0].split('&')[0].trim();
    const cleanTitle = song.name
      .replace(/\s*[\(\[][^)]*Version[^)]*[\)\]]/gi, '')
      .replace(/\s*[\(\[][^)]*From[^)]*[\)\]]/gi, '')
      .replace(/\s*[\(\[][^)]*Soundtrack[^)]*[\)\]]/gi, '')
      .replace(/\s*[\(\[][^)]*OST[^)]*[\)\]]/gi, '')
      .trim();

    // 1. Try parallel exact lookup (LrcLib Get & Saavn Lyrics)
    try {
      const durationQuery = duration || song.duration || 0;
      const lrcGetUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtist)}&track_name=${encodeURIComponent(cleanTitle)}${durationQuery > 0 ? `&duration=${Math.round(durationQuery)}` : ''}`;
      
      const [lrcResponse, saavnResponse] = await Promise.allSettled([
        fetch(lrcGetUrl).then(r => r.ok ? r.json() : null),
        getSongLyrics(song.id).catch(() => null)
      ]);

      if (lrcResponse.status === 'fulfilled' && lrcResponse.value) {
        const data = lrcResponse.value;
        if (data.syncedLyrics) {
          const parsed = parseLRC(data.syncedLyrics);
          if (parsed.length > 0) {
            return { text: data.syncedLyrics, isSynced: true, lines: parsed };
          }
        }
        if (data.plainLyrics) {
          return { text: data.plainLyrics, isSynced: false, lines: [] };
        }
      }

      if (saavnResponse.status === 'fulfilled' && saavnResponse.value && saavnResponse.value.lyrics) {
        return { text: saavnResponse.value.lyrics, isSynced: false, lines: [] };
      }
    } catch (e) {
      console.warn('Direct lyrics fetch failed:', e);
    }

    // 2. Try LrcLib Search (Fuzzy Match)
    try {
      const searchQuery = `${cleanTitle} ${cleanArtist}`;
      const searchRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(searchQuery)}`);
      if (searchRes.ok) {
        const results = await searchRes.json();
        if (Array.isArray(results) && results.length > 0) {
          let match = results.find((r: any) => r.syncedLyrics && r.syncedLyrics.trim().length > 0);
          if (!match) {
            match = results.find((r: any) => r.plainLyrics && r.plainLyrics.trim().length > 0);
          }

          if (match) {
            if (match.syncedLyrics) {
              const parsed = parseLRC(match.syncedLyrics);
              if (parsed.length > 0) {
                return { text: match.syncedLyrics, isSynced: true, lines: parsed };
              }
            }
            if (match.plainLyrics) {
              return { text: match.plainLyrics, isSynced: false, lines: [] };
            }
          }
        }
      }
    } catch (e) {
      console.warn('LrcLib search failed:', e);
    }

    // 3. Fallback to title-only LrcLib search
    try {
      const searchRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(cleanTitle)}`);
      if (searchRes.ok) {
        const results = await searchRes.json();
        if (Array.isArray(results) && results.length > 0) {
          let match = results.find((r: any) => r.syncedLyrics && r.syncedLyrics.trim().length > 0);
          if (!match) {
            match = results.find((r: any) => r.plainLyrics && r.plainLyrics.trim().length > 0);
          }

          if (match) {
            if (match.syncedLyrics) {
              const parsed = parseLRC(match.syncedLyrics);
              if (parsed.length > 0) {
                return { text: match.syncedLyrics, isSynced: true, lines: parsed };
              }
            }
            if (match.plainLyrics) {
              return { text: match.plainLyrics, isSynced: false, lines: [] };
            }
          }
        }
      }
    } catch (e) {
      console.warn('LrcLib title fallback failed:', e);
    }

    return { text: '', isSynced: false, lines: [] };
  })();

  activeRequests.set(song.id, promise);

  try {
    const result = await promise;
    lyricsCache.set(song.id, result);
    return result;
  } finally {
    activeRequests.delete(song.id);
  }
}

export function prefetchLyrics(song: Song, duration?: number) {
  if (!song || lyricsCache.has(song.id) || activeRequests.has(song.id)) return;
  void getLyrics(song, duration);
}
