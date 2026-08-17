import { useMemo, useState } from 'react';
import { CheckCircle2, Laptop, MonitorUp, X } from 'lucide-react';
import { useAccessibleDialog } from '../hooks/useAccessibleDialog';
import type { ProjectionLaunchResult } from '../data/projection';

interface ProjectionSetupGuideProps {
  serviceTitle: string;
  songCount: number;
  onOpenProjection: () => Promise<ProjectionLaunchResult>;
  onClose: () => void;
}

export function ProjectionSetupGuide({
  serviceTitle,
  songCount,
  onOpenProjection,
  onClose,
}: ProjectionSetupGuideProps) {
  const [launchResult, setLaunchResult] = useState<ProjectionLaunchResult | null>(null);
  const [opening, setOpening] = useState(false);
  const platform = useMemo(() => /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent) ? 'mac' : 'windows', []);
  const dialogRef = useAccessibleDialog<HTMLDivElement>(onClose);

  const launch = async () => {
    setOpening(true);
    setLaunchResult(null);
    const result = await onOpenProjection();
    setLaunchResult(result);
    setOpening(false);
  };

  const isOpen = launchResult === 'fullscreen' || launchResult === 'opened' || launchResult === 'placed';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div ref={dialogRef} tabIndex={-1} className="modal-card projection-guide" role="dialog" aria-modal="true" aria-labelledby="projection-guide-title" onClick={(event) => event.stopPropagation()}>
        <div className="projection-guide__header">
          <div>
            <span>Church screen</span>
            <h3 id="projection-guide-title">Present “{serviceTitle}”</h3>
            <p>{songCount} worship video{songCount === 1 ? '' : 's'} ready</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close projection setup"><X size={20} /></button>
        </div>

        <div className="projection-guide__body">
          <section>
            <span className={`projection-guide__large-icon ${launchResult === 'fullscreen' || launchResult === 'placed' ? 'is-success' : ''}`}><MonitorUp size={30} /></span>
            <h4>{opening
              ? 'Finding the church screen…'
              : launchResult === 'fullscreen'
                ? 'Full screen is live'
                : launchResult === 'placed'
                  ? 'Church screen connected'
                : isOpen
                  ? 'Clean screen opened'
                  : launchResult === 'single-screen'
                    ? 'A second display was not detected'
                    : 'Open the church screen'}</h4>

            {!launchResult && !opening && (
              <>
                <p>Connect the projector, TV or second monitor and set it to <strong>Extend</strong>. One click opens a clean presentation window and Chrome places it on the other display after window-management permission is granted.</p>
                <div className="projection-guide__platform-card">
                  <Laptop size={22} />
                  <div>
                    <strong>{platform === 'mac' ? 'Apple display check' : 'Windows display check'}</strong>
                    <span>{platform === 'mac'
                      ? 'System Settings → Displays → Use as Extended Display.'
                      : 'Press Windows + P, then choose Extend.'}</span>
                  </div>
                </div>
              </>
            )}

            {opening && (
              <>
                <p>Your browser may ask once for permission to manage windows across displays. Choose Allow so the app can move the clean window for you.</p>
                <div className="projection-guide__waiting-confirmation"><span aria-hidden="true" /> Opening and linking the screen…</div>
              </>
            )}

            {launchResult === 'placed' && (
              <>
                <p>The clean window now fills the other display. The first video starts there automatically and every choice on this controller stays linked.</p>
                <div className="projection-guide__ready-check"><CheckCircle2 size={18} /><span>The congregation sees only the video. Keep this dashboard on your main screen for Previous, Restart and Next.</span></div>
              </>
            )}

            {launchResult === 'fullscreen' && (
              <>
                <p>The worship video is now full screen on the selected display. Your dashboard and private controls stay here.</p>
                <div className="projection-guide__ready-check"><CheckCircle2 size={18} /><span>Next, Previous and Restart update the congregation screen immediately.</span></div>
              </>
            )}

            {launchResult === 'opened' && (
              <>
                <p>The clean window is linked, but Chrome did not provide automatic display access. Use the site controls beside the address bar to allow pop-ups and window management for worshipwordvideo.org, then choose Reopen screen on the controller.</p>
                <div className="projection-guide__platform-card">
                  <Laptop size={22} />
                  <div>
                    <strong>Immediate fallback without dragging</strong>
                    <span>{platform === 'mac'
                      ? 'On the clean window, use the Window menu and choose Move to your projector or display.'
                      : 'With the clean window active, press Windows + Shift + Left or Right Arrow.'}</span>
                  </div>
                </div>
              </>
            )}

            {launchResult === 'single-screen' && <p>Check the cable or wireless display and make sure the computer is using Extend rather than Mirror, then try again.</p>}
            {launchResult === 'blocked' && <div className="auth-alert auth-alert--error" role="alert">Your browser blocked the clean window. Allow pop-ups for worshipwordvideo.org, then try again.</div>}

            {!isOpen && !opening && (
              <button type="button" className="btn-primary projection-guide__primary" onClick={() => void launch()}>
                <MonitorUp size={17} /> {launchResult ? 'Try opening again' : 'Open automatically on church screen'}
              </button>
            )}
            {isOpen && <button type="button" className="btn-secondary projection-guide__primary" onClick={onClose}>Return to controller</button>}
          </section>
        </div>
      </div>
    </div>
  );
}
