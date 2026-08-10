import { BookOpenCheck, Globe2, MonitorPlay, Music2 } from 'lucide-react';

const popularLanguages = [
  ['Persian / Farsi', 'persian-farsi'],
  ['Urdu', 'urdu'],
  ['Portuguese', 'portuguese'],
  ['Spanish', 'spanish'],
  ['Arabic', 'arabic'],
  ['French', 'french'],
  ['Swahili', 'swahili'],
  ['Yoruba', 'yoruba'],
] as const;

export function SeoDiscoverySection() {
  return (
    <section className="discovery-section" aria-labelledby="discover-worship-heading">
      <div className="discovery-section__intro">
        <span>Made for local churches</span>
        <h2 id="discover-worship-heading">Worship videos people can understand and sing</h2>
        <p>
          Many English-speaking and multilingual <a href="/guides/worship-videos-for-churches-without-musicians/">churches do not have musicians every week</a> and spend hours searching YouTube for dependable worship videos with words.
          Search the catalogue and preview the exact upload without an account. Members can then build a service order, tidy its start and ending, save it for church and open a clean projection screen.
        </p>
      </div>

      <div className="discovery-section__features">
        <a href="/languages/">
          <Globe2 size={22} />
          <span><strong>Browse by language</strong><small>International vocals, words and subtitle formats</small></span>
        </a>
        <a href="/arrangements/">
          <Music2 size={22} />
          <span><strong>Browse by worship style</strong><small>Contemporary, gospel, choir, hymns and more</small></span>
        </a>
        <a href="/guides/second-screen-church-projection/">
          <MonitorPlay size={22} />
          <span><strong>Simple church projection</strong><small>Keep controls private on a second screen</small></span>
        </a>
        <a href="/guides/worship-word-lyrics/">
          <BookOpenCheck size={22} />
          <span><strong>Find worship word lyrics</strong><small>Lyric videos, hymns, subtitles and useful search tips</small></span>
        </a>
      </div>

      <nav className="discovery-section__languages" aria-label="Popular worship video languages">
        {popularLanguages.map(([label, slug]) => <a key={slug} href={`/languages/${slug}/`}>{label}</a>)}
        <a href="/languages/">All languages →</a>
      </nav>
    </section>
  );
}
