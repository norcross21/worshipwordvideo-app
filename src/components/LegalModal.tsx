import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, FileText, Heart, LockKeyhole, Scale, ShieldAlert, X } from 'lucide-react';
import { useAccessibleDialog } from '../hooks/useAccessibleDialog';
import { PUBLIC_CONTACT_EMAIL } from '../data/contact';

export type LegalSection = 'terms' | 'copyright' | 'privacy' | 'charity';

interface LegalModalProps {
  initialSection?: LegalSection;
  onClose: () => void;
}

const APP_CONTACT = PUBLIC_CONTACT_EMAIL;

export function LegalModal({ initialSection = 'terms', onClose }: LegalModalProps) {
  const [section, setSection] = useState<LegalSection>(initialSection);
  const dialogRef = useAccessibleDialog<HTMLDivElement>(onClose);

  return createPortal(
    <div className="modal-backdrop legal-backdrop" onClick={onClose}>
      <div ref={dialogRef} tabIndex={-1} className="modal-card legal-modal" role="dialog" aria-modal="true" aria-labelledby="legal-title" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header legal-modal__header">
          <div><span className="eyebrow"><Scale size={14} /> Legal & safety</span><h2 id="legal-title">Terms, privacy and copyright</h2><p>Effective 8 August 2026 · Last reviewed 7 September 2026</p></div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close legal and safety information"><X size={19} /></button>
        </div>

        <nav className="legal-tabs" aria-label="Legal information sections">
          <button type="button" className={section === 'terms' ? 'is-active' : ''} onClick={() => setSection('terms')}><FileText size={15} /> Terms</button>
          <button type="button" className={section === 'copyright' ? 'is-active' : ''} onClick={() => setSection('copyright')}><ShieldAlert size={15} /> Copyright</button>
          <button type="button" className={section === 'privacy' ? 'is-active' : ''} onClick={() => setSection('privacy')}><LockKeyhole size={15} /> Privacy</button>
          <button type="button" className={section === 'charity' ? 'is-active' : ''} onClick={() => setSection('charity')}><Heart size={15} /> Charity</button>
        </nav>

        <div className="legal-modal__body">
          {section === 'terms' && <TermsSection />}
          {section === 'copyright' && <CopyrightSection />}
          {section === 'privacy' && <PrivacySection />}
          {section === 'charity' && <CharitySection />}
        </div>

        <div className="legal-modal__footer">
          <p>Questions or content concerns: <a href={`mailto:${APP_CONTACT}`}>{APP_CONTACT}</a></p>
          <button type="button" className="btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function TermsSection() {
  return <article className="legal-copy">
    <h3>Terms of use</h3>
    <p><strong>Worship Word Video</strong> is a directory, preview and playlist-planning tool provided without charge. It helps users find third-party YouTube videos; it is not a music publisher, lyrics provider, streaming licence or substitute for professional advice.</p>
    <h4>Agreement and eligibility</h4>
    <p>By using the service, you agree to these terms. Anyone under 18 should use the service with a parent, guardian or responsible church leader.</p>
    <h4>Lawful use</h4>
    <ul>
      <li>Use the service only for lawful purposes and without infringing another person's rights.</li>
      <li>Only add YouTube links and metadata you reasonably believe may lawfully be shared and embedded.</li>
      <li>Do not upload or paste copyrighted lyrics, recordings, harmful material, malware, personal data belonging to others, or misleading information.</li>
      <li>Do not attempt to bypass YouTube restrictions or the site's security and safety controls.</li>
    </ul>
    <h4>Your entries and playlists</h4>
    <p>You remain responsible for custom links, titles and playlists you add. You confirm that your contributions are accurate and lawful. We may correct or remove catalogue links or preserve evidence where reasonably necessary to address infringement, misuse, security or legal obligations.</p>
    <h4>Third-party services</h4>
    <p>YouTube, Supabase, Vercel and donation providers operate under their own terms and privacy notices. Their services can change, display advertising, restrict embedding or become unavailable. A link does not mean Worship Word Video endorses the uploader or owns the material.</p>
    <h4>Availability and liability</h4>
    <p>The service is provided “as available”. We do not promise uninterrupted access, permanent storage, complete or error-free metadata, video availability, lyrical accuracy, suitability for a particular service, or that use satisfies a church's licensing duties. Keep a separate copy of important service plans.</p>
    <p>Arrangement, vocal-language and subtitle labels are based on the uploader's public wording and conservative catalogue inference; they are not a linguistic or theological endorsement. Preview every exact video before a public service. Start and stop points use YouTube's supported player timing and may begin near the closest video keyframe rather than on an exact frame.</p>
    <p>To the fullest extent permitted by law, we are not responsible for indirect or consequential loss arising from reliance on third-party videos, unavailable links or loss of locally stored data. Nothing in these terms excludes liability that cannot lawfully be excluded, including liability for death or personal injury caused by negligence, fraud, or applicable consumer rights.</p>
    <h4>Changes and governing law</h4>
    <p>We may update the catalogue, service and these terms. Material changes will be dated here. These terms are governed by the law of England and Wales, subject to any mandatory rights you have where you live.</p>
  </article>;
}

function CopyrightSection() {
  return <article className="legal-copy">
    <h3>Copyright and church licensing</h3>
    <div className="legal-warning"><ShieldAlert size={18} /><p><strong>Using this app does not grant permission to copy lyrics, perform music publicly, project words, record worship or livestream a service.</strong></p></div>
    <p>Music, lyrics, recordings and videos can have separate owners and licences. Being a church, charity or free service does not automatically remove copyright obligations. Each church or user must decide what permissions are needed for its own use, including any CCLI, PPL PRS, publisher, performer or platform permissions and reporting.</p>
    <p>Worship Word Video stores identifiers and catalogue metadata and uses YouTube's official embedded player. It does not download or re-host YouTube media and does not claim ownership of third-party songs, lyrics, recordings, thumbnails or videos. Uploaders and rights holders may restrict or disable embedding.</p>
    <h4>Reporting copyrighted or unsuitable material</h4>
    <p>Rights holders and users can email <a href={`mailto:${APP_CONTACT}?subject=Worship%20Word%20Video%20content%20report`}>{APP_CONTACT}</a>. Please include:</p>
    <ul>
      <li>your name and contact details;</li>
      <li>the work or right concerned and your authority to report it;</li>
      <li>the exact Worship Word Video entry and YouTube URL or video ID;</li>
      <li>why you believe the link or metadata is unlawful, inaccurate or unsafe; and</li>
      <li>a good-faith statement that the information supplied is accurate.</li>
    </ul>
    <p>We may temporarily hide a disputed catalogue entry while reviewing it, correct metadata, direct the matter to YouTube, or remove the entry. Removal from this directory does not remove a video from YouTube.</p>
    <div className="legal-links">
      <a href="https://www.gov.uk/using-somebody-elses-intellectual-property/copyright" target="_blank" rel="noreferrer">UK copyright guidance <ExternalLink size={12} /></a>
      <a href="https://ccli.com/uk/en/streaming" target="_blank" rel="noreferrer">CCLI UK streaming guidance <ExternalLink size={12} /></a>
      <a href="https://support.google.com/youtube/answer/171780?hl=en-GB" target="_blank" rel="noreferrer">YouTube embedding guidance <ExternalLink size={12} /></a>
    </div>
  </article>;
}

function PrivacySection() {
  return <article className="legal-copy">
    <h3>Privacy and cookies information</h3>
    <p>Worship Word Video is responsible for deciding how information collected by the service is used. The service contact is <a href={`mailto:${APP_CONTACT}`}>{APP_CONTACT}</a>.</p>
    <h4>Information used</h4>
    <ul>
      <li><strong>Saved service plans on your device:</strong> playlist names, optional service date and notes, selected video metadata, playback start/stop points, current queue, display choices and update dates may be stored in browser storage.</li>
      <li><strong>Anonymous usage totals:</strong> page visits and broad actions such as searches, video previews, playlist additions and projection launches. These events use a random page-lifetime identifier and do not include account identifiers, search words, video IDs or playlist names. They are used only as aggregate service-improvement metrics and expire after 13 months.</li>
      <li><strong>Security and delivery:</strong> Supabase and Vercel may process technical logs such as IP address, device/browser details, request times and errors.</li>
      <li><strong>YouTube:</strong> opening a song page loads its embedded player and sends technical information to Google/YouTube. Privacy-enhanced mode reduces personalisation but does not prevent every third-party request or cookie.</li>
    </ul>
    <h4>Why and lawful basis</h4>
    <p>Browser storage is used so the planner works without an account. Security, fault diagnosis, abuse prevention and anonymous aggregate usage measurement are carried out for legitimate operational interests, balanced against user rights.</p>
    <h4>Storage, sharing and transfers</h4>
    <p>Vercel hosts the application; Supabase stores anonymous aggregate events; YouTube provides video playback; and Kairos Housing's external donation system processes donations. These providers may process technical information outside the UK under their own safeguards and notices. Service plans stay in browser storage on your device.</p>
    <h4>Retention and your rights</h4>
    <p>Browser data remains until you clear it. Anonymous usage events expire after 13 months. The public app no longer offers account registration or cloud playlists; any legacy account record is not used by the public planner and can be deleted on request. You may ask to access, correct or delete information about you, restrict or object to processing, or complain to the UK Information Commissioner's Office.</p>
    <p>Email <a href={`mailto:${APP_CONTACT}?subject=Worship%20Word%20Video%20privacy%20request`}>{APP_CONTACT}</a> for a privacy or legacy-account request. Identity may need to be verified before personal information is disclosed or deleted.</p>
    <div className="legal-links">
      <a href="https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-be-informed/" target="_blank" rel="noreferrer">ICO privacy guidance <ExternalLink size={12} /></a>
      <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google privacy notice <ExternalLink size={12} /></a>
      <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer">Supabase privacy notice <ExternalLink size={12} /></a>
      <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noreferrer">Vercel privacy notice <ExternalLink size={12} /></a>
    </div>
  </article>;
}

function CharitySection() {
  return <article className="legal-copy">
    <h3>Charity donation statement</h3>
    <p>Worship Word Video is provided without charge. Donations are entirely optional and do not unlock features or improve search placement.</p>
    <p>The donation link goes to <strong>Kairos Housing, registered charity 1198820</strong>, using its internal donation page at <strong>operations.kairoshousing.org.uk/donate</strong>. Worship Word Video does not collect card or bank details and does not process the payment; the donation system's terms, privacy practices, fees and Gift Aid arrangements apply.</p>
    <p>The app does not open an automatic donation prompt. A single, quiet link in the footer lets people choose whether to learn about supporting Kairos Housing.</p>
    <p>Kairos Housing being the donation beneficiary does not, by itself, mean that Kairos Housing owns, publishes, endorses or accepts responsibility for every catalogue entry or third-party video in this app.</p>
    <p>Before donating, check that the destination page names Kairos Housing and uses the expected secure address. Kairos Housing’s work is guided by the commitment <strong>Rebuilding lives with dignity</strong>. Donation questions should be directed through the charity's official website.</p>
    <div className="legal-links">
      <a href="https://operations.kairoshousing.org.uk/donate" target="_blank" rel="noreferrer">Kairos Housing donation page <ExternalLink size={12} /></a>
      <a href="https://www.kairoshousing.org.uk/contact-us.html" target="_blank" rel="noreferrer">Kairos Housing contact page <ExternalLink size={12} /></a>
      <a href="https://register-of-charities.charitycommission.gov.uk/charity-search/-/charity-details/5192665" target="_blank" rel="noreferrer">Charity Commission register <ExternalLink size={12} /></a>
      <a href="https://www.gov.uk/guidance/raising-money-for-charity-public-guidance" target="_blank" rel="noreferrer">Charity fundraising guidance <ExternalLink size={12} /></a>
    </div>
  </article>;
}
