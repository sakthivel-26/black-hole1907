import { useEffect, useRef } from 'react';
import { getDownloadUrl, getSongById } from '../services/api';
import { searchYouTubeSongs } from '../services/youtube';
import toast from 'react-hot-toast';
import { usePlayerStore } from '../store/usePlayerStore';
import type { Song } from '../types';
import { prefetchLyrics } from '../services/lyricsService';

function updateMediaSessionCustom(song: Song | null, currentTime: number, duration: number, isPlaying: boolean) {
  if (!song || !('mediaSession' in navigator)) return;

  const state = usePlayerStore.getState();
  const repeatMode = state.repeat;
  const isShuffle = state.shuffle;

  const repeatText = repeatMode === 'one' ? ' (🔁 Repeat One)' : repeatMode === 'all' ? ' (🔁 Repeat All)' : '';
  const shuffleText = isShuffle ? ' (🔀 Shuffle On)' : '';
  const metadataArtist = `${song.primaryArtists}${repeatText}${shuffleText}`;

  navigator.mediaSession.metadata = new MediaMetadata({
    title: song.name,
    artist: metadataArtist,
    album: song.album?.name || '',
    artwork: song.image?.map((image) => ({
      src: image.url,
      sizes: image.quality?.includes('x') ? image.quality : '500x500',
      type: 'image/jpeg',
    })) || [],
  });

  navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

  if ('setPositionState' in navigator.mediaSession && Number.isFinite(duration) && duration > 0) {
    try {
      navigator.mediaSession.setPositionState({
        duration: duration,
        playbackRate: 1,
        position: currentTime || 0,
      });
    } catch {
      // Some browsers throw when the metadata is still initializing.
    }
  }
}

export default function AudioEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytTimeIntervalRef = useRef<any>(null);
  const ytInitPromiseRef = useRef<Promise<any> | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  
  const isSwitchingSourceRef = useRef(false);
  const repeatRef = useRef(usePlayerStore.getState().repeat);
  const nextSongRef = useRef(usePlayerStore.getState().nextSong);
  const setIsPlayingRef = useRef(usePlayerStore.getState().setIsPlaying);
  const setIsLoadingRef = useRef(usePlayerStore.getState().setIsLoading);
  const setDurationRef = useRef(usePlayerStore.getState().setDuration);

  const {
    currentSong,
    isPlaying,
    volume,
    isMuted,
    currentTime,
    repeat,
    shuffle,
    setIsPlaying,
    setIsLoading,
    setDuration,
  } = usePlayerStore();

  useEffect(() => {
    repeatRef.current = repeat;
    nextSongRef.current = usePlayerStore.getState().nextSong;
    setIsPlayingRef.current = setIsPlaying;
    setIsLoadingRef.current = setIsLoading;
    setDurationRef.current = setDuration;
  }, [repeat, setDuration, setIsLoading, setIsPlaying]);

  const startYtPolling = () => {
    if (ytTimeIntervalRef.current) return;
    ytTimeIntervalRef.current = setInterval(() => {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
        try {
          const ytCurrentTime = ytPlayerRef.current.getCurrentTime();
          const ytDuration = ytPlayerRef.current.getDuration();
          
          const storeState = usePlayerStore.getState();
          if (Math.abs(storeState.currentTime - ytCurrentTime) > 0.4) {
            usePlayerStore.setState({ currentTime: ytCurrentTime });
          }
          if (ytDuration && storeState.duration !== ytDuration) {
            setDurationRef.current(ytDuration);
          }
        } catch (e) {
          console.error('Error polling YT time:', e);
        }
      }
    }, 250);
  };

  const stopYtPolling = () => {
    if (ytTimeIntervalRef.current) {
      clearInterval(ytTimeIntervalRef.current);
      ytTimeIntervalRef.current = null;
    }
  };

  const initYTPlayer = (): Promise<any> => {
    if (ytPlayerRef.current) {
      return Promise.resolve(ytPlayerRef.current);
    }
    if (ytInitPromiseRef.current) {
      return ytInitPromiseRef.current;
    }

    ytInitPromiseRef.current = new Promise((resolve, reject) => {
      const tryInit = () => {
        if ((window as any).YT && (window as any).YT.Player) {
          // Prepare container element
          const wrapper = wrapperRef.current;
          if (wrapper) {
            wrapper.innerHTML = '<div id="yt-player-container"></div>';
          }

          try {
            const playerInstance = new (window as any).YT.Player('yt-player-container', {
              height: '200',
              width: '200',
              playerVars: {
                autoplay: 0,
                controls: 0,
                disablekb: 1,
                fs: 0,
                rel: 0,
                showinfo: 0,
                iv_load_policy: 3,
                origin: window.location.origin
              },
              events: {
                onReady: () => {
                  ytPlayerRef.current = playerInstance;
                  resolve(playerInstance);
                },
                onStateChange: (event: any) => {
                  const playerState = event.data;
                  
                  // YT.PlayerState.PLAYING (1), PAUSED (2), ENDED (0), BUFFERING (3)
                  if (playerState === 1) {
                    setIsLoadingRef.current(false);
                    setIsPlayingRef.current(true);
                    startYtPolling();
                  } else if (playerState === 2) {
                    setIsPlayingRef.current(false);
                    stopYtPolling();
                  } else if (playerState === 0) {
                    stopYtPolling();
                    if (repeatRef.current === 'one') {
                      playerInstance.seekTo(0, true);
                      playerInstance.playVideo();
                    } else {
                      nextSongRef.current();
                    }
                  } else if (playerState === 3) {
                    setIsLoadingRef.current(true);
                  }
                },
                onError: (err: any) => {
                  const errorCode = err?.data;
                  console.error('YouTube Player Error code:', errorCode, err);
                  // Error 150/101 = embedding blocked, 100 = not found, 2 = invalid param, 5 = HTML5 error
                  setIsLoadingRef.current(false);
                  setIsPlayingRef.current(false);
                  stopYtPolling();
                  if (errorCode === 150 || errorCode === 101) {
                    toast.error('This video blocks embedding. Trying next track...');
                  } else {
                    toast.error('YouTube playback error. Skipping...');
                  }
                  usePlayerStore.getState().nextSong();
                }
              }
            });
          } catch (e) {
            ytInitPromiseRef.current = null;
            reject(e);
          }
          return true;
        }
        return false;
      };

      if (tryInit()) {
        return;
      }

      // Load YouTube Iframe Player script dynamically if not present
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      }

      // Poll until ready
      const checkInterval = setInterval(() => {
        if (tryInit()) {
          clearInterval(checkInterval);
        }
      }, 50);

      // standard callback fallback
      const prevCallback = (window as any).onYouTubeIframeAPIReady;
      (window as any).onYouTubeIframeAPIReady = () => {
        if (prevCallback) {
          try { prevCallback(); } catch (e) {}
        }
        if (tryInit()) {
          clearInterval(checkInterval);
        }
      };
    });

    return ytInitPromiseRef.current;
  };

  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.crossOrigin = 'anonymous';
      audioRef.current = audio;
    }

    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      const storeState = usePlayerStore.getState();
      if (Math.abs(storeState.currentTime - audio.currentTime) > 0.35) {
        usePlayerStore.setState({ currentTime: audio.currentTime });
      }
    };

    const onLoadedMetadata = () => {
      setDurationRef.current(audio.duration || 0);
    };

    const onCanPlay = () => {
      isSwitchingSourceRef.current = false;
      setIsLoadingRef.current(false);
      if (usePlayerStore.getState().isPlaying) {
        audio.play().catch(() => setIsPlayingRef.current(false));
      }
    };

    const onPlay = () => {
      isSwitchingSourceRef.current = false;
      setIsLoadingRef.current(false);
      setIsPlayingRef.current(true);
    };

    const onPause = () => {
      if (!audio.ended && !isSwitchingSourceRef.current) {
        setIsPlayingRef.current(false);
      }
    };

    const onWaiting = () => setIsLoadingRef.current(true);

    const onEnded = () => {
      if (repeatRef.current === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => setIsPlayingRef.current(false));
        return;
      }
      nextSongRef.current();
    };

    const fallbackToYouTube = (song: Song) => {
      console.log(`JioSaavn playback failed for ${song.name}. Falling back to YouTube search...`);
      searchYouTubeSongs(`${song.name} ${song.primaryArtists}`, song.name, song.primaryArtists)
        .then(async (ytSongs) => {
          if (ytSongs.length > 0) {
            const ytSong = ytSongs[0];
            const store = usePlayerStore.getState();
            
            // Swap in the queue/store with the YouTube version
            const newQueue = [...store.queue];
            if (store.queueIndex >= 0 && store.queueIndex < newQueue.length) {
              newQueue[store.queueIndex] = {
                ...ytSong,
                queueId: newQueue[store.queueIndex].queueId
              };
            }
            
            usePlayerStore.setState({
              currentSong: ytSong,
              queue: newQueue,
              isPlaying: true,
              isLoading: true,
              currentTime: 0
            });
          } else {
            throw new Error('No YouTube match found');
          }
        })
        .catch((e) => {
          console.error('YouTube Fallback failed:', e);
          setIsPlayingRef.current(false);
          toast.error('Playback failed. Skipping to next.');
          usePlayerStore.getState().nextSong();
        });
    };

    const onError = () => {
        // Ignore errors when we deliberately cleared the audio src to switch to YouTube
        if (isSwitchingSourceRef.current) {
          return;
        }
        setIsLoadingRef.current(false);
        
        const current = usePlayerStore.getState().currentSong;
        if (!current) {
          setIsPlayingRef.current(false);
          return;
        }

        // If current song is a YouTube track, the HTML5 audio error is irrelevant
        if (current.id.startsWith('yt_')) {
          return;
        }

        const retryKey = `audio_retry_${current.id}`;
        const hasRetried = (window as any)[retryKey];
        if (!hasRetried) {
          (window as any)[retryKey] = true;
          
          if (current.id.startsWith('yt_')) {
            setIsPlayingRef.current(false);
            toast.error('YouTube playback failed. Skipping to next.');
            usePlayerStore.getState().nextSong();
            return;
          }

          // attempt to fetch fresh song details and try alternate URL
          getSongById(current.id)
            .then((songs) => {
              const fresh = songs && songs.length > 0 ? songs[0] : null;
              if (fresh) {
                const url = getDownloadUrl(fresh.downloadUrl);
                const audio = audioRef.current;
                if (audio && url) {
                  audio.pause();
                  audio.src = url;
                  audio.load();
                  setIsLoadingRef.current(true);
                  audio.play().catch(() => {
                    fallbackToYouTube(current);
                  });
                  return;
                }
              }
              fallbackToYouTube(current);
            })
            .catch(() => {
              fallbackToYouTube(current);
            });
          return;
        }

        setIsPlayingRef.current(false);
        toast.error('Playback failed for this track. Skipping to next.');
        usePlayerStore.getState().nextSong();
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.pause();
      audio.src = '';
      stopYtPolling();
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!currentSong) return;

    const loadAndPlaySong = async () => {
      setIsLoading(true);
      setDuration(0);
      usePlayerStore.setState({ currentTime: 0 });

      const isYt = currentSong.id.startsWith('yt_');
      if (isYt) {
        // Mark as switching so the HTML5 audio onError doesn't fire and skip the track
        isSwitchingSourceRef.current = true;
        if (audio) {
          audio.pause();
          audio.removeAttribute('src');
          audio.load(); // reset without triggering error
        }
        stopYtPolling();

        try {
          const ytPlayer = await initYTPlayer();
          const videoId = currentSong.id.replace('yt_', '');
          
          // Use loadVideoById or cueVideoById depending on playing status
          const startPlaying = usePlayerStore.getState().isPlaying;
          if (startPlaying) {
            ytPlayer.loadVideoById({ videoId });
            startYtPolling();
          } else {
            ytPlayer.cueVideoById({ videoId });
            setIsLoading(false);
          }
          
          ytPlayer.setVolume(isMuted ? 0 : volume * 100);
          updateMediaSessionCustom(currentSong, 0, currentSong.duration || 0, startPlaying);
        } catch (err) {
          console.error('Error resolving YouTube playback:', err);
          setIsLoading(false);
          setIsPlaying(false);
          toast.error('YouTube playback failed to initialize.');
          nextSongRef.current();
        }
      } else {
        if (ytPlayerRef.current && typeof ytPlayerRef.current.pauseVideo === 'function') {
          try {
            ytPlayerRef.current.pauseVideo();
          } catch {}
        }
        stopYtPolling();

        let url = getDownloadUrl(currentSong.downloadUrl);
        if (!url) {
          console.log(`No download URL for ${currentSong.name}. Searching YouTube...`);
          try {
            const ytSongs = await searchYouTubeSongs(`${currentSong.name} ${currentSong.primaryArtists}`, currentSong.name, currentSong.primaryArtists);
            if (ytSongs.length > 0) {
              const ytSong = ytSongs[0];
              const store = usePlayerStore.getState();
              const newQueue = [...store.queue];
              if (store.queueIndex >= 0 && store.queueIndex < newQueue.length) {
                newQueue[store.queueIndex] = {
                  ...ytSong,
                  queueId: newQueue[store.queueIndex].queueId
                };
              }
              usePlayerStore.setState({
                currentSong: ytSong,
                queue: newQueue,
                isPlaying: true,
                isLoading: true,
                currentTime: 0
              });
              return;
            }
          } catch (err) {
            console.error('Error resolving fallback:', err);
          }
        }

        if (!url) {
          setIsLoading(false);
          setIsPlaying(false);
          toast.error('Playback failed. Streaming source unavailable.');
          nextSongRef.current();
          return;
        }

        if (audio) {
          isSwitchingSourceRef.current = true;
          audio.pause();
          audio.src = url;
          audio.currentTime = 0;
          audio.load();

          updateMediaSessionCustom(currentSong, 0, currentSong.duration || 0, usePlayerStore.getState().isPlaying);

          if (usePlayerStore.getState().isPlaying) {
            audio.play().catch(() => setIsPlaying(false));
          }
        }
      }
    };

    void loadAndPlaySong();
    if (currentSong) {
      prefetchLyrics(currentSong);
    }
  }, [currentSong?.id]);

  useEffect(() => {
    const isYt = currentSong?.id.startsWith('yt_');
    if (isYt) {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.playVideo === 'function') {
        try {
          if (isPlaying) {
            ytPlayerRef.current.playVideo();
            startYtPolling();
          } else {
            ytPlayerRef.current.pauseVideo();
            stopYtPolling();
          }
        } catch {}
      }
    } else {
      const audio = audioRef.current;
      if (!audio) return;

      if (isPlaying) {
        audio.play().catch(() => setIsPlaying(false));
      } else if (!audio.paused) {
        audio.pause();
      }
    }
  }, [isPlaying, currentSong?.id]);

  useEffect(() => {
    const isYt = currentSong?.id.startsWith('yt_');
    if (isYt) {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.setVolume === 'function') {
        try {
          ytPlayerRef.current.setVolume(isMuted ? 0 : volume * 100);
        } catch {}
      }
    } else {
      const audio = audioRef.current;
      if (!audio) return;
      audio.volume = isMuted ? 0 : volume;
    }
  }, [isMuted, volume, currentSong?.id]);

  useEffect(() => {
    const isYt = currentSong?.id.startsWith('yt_');
    if (isYt) {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
        try {
          const ytCurrentTime = ytPlayerRef.current.getCurrentTime();
          if (Number.isFinite(currentTime) && Math.abs(ytCurrentTime - currentTime) > 1.5) {
            ytPlayerRef.current.seekTo(currentTime, true);
          }
        } catch {}
      }
    } else {
      const audio = audioRef.current;
      if (!audio) return;

      if (Number.isFinite(currentTime) && Math.abs(audio.currentTime - currentTime) > 1) {
        audio.currentTime = currentTime;
      }
    }
  }, [currentTime, currentSong?.id]);

  useEffect(() => {
    if (currentSong) {
      const audio = audioRef.current;
      const isYt = currentSong.id.startsWith('yt_');
      let songDuration = 0;
      try {
        songDuration = isYt 
          ? (ytPlayerRef.current?.getDuration() || currentSong.duration || 0)
          : (audio?.duration || currentSong.duration || 0);
      } catch {}
      updateMediaSessionCustom(currentSong, currentTime, songDuration, isPlaying);
    }
  }, [repeat, shuffle]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    const syncActions = () => {
      navigator.mediaSession.setActionHandler('play', () => {
        usePlayerStore.setState({ isPlaying: true });
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        usePlayerStore.setState({ isPlaying: false });
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        usePlayerStore.getState().prevSong();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        usePlayerStore.getState().nextSong();
      });
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const isYt = usePlayerStore.getState().currentSong?.id.startsWith('yt_');
        const skip = details.seekOffset || 10;
        if (isYt) {
          if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
            const newTime = Math.max(0, ytPlayerRef.current.getCurrentTime() - skip);
            ytPlayerRef.current.seekTo(newTime, true);
            usePlayerStore.setState({ currentTime: newTime });
          }
        } else {
          const audio = audioRef.current;
          if (!audio) return;
          audio.currentTime = Math.max(0, audio.currentTime - skip);
          usePlayerStore.setState({ currentTime: audio.currentTime });
        }
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const isYt = usePlayerStore.getState().currentSong?.id.startsWith('yt_');
        const skip = details.seekOffset || 10;
        if (isYt) {
          if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
            const duration = ytPlayerRef.current.getDuration() || 0;
            const newTime = Math.min(duration, ytPlayerRef.current.getCurrentTime() + skip);
            ytPlayerRef.current.seekTo(newTime, true);
            usePlayerStore.setState({ currentTime: newTime });
          }
        } else {
          const audio = audioRef.current;
          if (!audio) return;
          audio.currentTime = Math.min(audio.duration || audio.currentTime + skip, audio.currentTime + skip);
          usePlayerStore.setState({ currentTime: audio.currentTime });
        }
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        const isYt = usePlayerStore.getState().currentSong?.id.startsWith('yt_');
        if (details.seekTime == null) return;
        if (isYt) {
          if (ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
            ytPlayerRef.current.seekTo(details.seekTime, true);
            usePlayerStore.setState({ currentTime: details.seekTime });
          }
        } else {
          const audio = audioRef.current;
          if (!audio) return;
          audio.currentTime = details.seekTime;
          usePlayerStore.setState({ currentTime: details.seekTime });
        }
      });
    };

    syncActions();

    // Periodically re-sync to ensure the OS hasn't dropped the session
    const interval = setInterval(syncActions, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const isYt = currentSong?.id.startsWith('yt_');
    if (isYt) {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.getDuration === 'function') {
        try {
          const ytDuration = ytPlayerRef.current.getDuration() || currentSong.duration || 0;
          updateMediaSessionCustom(currentSong, currentTime, ytDuration, isPlaying);
        } catch {
          updateMediaSessionCustom(currentSong, currentTime, currentSong.duration || 0, isPlaying);
        }
      } else {
        updateMediaSessionCustom(currentSong, currentTime, currentSong.duration || 0, isPlaying);
      }
    } else {
      const audio = audioRef.current;
      if (!audio) return;
      updateMediaSessionCustom(currentSong, currentTime, audio.duration || currentSong?.duration || 0, isPlaying);
    }
  }, [currentSong, currentTime, isPlaying]);

  return (
    <div 
      ref={wrapperRef}
      style={{
        position: 'fixed',
        left: '-9999px',
        top: '-9999px',
        width: '200px',
        height: '200px',
        overflow: 'hidden',
        pointerEvents: 'none',
        opacity: 0,
      }}
    >
      <div id="yt-player-container" />
    </div>
  );
}
