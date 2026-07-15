import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';
import { join } from 'path';

export const UPLOADS_DIR = join(process.cwd(), 'uploads');

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const imageUploadOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES[file.mimetype]) {
      cb(null, true);
    } else {
      cb(
        new BadRequestException(
          'Only JPG, PNG, WEBP or GIF images are allowed',
        ),
        false,
      );
    }
  },
};
