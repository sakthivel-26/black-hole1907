import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { Song } from '../types';

const _isNative = Capacitor.isNativePlatform();
const _capacitorHttp = CapacitorHttp;

function parseDuration(durationStr: string): number {
  if (!durationStr) return 0;
  const parts = durationStr.split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return parts[0] || 0;
}

function scoreYouTubeResult(item: any, querySong: string, queryArtists: string[]): number {
  const title = (item.title || '').toLowerCase();
  const uploader = (item.uploader || item.uploaderName || '').toLowerCase();

  let score = 100;

  // If queryArtists is empty, extract candidate words with length > 2 from the query to match uploader
  const targetArtists = queryArtists.length > 0 
    ? queryArtists 
    : querySong.split(' ').filter(word => word.length > 2);

  // Check if uploader name contains any of the primary artists or vice versa
  const matchesArtist = targetArtists.some(artist => uploader.includes(artist) || artist.includes(uploader));
  if (matchesArtist) {
    score += 120;
  }

  // === AUDIO-FIRST PRIORITY ===
  // Topic channels are official AUDIO-ONLY uploads (best for music streaming)
  if (uploader.endsWith(' - topic')) {
    score += 250;
  }
  // "Official Audio" in title = exactly what we want
  if (title.includes('official audio')) {
    score += 200;
  }
  // "Audio" keyword without "video" = good
  else if (title.includes('audio') && !title.includes('video')) {
    score += 100;
  }

  // VEVO/official channels are good but they upload videos, not audio-only
  if (uploader.endsWith('vevo') || uploader.includes('records')) {
    score += 60;
  }

  // === PENALIZE VIDEO/NON-AUDIO CONTENT ===
  // Official Video = plays fine but wastes bandwidth on video we hide
  if (title.includes('official video') || title.includes('music video') || title.includes('official mv')) {
    score -= 80;
  }
  // Lyrics videos are from 3rd party channels, not original artists
  if (title.includes('lyric') || title.includes('lyrics')) {
    score -= 200;
  }
  // Live performances are different arrangements, not studio recordings
  if (title.includes('live') || title.includes('performance') || title.includes('concert') || title.includes('vmas') || title.includes('awards')) {
    score -= 200;
  }

  // Exact title matching
  if (title.includes(querySong)) {
    score += 40;
  }

  // === PENALIZE NON-ORIGINAL CONTENT ===
  const nonOriginalKeywords = [
    'cover', 'karaoke', 'instrumental', 'tribute', 'slowed', 'reverb',
    'mashup', 'remix', 'remixed', 'medley', 'edit', 'acoustic',
    'tutorial', 'lesson', 'beginner', 'how to play', 'reaction',
    'drum cover', 'guitar cover', 'piano cover', 'bass cover',
    'nightcore', 'sped up', '8d audio', 'lofi', 'lo-fi'
  ];
  for (const word of nonOriginalKeywords) {
    if (title.includes(word) && !querySong.includes(word)) {
      score -= 300;
    }
  }

  return score;
}

async function fetchHtml(url: string): Promise<string> {
  // On native (Android/iOS), use CapacitorHttp to bypass CORS
  if (_isNative && _capacitorHttp) {
    try {
      const response = await _capacitorHttp.get({
        url,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      if (response.status === 200) {
        return typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      }
      throw new Error(`Native fetch status ${response.status}`);
    } catch (e) {
      console.error('CapacitorHttp failed, falling back to standard fetch:', e);
    }
  }

  // On web dev, rewrite to Vite proxy to bypass CORS
  let fetchUrl = url;
  if (url.startsWith('https://www.youtube.com/results')) {
    fetchUrl = url.replace('https://www.youtube.com/results', '/yt-search');
  }

  const res = await fetch(fetchUrl);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.text();
}

export async function searchYouTubeSongs(
  query: string,
  songName?: string,
  artistName?: string
): Promise<Song[]> {
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const html = await fetchHtml(url);

    // Parse ytInitialData block
    const match = html.match(/ytInitialData\s*=\s*({.+?});/) || 
                  html.match(/ytInitialData\s*=\s*({.+?})\s*<\/script>/) ||
                  html.match(/window\[['"]ytInitialData['"]\]\s*=\s*({.+?});/);

    if (!match) {
      console.warn('Could not find ytInitialData block in YouTube search page HTML');
      return [];
    }

    const data = JSON.parse(match[1]);
    const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
    if (!contents || contents.length === 0) {
      console.warn('Could not traverse YouTube search results contents');
      return [];
    }

    const items = contents[0].itemSectionRenderer?.contents || [];
    const querySongName = (songName || query).toLowerCase();
    const queryArtistsList = (artistName || '')
      .split(',')
      .map((a) => a.trim().toLowerCase())
      .filter(Boolean);

    const songs: Song[] = [];

    for (const item of items) {
      if (item.videoRenderer) {
        const vr = item.videoRenderer;
        const title = vr.title?.runs?.[0]?.text || vr.title?.simpleText || '';
        const videoId = vr.videoId || '';
        if (!videoId) continue;

        const uploader = vr.ownerText?.runs?.[0]?.text || vr.shortBylineText?.runs?.[0]?.text || '';
        const durationText = vr.lengthText?.simpleText || '';
        const duration = parseDuration(durationText);

        // 1. Strict duration constraint: skip videos under 100s (shorts, status clips, stories, ringtones) or over 8 minutes (full movies)
        if (duration > 0 && (duration < 100 || duration > 480)) {
          continue;
        }

        // 2. Strict keyword constraints: filter out non-songs (vlogs, status clips, Instagram stories, ringtones, movie scenes)
        const titleLower = title.toLowerCase();
        const uploaderLower = uploader.toLowerCase();
        const nonSongKeywords = [
          'status', 'story', 'stories', 'shorts', 'short', 'reel', 'reels', 'tiktok',
          'whatsapp', 'instagram', 'insta', 'facebook', 'snapchat', 'cut song', 'ringtone',
          'clip', 'clips', 'black screen', 'green screen', 'fan edit', 'fmv', 'bgm status',
          'lyrics status', 'lyric status', 'status video', 'video status',
          'full movie', 'interview', 'review', 'reaction', 'trailer', 'teaser', 
          'promo', 'vlog', 'climax scene', 'fight scene', 'comedy scene', 'scene', 
          'episode', 'serial', 'public review', 'theater response', 'theatre response', 
          'fdfs', 'behind the scenes', 'bts', 'making of', 'unboxing', 'tutorial', 
          'how to', 'reacting to', 'movie review', 'audio launch event', 'press meet'
        ];

        if (nonSongKeywords.some(keyword => titleLower.includes(keyword) || uploaderLower.includes(keyword))) {
          continue;
        }

        const thumbnail = vr.thumbnail?.thumbnails?.[0]?.url || '';

        const score = scoreYouTubeResult({ title, uploader }, querySongName, queryArtistsList);

        songs.push({
          id: `yt_${videoId}`,
          name: title,
          album: {
            id: '',
            name: 'YouTube Global',
            url: '',
          },
          year: '',
          duration,
          language: 'English',
          playCount: vr.viewCountText?.simpleText || '0 views',
          hasLyrics: false,
          label: 'YouTube Music',
          primaryArtists: uploader || 'Unknown Artist',
          primaryArtistsId: '',
          featuredArtists: '',
          artists: [
            {
              id: '',
              name: uploader || 'Unknown Artist',
              role: 'primary',
              image: [{ quality: '500x500', url: thumbnail }],
              type: 'artist',
              url: '',
            },
          ],
          image: [
            { quality: '500x500', url: thumbnail },
            { quality: '150x150', url: thumbnail },
            { quality: '50x50', url: thumbnail },
          ],
          downloadUrl: [],
          copyright: '',
          url: `https://www.youtube.com/watch?v=${videoId}`,
          // Temporary internal score
          _ytScore: score,
        } as any);
      }
    }

    // Sort descending by score
    songs.sort((a: any, b: any) => b._ytScore - a._ytScore);

    // Clean up temporary score property and return
    return songs.map(({ _ytScore, ...song }: any) => song as Song);
  } catch (error) {
    console.error('Failed to search YouTube:', error);
    return [];
  }
}

// Kept for backward compatibility interface, but will not be used in the new iframe audio engine
export async function getYouTubeStreamUrl(videoId: string): Promise<string> {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export async function getYTSongSuggestions(song: Song, targetLanguage?: string | null): Promise<Song[]> {
  try {
    const cleanArtist = song.primaryArtists.replace(/\s*-\s*topic/gi, '').trim();
    // Search for the artist + mix or similar tracks to get same vibe
    let query = `${song.name} ${cleanArtist} radio`;
    if (targetLanguage) {
      const lowerQuery = query.toLowerCase();
      if (!lowerQuery.includes(targetLanguage.toLowerCase())) {
        query = `${song.name} ${cleanArtist} ${targetLanguage} radio`;
      }
    }
    const results = await searchYouTubeSongs(query, song.name, cleanArtist);
    return results.filter(s => s.id !== song.id);
  } catch (e) {
    console.error('Failed to get YouTube suggestions:', e);
    return [];
  }
}
