export function spotifySearchUrl(title: string, artist = ''): string {
  return `https://open.spotify.com/search/${encodeURIComponent(`${title} ${artist}`.trim())}`;
}

export function spotifyArtistSearchUrl(artist: string): string {
  return spotifySearchUrl(artist);
}
