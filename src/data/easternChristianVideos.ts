import type { WorshipSong } from './worshipSongs';

/**
 * A deliberately small collection: every entry has a linked video whose title
 * explicitly identifies on-screen words. Broader Eastern indexes are not added
 * until a service-usable word video has been checked.
 */
export const EASTERN_CHRISTIAN_WORD_VIDEOS: WorshipSong[] = [
  {
    id: 'eastern-orthodox-paschal-troparion',
    title: 'Christ Is Risen from the Dead (Paschal Troparion)',
    artist: 'English Orthodox chant',
    category: 'Sung Liturgy',
    youtubeId: 'icjexnL6rI4',
    tune: 'Pascha and the Easter season',
    sourceUrl: 'https://www.oca.org/orthodoxy/the-orthodox-faith/worship/the-divine-liturgy/the-divine-liturgy',
  },
  {
    id: 'eastern-byzantine-agni-parthene',
    title: 'Agni Parthene (O Pure Virgin)',
    artist: 'Byzantine Orthodox chant',
    category: 'Sung Liturgy',
    youtubeId: 'D7AWcPv2zX4',
    tune: 'Marian devotional hymn with Greek and English words',
    sourceUrl: 'https://www.goarch.org/-/the-complete-divine-liturgy-and-related-hymns',
  },
];
