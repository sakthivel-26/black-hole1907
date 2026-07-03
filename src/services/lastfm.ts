import type { Song } from '../types';

const LASTFM_API_KEY = '57ee3318536b23ee81d64727214aca08'; // Using a common public key for music apps, or replace with yours
const LASTFM_BASE_URL = 'https://ws.audioscrobbler.com/2.0/';

export async function getSimilarTracks(song: Song): Promise<string[]> {
  try {
    const artist = song.primaryArtists.split(',')[0].split('&')[0].trim();
    const track = song.name.split('(')[0].split('-')[0].trim();

    const params = new URLSearchParams({
      method: 'track.getSimilar',
      artist: artist,
      track: track,
      api_key: LASTFM_API_KEY,
      format: 'json',
      limit: '15',
      autocorrect: '1'
    });

    const response = await fetch(`${LASTFM_BASE_URL}?${params.toString()}`);
    if (!response.ok) return [];

    const data = await response.json();
    const tracks = data?.similartracks?.track || [];

    return tracks.map((t: any) => `${t.name} ${t.artist?.name || ''}`.trim());
  } catch (e) {
    console.error('Last.fm fetch error:', e);
    return [];
  }
}

export async function getSimilarArtists(artistName: string): Promise<string[]> {
  try {
    const artist = artistName.split(',')[0].split('&')[0].trim();
    const params = new URLSearchParams({
      method: 'artist.getSimilar',
      artist: artist,
      api_key: LASTFM_API_KEY,
      format: 'json',
      limit: '10'
    });

    const response = await fetch(`${LASTFM_BASE_URL}?${params.toString()}`);
    if (!response.ok) return [];

    const data = await response.json();
    const artists = data?.similarartists?.artist || [];

    return artists.map((a: any) => a.name);
  } catch (e) {
    return [];
  }
}
