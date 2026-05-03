import { useMemo, useState } from 'react';
import { Bug, RefreshCw, Database, Folder, ShieldAlert, Trash2, Search, Download, CheckSquare2, Square, Info, Clock, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

import { getStorageDebugInfo, getData } from '@/lib/storage';
import { safeCleanup, type OrphanDiskFile } from '@/lib/fileCleanup';
import { isNativePlatform } from '@/lib/platform';

interface FileInfo {
  name: string;
  size?: number;
}

interface DebugInfo {
  platform: string;
  storageType: string;
  dataSize: string;
  files: FileInfo[];
  preferencesData: string | null;
  attachmentCount: number;
  totalAttachmentSize: string;
}

const formatSize = (bytes?: number): string => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const parseSizeToBytes = (sizeStr: string): number => {
  const match = sizeStr.match(/^([\d.]+)\s*(B|KB|MB|GB)?$/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = (match[2] || 'B').toUpperCase();
  switch (unit) {
    case 'KB': return value * 1024;
    case 'MB': return value * 1024 * 1024;
    case 'GB': return value * 1024 * 1024 * 1024;
    default: return value;
  }
};

const LoadingSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
      <div className="h-4 bg-muted rounded w-1/3"></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-muted/50 p-3 h-16"></div>
        <div className="rounded-lg bg-muted/50 p-3 h-16"></div>
      </div>
      <div className="space-y-1">
        <div className="h-3 bg-muted rounded w-2/3"></div>
        <div className="h-3 bg-muted rounded w-1/2"></div>
      </div>
    </div>
    <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
      <div className="h-4 bg-muted rounded w-1/4"></div>
      <div className="h-9 bg-muted rounded"></div>
      <div className="h-9 bg-muted rounded"></div>
    </div>
  </div>
);

export const DebugStorageDialog = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [lessonsLoaded, setLessonsLoaded] = useState(false);
  const [lessonCount, setLessonCount] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [orphanedFiles, setOrphanedFiles] = useState<OrphanDiskFile[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [cleanupLog, setCleanupLog] = useState<string>('');
  const [lastScanned, setLastScanned] = useState<Date | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmFiles, setConfirmFiles] = useState<OrphanDiskFile[]>([]);

  const isNative = isNativePlatform();

  const selectedFiles = useMemo(() => {
    const set = new Set(selectedPaths);
    return orphanedFiles.filter(f => set.has(f.path));
  }, [orphanedFiles, selectedPaths]);

  const selectedTotalSize = useMemo(() => {
    return selectedFiles.reduce((sum, f) => sum + (f.size || 0), 0);
  }, [selectedFiles]);

  const orphanedTotalSize = useMemo(() => {
    return orphanedFiles.reduce((sum, f) => sum + (f.size || 0), 0);
  }, [orphanedFiles]);

  const storageUsagePercent = useMemo(() => {
    if (!debugInfo) return 0;
    const totalBytes = parseSizeToBytes(debugInfo.totalAttachmentSize);
    const maxStorage = 500 * 1024 * 1024;
    return Math.min((totalBytes / maxStorage) * 100, 100);
  }, [debugInfo]);

  const loadDebugInfo = async () => {
    setLoading(true);
    try {
      const info = await getStorageDebugInfo();
      setDebugInfo(info);

      const appData = await getData();
      const count = appData.lessons?.length || 0;
      setLessonCount(count);
      setLessonsLoaded(count > 0);

      setOrphanedFiles([]);
      setSelectedPaths([]);
      setCleanupLog('');
    } catch (error) {
      console.error('Failed to load debug info:', error);
    } finally {
      setLoading(false);
    }
  };

  const runSafeScan = async () => {
    if (!lessonsLoaded) {
      return;
    }

    setScanning(true);
    try {
      const result = await safeCleanup({ action: 'scan' });
      setCleanupLog(result.log);
      setLastScanned(new Date());

      if (result.status === 'aborted') {
        setOrphanedFiles([]);
        setSelectedPaths([]);
        return;
      }

      setOrphanedFiles(result.orphanedFiles);
      setSelectedPaths([]);
    } catch (error) {
      console.error('Safe scan failed:', error);
    } finally {
      setScanning(false);
    }
  };

  const openDeleteConfirm = (files: OrphanDiskFile[]) => {
    if (files.length === 0) {
      return;
    }
    setConfirmFiles(files);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    setConfirmOpen(false);
    setDeleting(true);

    try {
      const result = await safeCleanup({ action: 'delete', requestedFiles: confirmFiles });
      setCleanupLog(result.log);

      if (result.status === 'aborted') {
        return;
      }

      await loadDebugInfo();
    } catch (error) {
      console.error('Safe delete failed:', error);
    } finally {
      setDeleting(false);
      setConfirmFiles([]);
    }
  };

  const toggleSelected = (path: string, checked: boolean) => {
    setSelectedPaths(prev => {
      const next = new Set(prev);
      if (checked) next.add(path);
      else next.delete(path);
      return Array.from(next);
    });
  };

  const handleSelectAll = () => {
    setSelectedPaths(orphanedFiles.map(f => f.path));
  };

  const handleClearSelection = () => {
    setSelectedPaths([]);
  };

  const handleDownloadLog = async () => {
    if (!cleanupLog) {
      return;
    }

    const filename = `cleanup-log-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;

    try {
      if (isNative) {
        const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');

        await Filesystem.writeFile({
          path: filename,
          data: cleanupLog,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });

        const fileUri = await Filesystem.getUri({ path: filename, directory: Directory.Cache });

        await Share.share({
          title: 'Cleanup Log',
          text: 'Orphaned files scan/delete log',
          files: [fileUri.uri],
          dialogTitle: 'Share Cleanup Log',
        });
      } else {
        const blob = new Blob([cleanupLog], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('Failed to export cleanup log:', e);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      loadDebugInfo();
    }
  };

  const formatLastScanned = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <Bug className="w-4 h-4 mr-2" />
            Debug Storage
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-border">
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold">
              <Bug className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              Storage Debug
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Manage attachments and clean up unused files
            </p>
          </div>

          <div className="p-4 sm:p-6 overflow-auto max-h-[calc(90vh-80px)]">
            {/* Refresh Button - Always visible */}
            <Button
              variant="outline"
              size="sm"
              onClick={loadDebugInfo}
              disabled={loading || scanning || deleting}
              className="w-full mb-4"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Loading...' : 'Refresh Data'}
            </Button>

            {loading && !debugInfo ? (
              <LoadingSkeleton />
            ) : debugInfo ? (
              <div className="space-y-4">
                {/* Storage Overview with Usage Bar */}
                <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3 overflow-hidden">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Database className="w-4 h-4 text-primary" />
                    Storage Overview
                  </h3>
                  
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div className="rounded-lg bg-muted/50 p-2 sm:p-3 text-center">
                      <div className="text-xl sm:text-2xl font-bold text-foreground">{debugInfo.attachmentCount}</div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground">Files on Disk</div>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-2 sm:p-3 text-center">
                      <div className="text-xl sm:text-2xl font-bold text-foreground">{lessonCount}</div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground">Lessons</div>
                    </div>
                  </div>

                  {/* Storage Usage Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <HardDrive className="w-3.5 h-3.5" />
                        Storage Used
                      </span>
                      <span className="font-medium">{debugInfo.totalAttachmentSize}</span>
                    </div>
                    <Progress 
                      value={storageUsagePercent} 
                      className="h-2 [&>div]:bg-primary"
                    />
                  </div>

                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Preferences:</span> {debugInfo.dataSize}
                  </div>
                </div>

                {/* Cleanup Actions Card */}
                <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Search className="w-4 h-4 text-primary" />
                      Cleanup
                    </h3>
                    {lastScanned && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Scanned {formatLastScanned(lastScanned)}
                      </span>
                    )}
                  </div>
                  
                  {!lessonsLoaded && (
                    <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-500/10 rounded-lg px-3 py-2">
                      <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                      <span>No lessons loaded - scan disabled for safety</span>
                    </div>
                  )}

                  {!isNative && (
                    <div className="flex items-center gap-2 text-xs text-blue-500 bg-blue-500/10 rounded-lg px-3 py-2">
                      <Info className="w-4 h-4 flex-shrink-0" />
                      <span>File cleanup is only available on mobile devices</span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={runSafeScan}
                          disabled={scanning || deleting || !lessonsLoaded || !isNative}
                          className="flex-1"
                        >
                          <Search className={`w-4 h-4 mr-2 ${scanning ? 'animate-pulse' : ''}`} />
                          {scanning ? 'Scanning...' : 'Scan for Orphans'}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[200px] text-center">
                        <p className="text-xs">Find files on disk that are no longer linked to any lesson</p>
                      </TooltipContent>
                    </Tooltip>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadLog}
                      disabled={!cleanupLog}
                      className="flex-1"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export Log
                    </Button>
                  </div>
                </div>

                {/* All Files Card - Only show on native */}
                {isNative && debugInfo.files.length > 0 && (
                  <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3 overflow-hidden">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Folder className="w-4 h-4 text-primary" />
                      All Files ({debugInfo.files.length})
                    </h3>
                    <ScrollArea className="h-[100px] sm:h-[120px]">
                      <div className="text-xs font-mono space-y-1 pr-3">
                        {debugInfo.files.map((file, index) => (
                          <div
                            key={index}
                            className="p-2 bg-muted/30 rounded-lg flex justify-between gap-2"
                          >
                            <span className="min-w-0 flex-1 truncate">{file.name}</span>
                            {file.size != null && (
                              <span className="text-muted-foreground flex-shrink-0">{formatSize(file.size)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Orphaned Files Section */}
                {orphanedFiles.length > 0 ? (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-3 overflow-hidden">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                          <Trash2 className="w-4 h-4 text-destructive" />
                          Orphaned Files
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="w-3.5 h-3.5 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[220px]">
                              <p className="text-xs">Files on disk that aren't attached to any lesson. Safe to delete.</p>
                            </TooltipContent>
                          </Tooltip>
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {orphanedFiles.length} file{orphanedFiles.length > 1 ? 's' : ''} ({formatSize(orphanedTotalSize)})
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={handleSelectAll} className="h-7 px-2 text-xs">
                          <CheckSquare2 className="w-3.5 h-3.5 mr-1" />
                          All
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleClearSelection} className="h-7 px-2 text-xs">
                          <Square className="w-3.5 h-3.5 mr-1" />
                          None
                        </Button>
                      </div>
                    </div>

                    {/* Selected badge */}
                    {selectedFiles.length > 0 && (
                      <div className="flex items-center justify-between bg-destructive/10 rounded-lg px-3 py-2">
                        <span className="text-xs font-medium text-destructive">
                          {selectedFiles.length} selected
                        </span>
                        <span className="text-xs text-destructive">
                          {formatSize(selectedTotalSize)} to recover
                        </span>
                      </div>
                    )}

                    <ScrollArea className="h-[150px] sm:h-[200px] rounded-lg border border-border bg-background/50">
                      <div className="p-2 space-y-1">
                        {orphanedFiles.map(file => {
                          const checked = selectedPaths.includes(file.path);
                          return (
                            <label
                              key={file.path}
                              className={`flex items-center gap-2 sm:gap-3 rounded-lg px-2 sm:px-3 py-2 cursor-pointer transition-colors ${
                                checked ? 'bg-destructive/10 border border-destructive/30' : 'hover:bg-muted/50 border border-transparent'
                              }`}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => toggleSelected(file.path, Boolean(v))}
                                aria-label={`Select ${file.name}`}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs sm:text-sm font-medium text-foreground truncate">{file.name}</div>
                              </div>
                              <div className="text-[10px] sm:text-xs font-medium text-muted-foreground flex-shrink-0">
                                {formatSize(file.size)}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </ScrollArea>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => openDeleteConfirm(selectedFiles)}
                        disabled={deleting || selectedFiles.length === 0}
                        className="flex-1"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Selected ({selectedFiles.length})
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDeleteConfirm(orphanedFiles)}
                        disabled={deleting || orphanedFiles.length === 0}
                        className="flex-1 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete All
                      </Button>
                    </div>
                  </div>
                ) : lastScanned ? (
                  <div className="rounded-xl border border-dashed border-success/50 bg-success/5 p-6 text-center">
                    <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
                      <Search className="w-5 h-5 text-success" />
                    </div>
                    <h3 className="text-sm font-medium text-foreground mb-1">All Clean!</h3>
                    <p className="text-xs text-muted-foreground">
                      No orphaned files found. Your storage is optimized.
                    </p>
                  </div>
                ) : isNative ? (
                  <div className="rounded-xl border border-dashed border-border bg-muted/10 p-6 text-center">
                    <Search className="w-8 h-8 text-muted-foreground/50 mx-auto mb-3" />
                    <h3 className="text-sm font-medium text-foreground mb-1">Ready to Scan</h3>
                    <p className="text-xs text-muted-foreground max-w-[200px] mx-auto">
                      Run a scan to find files that are no longer needed.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmFiles.length} file{confirmFiles.length > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                This will permanently remove {formatSize(confirmFiles.reduce((s, f) => s + (f.size || 0), 0))} of orphaned files.
              </span>
              <span className="block text-xs text-muted-foreground">
                Files are verified as unused before deletion.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="sm:flex-1">Cancel</AlertDialogCancel>
            <Button variant="outline" size="sm" onClick={handleDownloadLog} disabled={!cleanupLog} className="sm:flex-1">
              <Download className="w-4 h-4 mr-2" />
              Export Log
            </Button>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:flex-1"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
};

export default DebugStorageDialog;
