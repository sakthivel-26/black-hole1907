const query = "Raathu Raasan";

async function testLrcLibSearch() {
  const url = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
  console.log('Searching LrcLib:', url);
  try {
    const res = await fetch(url);
    console.log('LrcLib Search Status:', res.status);
    if (res.ok) {
      const data = await res.json();
      console.log('Results count:', data.length);
      if (data.length > 0) {
        const first = data[0];
        console.log('First result:', {
          trackName: first.trackName,
          artistName: first.artistName,
          albumName: first.albumName,
          hasSynced: !!first.syncedLyrics,
          hasPlain: !!first.plainLyrics
        });
        console.log('Synced lyrics preview:', first.syncedLyrics ? first.syncedLyrics.substring(0, 100) : 'None');
      }
    } else {
      console.log('LrcLib Search Error:', await res.text());
    }
  } catch (err) {
    console.error('LrcLib Search Error:', err);
  }
}

testLrcLibSearch();
