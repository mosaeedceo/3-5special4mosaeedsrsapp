import { useState, useRef, useEffect, memo, useCallback } from 'react';
import { Play, Pause, Volume2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { LessonAttachment } from '@/types/lesson';
import { loadFileContent, revokeBlobUrl } from '@/lib/fileUtils';

interface LazyAudioPlayerProps {
  attachment: LessonAttachment;
}

export const LazyAudioPlayer = memo(({ attachment }: LazyAudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load audio content on-demand when play is clicked
  const loadAudio = useCallback(async () => {
    if (audioSrc) return audioSrc;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const url = await loadFileContent(attachment);
      if (url) {
        setAudioSrc(url);
        return url;
      } else {
        setError('Could not load audio');
        return null;
      }
    } catch (err) {
      console.error('Failed to load audio:', err);
      setError('Failed to load audio');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [attachment, audioSrc]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (audioSrc) {
        revokeBlobUrl(audioSrc);
      }
    };
  }, [audioSrc]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);
    const handleError = () => setError('Audio playback error');

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [audioSrc]);

  const togglePlayPause = async () => {
    // Load audio on first play
    if (!audioSrc) {
      const loaded = await loadAudio();
      if (!loaded) return;
      
      // Wait for audio element to be ready
      setTimeout(() => {
        const audio = audioRef.current;
        if (audio) {
          audio.play();
          setIsPlaying(true);
        }
      }, 100);
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const formatTime = (time: number) => {
    if (!isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
      {audioSrc && (
        <audio ref={audioRef} src={audioSrc} preload="metadata" />
      )}
      
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 shrink-0"
        onClick={togglePlayPause}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
      </Button>

      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground truncate mb-1">
          {attachment.name}
          {error && <span className="text-destructive ml-2">({error})</span>}
        </p>
        <div className="flex items-center gap-2">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="flex-1"
            disabled={!audioSrc}
          />
          <span className="text-xs text-muted-foreground shrink-0 w-16 text-right">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>

      <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" />
    </div>
  );
});

LazyAudioPlayer.displayName = 'LazyAudioPlayer';
