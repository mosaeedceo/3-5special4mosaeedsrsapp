import { isNativePlatform } from './platform';
import { Lesson, LessonAttachment } from '@/types/lesson';
import { getData } from '@/lib/storage';

// Delete a single file from device storage
export const deleteFileFromStorage = async (localPath: string): Promise<boolean> => {
  if (!isNativePlatform() || !localPath) return false;
  
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    
    // Extract relative path from full URI
    const attachmentsIndex = localPath.indexOf('attachments/');
    const relativePath = attachmentsIndex !== -1 
      ? localPath.substring(attachmentsIndex) 
      : localPath;
    
    await Filesystem.deleteFile({
      path: relativePath,
      directory: Directory.Data,
    });
    
    console.log('[fileCleanup] Deleted file:', relativePath);
    return true;
  } catch (error) {
    console.error('[fileCleanup] Error deleting file:', error);
    return false;
  }
};

// Delete all attachments for a lesson
export const deleteLessonAttachments = async (lesson: Lesson): Promise<void> => {
  if (!lesson.attachments || lesson.attachments.length === 0) return;
  
  for (const attachment of lesson.attachments) {
    if (attachment.localPath) {
      await deleteFileFromStorage(attachment.localPath);
    }
  }
  
  console.log(`[fileCleanup] Deleted ${lesson.attachments.length} attachments for lesson:`, lesson.id);
};

// Delete a single attachment file
export const deleteAttachmentFile = async (attachment: LessonAttachment): Promise<void> => {
  if (attachment.localPath) {
    await deleteFileFromStorage(attachment.localPath);
  }
};

/**
 * STRICT filename extraction - only gets the base filename
 * Examples:
 *   'file:///data/user/0/.../attachments/study_note.pdf' -> 'study_note.pdf'
 *   'attachments/image123.jpg' -> 'image123.jpg'
 *   '/some/path/to/file.aac' -> 'file.aac'
 */
export const extractFilename = (path: string): string => {
  if (!path) return '';
  
  // Remove any query strings or fragments
  let cleaned = path.split('?')[0].split('#')[0];
  
  // Remove file:// prefix if present
  cleaned = cleaned.replace(/^file:\/\//, '');
  
  // Get the last segment after any slash
  const segments = cleaned.split('/');
  const filename = segments[segments.length - 1];
  
  return filename || '';
};

/**
 * Get ALL filenames referenced in lessons (strict filename-only extraction)
 * Returns a Set of just filenames like: {'study_note.pdf', 'image123.jpg'}
 */
export const getReferencedFilenames = (lessons: Lesson[]): Set<string> => {
  const filenames = new Set<string>();
  
  if (!lessons || !Array.isArray(lessons) || lessons.length === 0) {
    console.log('[fileCleanup] SAFETY: No lessons provided - returning empty set');
    return filenames;
  }
  
  console.log('[fileCleanup] Extracting filenames from', lessons.length, 'lessons');
  
  for (const lesson of lessons) {
    if (lesson.attachments && Array.isArray(lesson.attachments)) {
      for (const attachment of lesson.attachments) {
        if (attachment.localPath) {
          const filename = extractFilename(attachment.localPath);
          if (filename) {
            filenames.add(filename);
            console.log('[fileCleanup] Found in DB:', filename, '<- from:', attachment.localPath);
          }
        }
      }
    }
  }
  
  console.log('[fileCleanup] Total referenced filenames:', filenames.size);
  return filenames;
};

// Legacy function for backward compatibility
export const getReferencedFilePaths = (lessons: Lesson[]): Set<string> => {
  return getReferencedFilenames(lessons);
};

// Legacy alias
export const normalizeFilePath = extractFilename;

/**
 * STRICT orphan detection - filename-only comparison
 * NEVER runs automatically - only called manually
 */
export const findOrphanedFiles = async (lessons: Lesson[]): Promise<{ path: string; name: string }[]> => {
  if (!isNativePlatform()) {
    console.log('[fileCleanup] Not native platform - skipping');
    return [];
  }
  
  // ==================== STRICT SAFETY CHECKS ====================
  
  // Check 1: Lessons must be a valid array
  if (!lessons || !Array.isArray(lessons)) {
    console.log('[fileCleanup] ❌ SAFETY ABORT: lessons is not a valid array');
    return [];
  }
  
  // Check 2: Lessons must NOT be empty (data must be loaded)
  if (lessons.length === 0) {
    console.log('[fileCleanup] ❌ SAFETY ABORT: lessons array is EMPTY - data not loaded yet');
    return [];
  }
  
  console.log('[fileCleanup] ✓ Safety checks passed:', lessons.length, 'lessons loaded');
  console.log('[fileCleanup] ========== STARTING STRICT ORPHAN SCAN ==========');
  
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    
    // Step 1: Get all files on disk
    let filesOnDisk: { name: string; path: string }[] = [];
    try {
      const result = await Filesystem.readdir({
        path: 'attachments',
        directory: Directory.Data,
      });
      filesOnDisk = result.files.map(f => ({
        name: f.name,
        path: `attachments/${f.name}`
      }));
    } catch (error) {
      console.log('[fileCleanup] Attachments directory not found - nothing to clean');
      return [];
    }
    
    console.log('[fileCleanup] Files on disk:', filesOnDisk.length);
    filesOnDisk.forEach(f => console.log('[fileCleanup] DISK:', f.name));
    
    // Step 2: Get ALL filenames from database (strict extraction)
    const dbFilenames = getReferencedFilenames(lessons);
    
    console.log('[fileCleanup] Filenames in database:', dbFilenames.size);
    dbFilenames.forEach(fn => console.log('[fileCleanup] DB:', fn));
    
    // Step 3: Extra safety - if disk has files but DB shows zero, abort
    if (filesOnDisk.length > 0 && dbFilenames.size === 0) {
      // Check if any lesson has attachments
      const totalAttachmentCount = lessons.reduce((sum, lesson) => {
        return sum + (lesson.attachments?.length || 0);
      }, 0);
      
      if (totalAttachmentCount > 0) {
        console.log('[fileCleanup] ❌ SAFETY ABORT: DB has', totalAttachmentCount, 
          'attachments but extracted 0 filenames - something is wrong');
        return [];
      }
      console.log('[fileCleanup] ✓ DB genuinely has no attachments');
    }
    
    // Step 4: Compare using STRICT FILENAME-ONLY matching
    const orphanedFiles: { path: string; name: string }[] = [];
    
    console.log('[fileCleanup] ========== COMPARING (filename only) ==========');
    
    for (const diskFile of filesOnDisk) {
      const filenameToCheck = diskFile.name;
      const isInDatabase = dbFilenames.has(filenameToCheck);
      
      if (isInDatabase) {
        console.log('[fileCleanup] ✓ KEEP:', filenameToCheck, '- EXISTS in database');
      } else {
        console.log('[fileCleanup] ✗ ORPHAN:', filenameToCheck, '- NOT FOUND in database');
        console.log('[fileCleanup]   Searched for exact filename:', filenameToCheck);
        console.log('[fileCleanup]   In set of', dbFilenames.size, 'database filenames');
        orphanedFiles.push(diskFile);
      }
    }
    
    console.log('[fileCleanup] ========== SCAN COMPLETE ==========');
    console.log('[fileCleanup] Result:', orphanedFiles.length, 'orphaned files found');
    console.log('[fileCleanup] Files to KEEP:', filesOnDisk.length - orphanedFiles.length);
    
    return orphanedFiles;
  } catch (error) {
    console.error('[fileCleanup] Error during scan:', error);
    return [];
  }
};

/**
 * Delete orphaned files - MANUAL ONLY
 * Only deletes files explicitly passed in after user confirmation
 */
export const cleanupOrphanedFiles = async (
  lessons: Lesson[],
  filesToDelete: { path: string; name: string }[]
): Promise<{
  deleted: number;
  errors: number;
  freedSpace: number;
}> => {
  if (!isNativePlatform()) {
    return { deleted: 0, errors: 0, freedSpace: 0 };
  }
  
  // FINAL SAFETY CHECK
  if (!lessons || !Array.isArray(lessons) || lessons.length === 0) {
    console.log('[fileCleanup] ❌ CLEANUP ABORT: lessons not loaded');
    return { deleted: 0, errors: 0, freedSpace: 0 };
  }
  
  if (!filesToDelete || filesToDelete.length === 0) {
    console.log('[fileCleanup] Nothing to delete');
    return { deleted: 0, errors: 0, freedSpace: 0 };
  }
  
  console.log('[fileCleanup] ========== DELETING', filesToDelete.length, 'FILES ==========');
  
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    
    let deleted = 0;
    let errors = 0;
    let freedSpace = 0;
    
    for (const file of filesToDelete) {
      try {
        // Get file size before deletion
        try {
          const stat = await Filesystem.stat({
            path: file.path,
            directory: Directory.Data,
          });
          freedSpace += stat.size || 0;
        } catch {
          // Continue even if we can't get size
        }
        
        await Filesystem.deleteFile({
          path: file.path,
          directory: Directory.Data,
        });
        deleted++;
        console.log('[fileCleanup] ✓ DELETED:', file.name);
      } catch (error) {
        errors++;
        console.error('[fileCleanup] ✗ ERROR deleting:', file.name, error);
      }
    }
    
    console.log('[fileCleanup] ========== CLEANUP COMPLETE ==========');
    console.log('[fileCleanup] Deleted:', deleted, '| Errors:', errors, '| Freed:', freedSpace, 'bytes');
    
    return { deleted, errors, freedSpace };
  } catch (error) {
    console.error('[fileCleanup] Cleanup error:', error);
    return { deleted: 0, errors: 0, freedSpace: 0 };
  }
};

export type SafeCleanupAction = 'scan' | 'delete';

export interface OrphanDiskFile {
  name: string;
  path: string;
  size?: number;
}

export interface SafeCleanupResult {
  status: 'aborted' | 'scanned' | 'deleted';
  reason?: 'NOT_NATIVE' | 'LESSONS_EMPTY' | 'NO_ATTACHMENTS_DIR' | 'ERROR';
  lessonsCount: number;
  whitelistCount: number;
  diskFileCount: number;
  orphanedFiles: OrphanDiskFile[];
  deleted?: number;
  errors?: number;
  freedSpace?: number;
  log: string;
}

const createCleanupLogger = () => {
  const lines: string[] = [];
  const push = (line: string) => {
    const ts = new Date().toISOString();
    lines.push(`[${ts}] ${line}`);
  };
  return { push, toString: () => lines.join('\n') };
};

const buildWhitelistFromLessons = (lessons: Lesson[], log: (line: string) => void): Set<string> => {
  const whitelist = new Set<string>();

  for (const lesson of lessons) {
    for (const att of lesson.attachments || []) {
      if (!att.localPath) continue;
      const filename = extractFilename(att.localPath);
      if (!filename) continue;
      whitelist.add(filename);
      log(`WHITELIST + ${filename} <- ${att.localPath}`);
    }
  }

  return whitelist;
};

const readAttachmentsDirectory = async (log: (line: string) => void): Promise<OrphanDiskFile[] | null> => {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');

  try {
    const result = await Filesystem.readdir({
      path: 'attachments',
      directory: Directory.Data,
    });

    const files: OrphanDiskFile[] = result.files.map(f => ({
      name: f.name,
      path: `attachments/${f.name}`,
      size: f.size,
    }));

    log(`DISK: found ${files.length} files in Directory.Data/attachments/`);
    return files;
  } catch {
    log('DISK: attachments directory not found (or unreadable).');
    return null;
  }
};

/**
 * Emergency-safe orphan workflow.
 * - Loads lessons fresh from Preferences/localStorage
 * - Refuses to run if lessons.length === 0
 * - Compares ONLY filenames (disk vs localPath-derived whitelist)
 * - Never runs automatically (must be called manually)
 */
export const safeCleanup = async (params?: {
  action?: SafeCleanupAction;
  requestedFiles?: OrphanDiskFile[];
}): Promise<SafeCleanupResult> => {
  const action: SafeCleanupAction = params?.action ?? 'scan';

  if (!isNativePlatform()) {
    return {
      status: 'aborted',
      reason: 'NOT_NATIVE',
      lessonsCount: 0,
      whitelistCount: 0,
      diskFileCount: 0,
      orphanedFiles: [],
      log: '[safeCleanup] Not native platform; filesystem unavailable.',
    };
  }

  const logger = createCleanupLogger();
  logger.push(`[safeCleanup] START action=${action}`);

  try {
    const data = await getData();
    const lessons = Array.isArray(data.lessons) ? data.lessons : [];

    logger.push(`Loaded lessons from Preferences: count=${lessons.length}`);

    // HARD SAFETY: never run when lessons are empty
    if (lessons.length === 0) {
      logger.push('SAFETY ABORT: lessons.length === 0 (possible load failure).');
      return {
        status: 'aborted',
        reason: 'LESSONS_EMPTY',
        lessonsCount: 0,
        whitelistCount: 0,
        diskFileCount: 0,
        orphanedFiles: [],
        log: logger.toString(),
      };
    }

    const diskFiles = await readAttachmentsDirectory(logger.push);
    if (!diskFiles) {
      return {
        status: action === 'delete' ? 'deleted' : 'scanned',
        reason: 'NO_ATTACHMENTS_DIR',
        lessonsCount: lessons.length,
        whitelistCount: 0,
        diskFileCount: 0,
        orphanedFiles: [],
        deleted: 0,
        errors: 0,
        freedSpace: 0,
        log: logger.toString(),
      };
    }

    const whitelist = buildWhitelistFromLessons(lessons, logger.push);
    logger.push(`Whitelist size=${whitelist.size}`);

    const orphaned = diskFiles.filter(f => {
      const isWhitelisted = whitelist.has(f.name);
      logger.push(`${isWhitelisted ? 'KEEP' : 'ORPHAN'}: ${f.name}`);
      return !isWhitelisted;
    });

    logger.push(`SCAN RESULT: orphaned=${orphaned.length}, keep=${diskFiles.length - orphaned.length}`);

    if (action === 'scan') {
      return {
        status: 'scanned',
        lessonsCount: lessons.length,
        whitelistCount: whitelist.size,
        diskFileCount: diskFiles.length,
        orphanedFiles: orphaned,
        log: logger.toString(),
      };
    }

    // action === 'delete'
    const requested = params?.requestedFiles ?? [];
    if (requested.length === 0) {
      logger.push('DELETE: no requestedFiles provided; nothing to do.');
      return {
        status: 'deleted',
        lessonsCount: lessons.length,
        whitelistCount: whitelist.size,
        diskFileCount: diskFiles.length,
        orphanedFiles: orphaned,
        deleted: 0,
        errors: 0,
        freedSpace: 0,
        log: logger.toString(),
      };
    }

    const orphanedNames = new Set(orphaned.map(o => o.name));
    const toDelete = requested.filter(r => orphanedNames.has(r.name));

    logger.push(`DELETE REQUEST: requested=${requested.length}, eligible_orphaned=${toDelete.length}`);

    const { Filesystem, Directory } = await import('@capacitor/filesystem');

    let deleted = 0;
    let errors = 0;
    let freedSpace = 0;

    for (const file of toDelete) {
      try {
        try {
          const stat = await Filesystem.stat({ path: file.path, directory: Directory.Data });
          freedSpace += stat.size || 0;
        } catch {
          // ignore
        }

        await Filesystem.deleteFile({ path: file.path, directory: Directory.Data });
        deleted++;
        logger.push(`DELETED: ${file.name} (${file.path})`);
      } catch (e) {
        errors++;
        logger.push(`ERROR deleting: ${file.name} (${file.path}) :: ${String(e)}`);
      }
    }

    for (const file of requested) {
      if (!orphanedNames.has(file.name)) {
        logger.push(`SKIP (no longer orphaned): ${file.name}`);
      }
    }

    logger.push(`DELETE COMPLETE: deleted=${deleted}, errors=${errors}, freedSpaceBytes=${freedSpace}`);

    return {
      status: 'deleted',
      lessonsCount: lessons.length,
      whitelistCount: whitelist.size,
      diskFileCount: diskFiles.length,
      orphanedFiles: orphaned,
      deleted,
      errors,
      freedSpace,
      log: logger.toString(),
    };
  } catch (e) {
    logger.push(`FATAL ERROR: ${String(e)}`);
    return {
      status: 'aborted',
      reason: 'ERROR',
      lessonsCount: 0,
      whitelistCount: 0,
      diskFileCount: 0,
      orphanedFiles: [],
      log: logger.toString(),
    };
  }
};
