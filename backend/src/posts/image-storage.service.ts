import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UploadApiResponse } from 'cloudinary';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { ALLOWED_IMAGE_TYPES, UPLOADS_DIR } from './upload.config';

@Injectable()
export class ImageStorageService {
  private readonly logger = new Logger(ImageStorageService.name);
  private readonly useCloudinary: boolean;

  constructor(config: ConfigService) {
    const url = config.get<string>('CLOUDINARY_URL');
    this.useCloudinary = Boolean(url);

    if (url) {
      const parsed = new URL(url);
      cloudinary.config({
        cloud_name: parsed.hostname,
        api_key: decodeURIComponent(parsed.username),
        api_secret: decodeURIComponent(parsed.password),
        secure: true,
      });
      this.logger.log(`Post images: Cloudinary (${parsed.hostname})`);
    } else {
      this.logger.log(`Post images: local disk (${UPLOADS_DIR})`);
    }
  }

  async store(file: Express.Multer.File): Promise<string> {
    return this.useCloudinary
      ? this.storeInCloudinary(file)
      : this.storeOnDisk(file);
  }

  private async storeInCloudinary(file: Express.Multer.File): Promise<string> {
    try {
      const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'buddyscript', resource_type: 'image' },
          (error, response) => {
            if (error || !response) {
              reject(new Error(error?.message ?? 'Empty Cloudinary response'));
            } else {
              resolve(response);
            }
          },
        );
        stream.end(file.buffer);
      });
      return result.secure_url;
    } catch (error) {
      this.logger.error('Cloudinary upload failed', error);
      throw new InternalServerErrorException('Image upload failed');
    }
  }

  private async storeOnDisk(file: Express.Multer.File): Promise<string> {
    const filename = `${randomUUID()}.${ALLOWED_IMAGE_TYPES[file.mimetype]}`;
    mkdirSync(UPLOADS_DIR, { recursive: true });
    await writeFile(join(UPLOADS_DIR, filename), file.buffer);
    return `/uploads/${filename}`;
  }
}
