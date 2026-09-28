export const MAX_MEDIA_SIZE = 25 * 1024 * 1024;
export const MEDIA_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  txt: 'text/plain',
  zip: 'application/zip',
};
export const MEDIA_ACCEPT = Object.keys(MEDIA_TYPES)
  .map((ext) => `.${ext}`)
  .join(',');
export function validateTaskMedia(file: Pick<File, 'name' | 'size' | 'type'>) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const mime = MEDIA_TYPES[extension];
  if (!mime)
    return {
      error:
        'Formato não suportado. Use imagem, vídeo, áudio, PDF, documento ou ZIP.',
    };
  if (file.size < 1 || file.size > MAX_MEDIA_SIZE)
    return { error: 'Escolha um arquivo não vazio de até 25 MB.' };
  if (file.name.length > 255 || /[\x00-\x1f/\\]/.test(file.name))
    return { error: 'O nome do arquivo é inválido ou muito longo.' };
  return { extension, mime };
}
