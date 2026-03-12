/**
 * Build a short description line and vibe for an album (genre • artist • year, vibe from year).
 */
export function getVibeFromYear(releaseDate?: string | null): string {
  if (!releaseDate) return '';
  const y = new Date(releaseDate).getFullYear();
  if (Number.isNaN(y)) return '';
  if (y < 1990) return 'Classic';
  if (y < 2000) return '90s';
  if (y < 2010) return '2000s';
  if (y < 2020) return '2010s';
  return '2020s';
}

export function formatAlbumDescription(album: {
  artist?: string | null;
  release_date?: string | null;
  genre?: string | null;
}): { line: string; vibe: string } {
  const parts: string[] = [];
  if (album.genre?.trim()) parts.push(album.genre.trim());
  if (album.artist?.trim()) parts.push(album.artist.trim());
  if (album.release_date) {
    const y = new Date(album.release_date).getFullYear();
    if (Number.isFinite(y)) parts.push(String(y));
  }
  const line = parts.join(' • ');
  const vibe = getVibeFromYear(album.release_date) || (album.genre?.trim() ?? '');
  return { line, vibe };
}
