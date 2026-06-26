export interface Song {
  id: string;
  name: string;
  album: { id: string; name: string; url: string };
  year: string;
  duration: number;
  language: string;
  playCount: number;
  hasLyrics: boolean;
  label: string;
  primaryArtists: string;
  primaryArtistsId: string;
  featuredArtists: string;
  artists: Artist[];
  image: ImageQuality[];
  downloadUrl: DownloadUrl[];
  copyright: string;
  url: string;
}

export interface ImageQuality {
  quality: string;
  url: string;
}

export interface DownloadUrl {
  quality: string;
  url: string;
}

export interface Album {
  id: string;
  name: string;
  year: string;
  image: ImageQuality[];
  songs: Song[];
  primaryArtists: string;
  songCount: number;
  language: string;
  url: string;
}

export interface Artist {
  id: string;
  name: string;
  role: string;
  image: ImageQuality[];
  type: string;
  url: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  image: ImageQuality[];
  songs: Song[];
  songCount: number;
  url: string;
}

export interface SearchResult {
  songs?: { results: Song[]; total: number };
  albums?: { results: Album[]; total: number };
  artists?: { results: Artist[]; total: number };
  playlists?: { results: Playlist[]; total: number };
  topQuery?: { results: any[] };
}

export interface QueueItem extends Song {
  queueId: string;
}

export interface UserPlaylist {
  id: string;
  name: string;
  description: string;
  coverImage: string;
  songs: Song[];
  createdAt: number;
  updatedAt: number;
}

export type RepeatMode = 'off' | 'all' | 'one';
export type ViewMode = 'home' | 'search' | 'library' | 'downloads' | 'album' | 'playlist' | 'artist' | 'nowPlaying' | 'settings';
export type ThemeMode = 'dark' | 'light' | 'auto';
