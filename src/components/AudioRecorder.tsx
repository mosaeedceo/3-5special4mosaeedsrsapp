import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isNativePlatform } from '@/lib/platform';


interface AudioRecorderProps {
  onRecordingComplete: (audioData: string, fileName: string) => void;
}

export const AudioRecorder = ({ onRecordingComplete }: AudioRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    setRecordingTime(0);
    timerIntervalRef.current = window.setInterval(() => {
      setRecordingTime(prev => prev + 1);
    }, 1000);
  }, [stopTimer]);

  // Check permission status on mount for native
  useEffect(() => {
    const checkPermission = async () => {
      if (isNativePlatform()) {
        try {
          const { VoiceRecorder } = await import('capacitor-voice-recorder');
          const hasPermission = await VoiceRecorder.hasAudioRecordingPermission();
          setPermissionStatus(hasPermission.value ? 'granted' : 'unknown');
        } catch (err) {
          console.error('Error checking permission:', err);
        }
      }
    };
    checkPermission();
  }, []);

  useEffect(() => {
    return () => {
      stopTimer();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [stopTimer]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const requestMicrophonePermission = async (): Promise<boolean> => {
    if (isNativePlatform()) {
      try {
        const { VoiceRecorder } = await import('capacitor-voice-recorder');
        
        // First check current permission status
        const hasPermission = await VoiceRecorder.hasAudioRecordingPermission();
        
        if (hasPermission.value) {
          setPermissionStatus('granted');
          return true;
        }
        
        // Request permission
        const permissionResult = await VoiceRecorder.requestAudioRecordingPermission();
        
        if (permissionResult.value) {
          setPermissionStatus('granted');
          return true;
        } else {
          setPermissionStatus('denied');
          return false;
        }
      } catch (err) {
        console.error('Permission request error:', err);
        return false;
      }
    } else {
      // Web - check navigator.permissions or try getUserMedia
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setPermissionStatus('granted');
        return true;
      } catch (err) {
        setPermissionStatus('denied');
        return false;
      }
    }
  };

  const startRecording = async () => {
    setError(null);
    setIsLoading(true);

    // First request permission
    const hasPermission = await requestMicrophonePermission();
    if (!hasPermission) {
      setIsLoading(false);
      return;
    }

    try {
      if (isNativePlatform()) {
        // Use Capacitor Voice Recorder for native
        const { VoiceRecorder } = await import('capacitor-voice-recorder');
        
        // Check if device can record
        const canRecord = await VoiceRecorder.canDeviceVoiceRecord();
        if (!canRecord.value) {
          setError('Your device does not support audio recording.');
          setIsLoading(false);
          return;
        }
        
        await VoiceRecorder.startRecording();
        setIsLoading(false);
        setIsRecording(true);
        startTimer();
      } else {
        // Use Web MediaRecorder API
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Check for supported mime types
        let mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/webm';
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/ogg;codecs=opus';
            if (!MediaRecorder.isTypeSupported(mimeType)) {
              mimeType = ''; // Use default
            }
          }
        }
        
        const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        
        chunksRef.current = [];
        
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
          const reader = new FileReader();
          
          reader.onloadend = () => {
            const base64 = reader.result as string;
            const fileName = `recording_${Date.now()}.webm`;
            onRecordingComplete(base64, fileName);
          };
          
          reader.readAsDataURL(blob);
          
          // Stop all tracks
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start();
        setIsLoading(false);
        setIsRecording(true);
        startTimer();
      }
    } catch (err) {
      console.error('Recording error:', err);
      setError('Could not start recording. Please check your microphone and try again.');
      setIsLoading(false);
    }
  };

  const stopRecording = async () => {
    stopTimer();
    setIsLoading(true);

    try {
      if (isNativePlatform()) {
        const { VoiceRecorder } = await import('capacitor-voice-recorder');
        const result = await VoiceRecorder.stopRecording();
        
        if (result.value && result.value.recordDataBase64) {
          const mimeType = result.value.mimeType || 'audio/wav';
          const extension = mimeType.split('/')[1] || 'wav';
          const fileName = `recording_${Date.now()}.${extension}`;
          const audioData = `data:${mimeType};base64,${result.value.recordDataBase64}`;
          onRecordingComplete(audioData, fileName);
        } else {
          setError('No audio data was recorded.');
        }
      } else {
        if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stop();
        }
      }
    } catch (err) {
      console.error('Stop recording error:', err);
      setError('Failed to save recording.');
    } finally {
      setIsRecording(false);
      setRecordingTime(0);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 p-4 border border-dashed rounded-lg bg-muted/30">
      <div className="flex items-center gap-3">
        {isRecording ? (
          <>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
              <span className="text-sm font-medium text-destructive">
                Recording {formatTime(recordingTime)}
              </span>
            </div>
            <Button
              size="sm"
              variant="destructive"
              onClick={stopRecording}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Square className="w-4 h-4 mr-1" />
              )}
              Stop
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={startRecording}
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
            Record Audio
          </Button>
        )}
      </div>
      
      {permissionStatus === 'denied' && (
        <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
          <AlertCircle className="w-3 h-3" />
          <span>Microphone permission denied. Enable in settings.</span>
        </div>
      )}
      
      {error && (
        <p className="text-xs text-destructive text-center">{error}</p>
      )}
      
      <p className="text-xs text-muted-foreground text-center">
        Tap to record audio notes for this lesson
      </p>
    </div>
  );
};