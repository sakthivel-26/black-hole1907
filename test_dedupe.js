const getCoreTitle = (title) => {
  return (title || '')
    .toLowerCase()
    .replace(/\(from ".*?"\)/gi, '')
    .replace(/\[from ".*?"\]/gi, '')
    .replace(/\(.*? (remix|mix|edit|cover|lofi|flip|version|reprise|tribute|slowed|reverb|instrumental|karaoke|bgm|violin|flute|piano|lyric|lyrics|video|audio)\)/gi, '')
    .replace(/\[.*? (remix|mix|edit|cover|lofi|flip|version|reprise|tribute|slowed|reverb|instrumental|karaoke|bgm|violin|flute|piano|lyric|lyrics|video|audio)\]/gi, '')
    .replace(/\(original.*?\)/gi, '')
    .replace(/ - (single|ep|remix|mix|edit|cover|lofi|flip|version|reprise|tribute|instrumental|karaoke|bgm|lyric|lyrics|video|audio)$/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

const isDuplicateTrack = (songA, songB) => {
  if (songA.id === songB.id) return true;

  const cleanA = songA.name.toLowerCase();
  const cleanB = songB.name.toLowerCase();

  const normalizePhonetic = (str) => {
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

  console.log(`Comparing: "${songA.name}" vs "${songB.name}"`);
  console.log(`  Phonetic: "${phoneA}" vs "${phoneB}"`);

  if (phoneA && phoneB) {
    if (phoneA.includes(phoneB) || phoneB.includes(phoneA)) {
      console.log('  -> Duplicate by phonetic match!');
      return true;
    }
  }

  const phoneCoreA = normalizePhonetic(getCoreTitle(songA.name));
  const phoneCoreB = normalizePhonetic(getCoreTitle(songB.name));
  console.log(`  PhoneCore: "${phoneCoreA}" vs "${phoneCoreB}"`);

  if (phoneCoreA && phoneCoreB) {
    if (phoneCoreA.includes(phoneCoreB) || phoneCoreB.includes(phoneCoreA)) {
      console.log('  -> Duplicate by phoneCore match!');
      return true;
    }
  }

  const durationDiff = Math.abs((songA.duration || 0) - (songB.duration || 0));
  console.log(`  Duration diff: ${durationDiff}s`);
  
  if (durationDiff < 15) {
    const artistA = (songA.primaryArtists || '').toLowerCase().split(',')[0].split('&')[0].trim();
    const artistB = (songB.primaryArtists || '').toLowerCase().split(',')[0].split('&')[0].trim();
    console.log(`  Artists split: "${artistA}" vs "${artistB}"`);
    if (artistA && artistB && (artistA.includes(artistB) || artistB.includes(artistA))) {
      console.log('  -> Duplicate by artist + duration match!');
      return true;
    }
  }

  console.log('  -> Unique song!');
  return false;
};

const currentSong = { id: 'saavn_1', name: 'Annul Maelae', duration: 322, primaryArtists: 'Harris Jayaraj, Sudha Ragunathan' };

const suggestions = [
  { id: 'yt_1', name: 'Annul Maelae (Instrumental)', duration: 322, primaryArtists: 'Harris Jayaraj - Topic' },
  { id: 'yt_2', name: 'Vaaranam Aayiram - Annul Maelae Video | Harris Jayaraj | Suriya', duration: 312, primaryArtists: 'SonyMusicSouthVEVO' },
  { id: 'yt_3', name: 'Vaaranam Aayiram BGM - Annul Maelae Panithuli BGM', duration: 31, primaryArtists: 'Cinema With Sathriyan' },
  { id: 'yt_4', name: 'ANNUL MAELAE | Vaaranam Aayiram | Harris Jayaraj | Vocal only', duration: 243, primaryArtists: 'Vocal songs' },
  { id: 'yt_5', name: 'Harris Jayaraj - Annul Maelae (Lyrics) Sudha Ragunathan', duration: 322, primaryArtists: 'seventyskye' },
  { id: 'yt_6', name: 'Annul Maelae 8D - Vaaranam Aayiram | with Lyrics | 8D Plex | Harris Hits', duration: 256, primaryArtists: '8D Plex' },
  { id: 'yt_7', name: 'Harris Jayaraj, Sudha Ragunathan - Annul Maelae (Samādhi Remix)', duration: 322, primaryArtists: 'Samadhi' }
];

suggestions.forEach(s => {
  isDuplicateTrack(currentSong, s);
  console.log('------------------------------------');
});
