import type { MouseEventHandler, ReactNode } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  FiCheck,
  FiChevronUp,
  FiDownload,
  FiHeart,
  FiList,
  FiMinus,
  FiPause,
  FiPlay,
  FiRepeat,
  FiShuffle,
  FiSkipBack,
  FiSkipForward,
  FiVolume1,
  FiVolume2,
  FiVolumeX,
} from 'react-icons/fi';
import { downloadSongFile, formatDuration, getAudioQualityLabel, getImageUrl } from '../services/api';
import { usePlayerStore } from '../store/usePlayerStore';

export default function PlayerBar() {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    shuffle,
    repeat,
    isLoading,
    isPlayerBarMinimized,
    togglePlay,
    nextSong,
    prevSong,
    seekTo,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
    toggleLike,
    isLiked,
    setShowNowPlaying,
    setShowQueue,
    addDownloadedSong,
    isDownloaded,
    setPlayerBarMinimized,
  } = usePlayerStore();

  if (!currentSong) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const liked = isLiked(currentSong.id);
  const downloaded = isDownloaded(currentSong.id);
  const VolumeIcon = isMuted || volume === 0 ? FiVolumeX : volume < 0.5 ? FiVolume1 : FiVolume2;

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const time = (Number(event.target.value) / 100) * duration;
    seekTo(time);
  };

  const handleDownload = async (event?: React.MouseEvent) => {
    event?.stopPropagation();
    const loadingToast = toast.loading(`Downloading ${currentSong.name}...`);
    try {
      const result = await downloadSongFile(currentSong);
      addDownloadedSong(currentSong);
      toast.success(`Saved in ${result.quality}`, { id: loadingToast });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Download failed.', { id: loadingToast });
    }
  };

  if (isPlayerBarMinimized) {
    return (
      <div className="fixed bottom-[calc(68px+env(safe-area-inset-bottom,0px))] right-3 z-50 flex items-center gap-3 md:bottom-5 md:right-5">
        <button
          onClick={togglePlay}
          className="flex h-13 w-13 items-center justify-center rounded-full border border-white/10 bg-[#232326]/92 text-white shadow-[0_20px_40px_rgba(0,0,0,0.34)] backdrop-blur-3xl transition hover:scale-[1.03]"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isLoading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : isPlaying ? (
            <FiPause size={20} />
          ) : (
            <FiPlay size={20} className="ml-0.5" />
          )}
        </button>

        <button
          onClick={() => setPlayerBarMinimized(false)}
          className="flex items-center gap-3 rounded-full border border-white/10 bg-[#232326]/92 px-3 py-2 text-left text-white shadow-[0_20px_40px_rgba(0,0,0,0.34)] backdrop-blur-3xl transition hover:scale-[1.02]"
        >
          <div className="h-10 w-10 overflow-hidden rounded-full bg-white/10 sm:h-11 sm:w-11">
            {currentSong.image?.length > 0 && (
              <img
                src={getImageUrl(currentSong.image, 'medium')}
                alt={currentSong.name}
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div className="hidden min-w-0 sm:block">
            <p className="line-clamp-1 text-sm font-medium">{currentSong.name}</p>
            <p className="line-clamp-1 text-xs text-white/45">{currentSong.primaryArtists}</p>
          </div>
          <FiChevronUp size={18} className="text-white/55" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-[calc(53px+env(safe-area-inset-bottom,0px))] md:bottom-0 left-0 right-0 z-50 pointer-events-none">
      <div className="mx-auto w-full max-w-[1180px] px-2 pb-2 md:px-4 md:pb-4">
        <div className="pointer-events-auto overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(135deg,rgba(62,62,65,0.88),rgba(28,28,30,0.94))] shadow-[0_20px_60px_rgba(0,0,0,0.32)] backdrop-blur-3xl">
          <div className="px-4 pt-2 md:px-6">
            <input
              type="range"
              min={0}
              max={100}
              value={progress}
              onChange={handleSeek}
              className="progress-bar w-full"
              style={{
                background: `linear-gradient(to right, #ff375f ${progress}%, rgba(255,255,255,0.15) ${progress}%)`,
              }}
            />
          </div>

          <div className="md:hidden">
            <div className="flex items-center gap-2 px-3 py-3">
              <button
                onClick={() => setShowNowPlaying(true)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <div className="h-10 w-10 overflow-hidden rounded-full bg-white/10 sm:h-12 sm:w-12">
                  {currentSong.image?.length > 0 && (
                    <img
                      src={getImageUrl(currentSong.image, 'medium')}
                      alt={currentSong.name}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium text-white">{currentSong.name}</p>
                  <p className="line-clamp-1 text-xs text-white/45">{currentSong.primaryArtists}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.22em] text-white/28">
                    {getAudioQualityLabel(currentSong.downloadUrl)}
                  </p>
                </div>
              </button>

              <PlayerCircleButton
                onClick={() => toggleLike(currentSong)}
                title="Like"
                active={liked}
              >
                <FiHeart className={liked ? 'fill-current' : ''} size={17} />
              </PlayerCircleButton>

              <PlayerCircleButton onClick={handleDownload} title="Download" active={downloaded}>
                {downloaded ? <FiCheck size={17} /> : <FiDownload size={17} />}
              </PlayerCircleButton>

              <PlayerCircleButton
                onClick={togglePlay}
                title={isPlaying ? 'Pause' : 'Play'}
                prominent
              >
                {isLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : isPlaying ? (
                  <FiPause size={18} />
                ) : (
                  <FiPlay size={18} className="ml-0.5" />
                )}
              </PlayerCircleButton>

              <PlayerCircleButton
                onClick={() => setPlayerBarMinimized(true)}
                title="Minimize player"
              >
                <FiMinus size={17} />
              </PlayerCircleButton>
            </div>
          </div>

          <div className="hidden items-center gap-4 px-6 py-4 md:flex">
            <div
              className="flex min-w-0 flex-1 items-center gap-4 cursor-pointer"
              onClick={() => setShowNowPlaying(true)}
            >
              <motion.div whileHover={{ scale: 1.03 }} className="h-14 w-14 overflow-hidden rounded-full bg-white/10">
                {currentSong.image?.length > 0 && (
                  <img
                    src={getImageUrl(currentSong.image, 'medium')}
                    alt={currentSong.name}
                    className="h-full w-full object-cover"
                  />
                )}
              </motion.div>

              <div className="min-w-0">
                <p className="line-clamp-1 text-sm font-medium text-white">{currentSong.name}</p>
                <p className="line-clamp-1 text-xs text-white/45">{currentSong.primaryArtists}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.26em] text-white/28">
                  {getAudioQualityLabel(currentSong.downloadUrl)}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2">
                <PlayerCircleButton onClick={toggleShuffle} title="Shuffle" active={shuffle}>
                  <FiShuffle size={17} />
                </PlayerCircleButton>
                <PlayerCircleButton onClick={prevSong} title="Previous">
                  <FiSkipBack size={19} className="fill-current" />
                </PlayerCircleButton>
                <PlayerCircleButton onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'} prominent>
                  {isLoading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-black/25 border-t-black" />
                  ) : isPlaying ? (
                    <FiPause size={20} />
                  ) : (
                    <FiPlay size={20} className="ml-0.5" />
                  )}
                </PlayerCircleButton>
                <PlayerCircleButton onClick={nextSong} title="Next">
                  <FiSkipForward size={19} className="fill-current" />
                </PlayerCircleButton>
                <PlayerCircleButton onClick={toggleRepeat} title="Repeat" active={repeat !== 'off'}>
                  <div className="relative">
                    <FiRepeat size={17} />
                    {repeat === 'one' && <span className="absolute -right-1 -top-1 text-[8px] font-bold">1</span>}
                  </div>
                </PlayerCircleButton>
              </div>

              <div className="flex items-center gap-3 text-xs text-white/38">
                <span className="tabular-nums">{formatDuration(currentTime)}</span>
                <span className="tabular-nums">{formatDuration(duration)}</span>
              </div>
            </div>

            <div className="flex flex-1 items-center justify-end gap-2">
              <PlayerCircleButton onClick={() => toggleLike(currentSong)} title="Like" active={liked}>
                <FiHeart className={liked ? 'fill-current' : ''} size={16} />
              </PlayerCircleButton>
              <PlayerCircleButton onClick={handleDownload} title="Download" active={downloaded}>
                {downloaded ? <FiCheck size={16} /> : <FiDownload size={16} />}
              </PlayerCircleButton>
              <PlayerCircleButton onClick={() => setShowQueue(true)} title="Queue">
                <FiList size={16} />
              </PlayerCircleButton>
              <PlayerCircleButton onClick={() => setPlayerBarMinimized(true)} title="Minimize player">
                <FiMinus size={16} />
              </PlayerCircleButton>

              <div className="flex items-center gap-2 rounded-full border border-white/8 bg-white/4 px-3 py-2">
                <button onClick={toggleMute} className="text-white/55 transition hover:text-white">
                  <VolumeIcon size={16} />
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={isMuted ? 0 : volume * 100}
                  onChange={(event) => setVolume(Number(event.target.value) / 100)}
                  className="volume-slider w-28"
                  style={{
                    background: `linear-gradient(to right, #fff ${isMuted ? 0 : volume * 100}%, rgba(255,255,255,0.2) ${isMuted ? 0 : volume * 100}%)`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerCircleButton({
  children,
  onClick,
  title,
  active = false,
  prominent = false,
}: {
  children: ReactNode;
  onClick: MouseEventHandler<HTMLButtonElement>;
  title: string;
  active?: boolean;
  prominent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center justify-center rounded-full border transition hover:scale-[1.03] ${
        prominent
          ? 'h-12 w-12 border-white bg-white text-black shadow-[0_10px_30px_rgba(255,255,255,0.18)]'
          : active
                  ? 'h-10 w-10 border-primary/35 bg-primary/15 text-[#ff8a9d]'
                  : 'h-10 w-10 border-white/10 bg-white/5 text-white/70 hover:bg-white/8 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}
