import { useState, useRef, memo, useCallback, useEffect } from 'react';
import { LessonAttachment } from '@/types/lesson';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  Paperclip, 
  X, 
  FileText, 
  Image as ImageIcon, 
  File, 
  Download,
  Video,
  Music,
  Loader2
} from 'lucide-react';

import { AudioRecorder } from './AudioRecorder';
import { LazyAudioPlayer } from './LazyAudioPlayer';
import { isNativePlatform } from '@/lib/platform';
import { loadFileContent } from '@/lib/fileUtils';

interface FileAttachmentProps {
  attachments: LessonAttachment[];
  onChange: (attachments: LessonAttachment[]) => void;
}

const getFileIcon = (type: string) => {
  if (type.startsWith('image/')) return ImageIcon;
  if (type.startsWith('audio/')) return Music;
  if (type.startsWith('video/')) return Video;
  if (type === 'application/pdf') return FileText;
  return File;
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Get file extension from mime type
const getExtensionFromMime = (mimeType: string): string => {
  const mimeMap: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'audio/webm': 'webm',
    'audio/wav': 'wav',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/ogg': 'ogg',
    'audio/aac': 'aac',
    'audio/m4a': 'm4a',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    'video/x-matroska': 'mkv',
  };
  return mimeMap[mimeType] || 'bin';
};

// Save file to Capacitor DataDirectory for persistence
const saveFileToDevice = async (
  base64Data: string, 
  fileName: string, 
  mimeType: string
): Promise<string | null> => {
  if (!isNativePlatform()) return null;
  
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    
    // Create a unique filename to avoid conflicts
    const extension = getExtensionFromMime(mimeType);
    const baseName = fileName.includes('.') ? fileName.split('.').slice(0, -1).join('.') : fileName;
    const uniqueFileName = `${Date.now()}_${baseName}.${extension}`;
    
    // Write to Data directory (persists across app restarts)
    const result = await Filesystem.writeFile({
      path: `attachments/${uniqueFileName}`,
      data: base64Data,
      directory: Directory.Data,
      recursive: true,
    });
    
    console.log('File saved to:', result.uri);
    return result.uri; // Return the full URI for direct access
  } catch (error) {
    console.error('Error saving file to device:', error);
    return null;
  }
};

// Extract relative path from full URI for Filesystem operations
const getRelativePathFromUri = (uri: string): string => {
  const attachmentsIndex = uri.indexOf('attachments/');
  if (attachmentsIndex !== -1) {
    return uri.substring(attachmentsIndex);
  }
  return uri;
};

// Delete file from Capacitor storage
const deleteFileFromDevice = async (uri: string): Promise<void> => {
  if (!isNativePlatform() || !uri) return;
  
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const relativePath = getRelativePathFromUri(uri);
    await Filesystem.deleteFile({ 
      path: relativePath,
      directory: Directory.Data 
    });
    console.log('File deleted:', relativePath);
  } catch (error) {
    console.error('Error deleting file from device:', error);
  }
};

// Open file directly with native app using FileOpener
const openFileWithNativeApp = async (
  attachment: LessonAttachment
): Promise<boolean> => {
  if (!isNativePlatform()) return false;
  
  try {
    const { FileOpener } = await import('@capacitor-community/file-opener');
    
    // If we have a localPath (permanent URI), use it directly
    if (attachment.localPath) {
      console.log('Opening file from permanent storage:', attachment.localPath);
      await FileOpener.open({
        filePath: attachment.localPath,
        contentType: attachment.type,
      });
      return true;
    }
    
    // No localPath available - can't open
    console.error('No localPath available for attachment');
    toast.error(`Could not open "${attachment.name}" — file path is missing. Try re-attaching the file.`);
    return false;
  } catch (error) {
    console.error('Error opening file with FileOpener:', error);
    
    // Fallback to Share if FileOpener fails
    try {
      const { Share } = await import('@capacitor/share');
      
      if (attachment.localPath) {
        await Share.share({
          title: attachment.name,
          url: attachment.localPath,
          dialogTitle: `Open ${attachment.name}`,
        });
        return true;
      }
    } catch (shareError) {
      console.error('Share fallback also failed:', shareError);
      toast.error(`Could not open "${attachment.name}". Please try downloading it instead.`);
    }
    return false;
  }
};

// Convert File to data URL
const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Memoized attachment item component
const AttachmentItem = memo(({ 
  attachment, 
  onRemove, 
  onView, 
  onDownload 
}: { 
  attachment: LessonAttachment; 
  onRemove: () => void; 
  onView: () => void; 
  onDownload: () => void;
}) => {
  const Icon = getFileIcon(attachment.type);
  const isImage = attachment.type.startsWith('image/');
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loadingThumb, setLoadingThumb] = useState(false);

  // Load thumbnail on-demand for images
  const loadThumbnail = useCallback(async () => {
    if (!isImage || thumbnailUrl || loadingThumb) return;
    
    setLoadingThumb(true);
    const url = await loadFileContent(attachment);
    setThumbnailUrl(url);
    setLoadingThumb(false);
  }, [isImage, thumbnailUrl, loadingThumb, attachment]);

  // Load thumbnail when component mounts (only for images with cached URL)
  useEffect(() => {
    if (isImage && attachment.url && !thumbnailUrl) {
      setThumbnailUrl(attachment.url);
    }
  }, [isImage, attachment.url, thumbnailUrl]);

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors">
      {/* Thumbnail or Icon */}
      {isImage ? (
        thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={attachment.name}
            className="w-10 h-10 rounded object-cover cursor-pointer"
            onClick={onView}
          />
        ) : (
          <div 
            className="w-10 h-10 rounded bg-muted flex items-center justify-center cursor-pointer"
            onClick={() => { loadThumbnail(); onView(); }}
          >
            {loadingThumb ? (
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            ) : (
              <ImageIcon className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        )
      ) : (
        <div 
          className="w-10 h-10 rounded bg-muted flex items-center justify-center cursor-pointer"
          onClick={onView}
        >
          <Icon className="w-5 h-5 text-muted-foreground" />
        </div>
      )}

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <p 
          className="text-sm font-medium truncate cursor-pointer hover:text-primary"
          onClick={onView}
        >
          {attachment.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(attachment.size)}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onDownload}
        >
          <Download className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
});

AttachmentItem.displayName = 'AttachmentItem';

// Memoized video attachment item
const VideoAttachmentItem = memo(({ 
  attachment, 
  onRemove, 
  onView, 
  onDownload 
}: { 
  attachment: LessonAttachment; 
  onRemove: () => void; 
  onView: () => void; 
  onDownload: () => void;
}) => {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors">
      <div 
        className="w-16 h-12 rounded bg-muted flex items-center justify-center cursor-pointer"
        onClick={onView}
      >
        <Video className="w-6 h-6 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p 
          className="text-sm font-medium truncate cursor-pointer hover:text-primary"
          onClick={onView}
        >
          {attachment.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(attachment.size)}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onDownload}
        >
          <Download className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
});

VideoAttachmentItem.displayName = 'VideoAttachmentItem';

export const FileAttachment = memo(({ 
  attachments, 
  onChange
}: FileAttachmentProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);
    const newAttachments: LessonAttachment[] = [];

    for (const file of Array.from(files)) {
      try {
        const dataUrl = await fileToDataUrl(file);
        const base64Data = dataUrl.split(',')[1];
        
        // Save to device storage for persistence (native only)
        const localPath = await saveFileToDevice(base64Data, file.name, file.type);
        
        // On native: only store metadata + localPath (no Base64 url)
        // On web: store url since no filesystem available
        newAttachments.push({
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type,
          size: file.size,
          localPath: localPath || undefined,
          // Only store URL on web platform
          url: isNativePlatform() ? undefined : dataUrl,
        });
      } catch (error) {
        console.error('Error reading file:', error);
      }
    }

    if (newAttachments.length > 0) {
      onChange([...attachments, ...newAttachments]);
    }

    setIsLoading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [attachments, onChange]);

  const handleRemove = useCallback(async (attachment: LessonAttachment) => {
    // Delete from device storage if exists
    if (attachment.localPath) {
      await deleteFileFromDevice(attachment.localPath);
    }
    onChange(attachments.filter(a => a.id !== attachment.id));
  }, [attachments, onChange]);

  const handleDownload = useCallback(async (attachment: LessonAttachment) => {
    // Load content on-demand for download
    const url = await loadFileContent(attachment);
    if (!url) {
      return;
    }
    
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.name;
    link.click();
  }, []);

  const handleView = useCallback(async (attachment: LessonAttachment) => {
    if (isNativePlatform()) {
      const opened = await openFileWithNativeApp(attachment);
      if (!opened) {
        await handleDownload(attachment);
      }
    } else {
      // Web fallback - load content on demand
      const url = await loadFileContent(attachment);
      if (url) {
        window.open(url, '_blank');
      }
    }
  }, [handleDownload]);

  const handleRecordingComplete = useCallback(async (audioData: string, fileName: string) => {
    const estimatedSize = Math.round((audioData.length * 3) / 4);
    const mimeType = audioData.includes('audio/webm') ? 'audio/webm' : 'audio/wav';
    const base64Data = audioData.split(',')[1];
    
    // Save to device storage for persistence (native only)
    const localPath = await saveFileToDevice(base64Data, fileName, mimeType);

    const newAttachment: LessonAttachment = {
      id: crypto.randomUUID(),
      name: fileName,
      type: mimeType,
      size: estimatedSize,
      localPath: localPath || undefined,
      // Only store URL on web platform
      url: isNativePlatform() ? undefined : audioData,
    };

    onChange([...attachments, newAttachment]);
  }, [attachments, onChange]);

  const audioAttachments = attachments.filter(a => a.type.startsWith('audio/'));
  const videoAttachments = attachments.filter(a => a.type.startsWith('video/'));
  const fileAttachments = attachments.filter(a => 
    !a.type.startsWith('audio/') && !a.type.startsWith('video/')
  );

  return (
    <div className="space-y-4">
      {/* Audio Recorder */}
      <AudioRecorder onRecordingComplete={handleRecordingComplete} />

      {/* Audio Attachments */}
      {audioAttachments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Music className="w-4 h-4" />
            Audio ({audioAttachments.length})
          </h4>
          {audioAttachments.map((attachment) => (
            <div key={attachment.id} className="relative">
              <LazyAudioPlayer attachment={attachment} />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 text-destructive hover:text-destructive"
                onClick={() => handleRemove(attachment)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Video Attachments */}
      {videoAttachments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Video className="w-4 h-4" />
            Videos ({videoAttachments.length})
          </h4>
          {videoAttachments.map((attachment) => (
            <VideoAttachmentItem
              key={attachment.id}
              attachment={attachment}
              onRemove={() => handleRemove(attachment)}
              onView={() => handleView(attachment)}
              onDownload={() => handleDownload(attachment)}
            />
          ))}
        </div>
      )}

      {/* File Attachments List */}
      {fileAttachments.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Paperclip className="w-4 h-4" />
            Files ({fileAttachments.length})
          </h4>
          {fileAttachments.map((attachment) => (
            <AttachmentItem
              key={attachment.id}
              attachment={attachment}
              onRemove={() => handleRemove(attachment)}
              onView={() => handleView(attachment)}
              onDownload={() => handleDownload(attachment)}
            />
          ))}
        </div>
      )}

      {/* Add File Button */}
      <div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          multiple
          accept="image/*,application/pdf,audio/*,video/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
        />
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Paperclip className="w-4 h-4 mr-2" />
              Add Files
            </>
          )}
        </Button>
      </div>
    </div>
  );
});

FileAttachment.displayName = 'FileAttachment';
