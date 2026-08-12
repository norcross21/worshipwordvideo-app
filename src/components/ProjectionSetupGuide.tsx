import { useMemo, useState } from 'react';
import { CheckCircle2, Cable, Laptop, MonitorUp, Play, X } from 'lucide-react';
import { useAccessibleDialog } from '../hooks/useAccessibleDialog';

export type ProjectionLaunchResult = 'opened' | 'placed' | 'single-screen' | 'blocked';

interface ProjectionSetupGuideProps {
  serviceTitle: string;
  songCount: number;
  onOpenProjection: () => Promise<ProjectionLaunchResult>;
  onStartService: () => void;
  onClose: () => void;
}

type GuideStep = 1 | 2 | 3;

export function ProjectionSetupGuide({
  serviceTitle,
  songCount,
  onOpenProjection,
  onStartService,
  onClose,
}: ProjectionSetupGuideProps) {
  const [step, setStep] = useState<GuideStep>(1);
  const [launchResult, setLaunchResult] = useState<ProjectionLaunchResult | null>(null);
  const [opening, setOpening] = useState(false);
  const platform = useMemo(() => /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent) ? 'mac' : 'windows', []);
  const dialogRef = useAccessibleDialog<HTMLDivElement>(onClose);

  const launch = async () => {
    setOpening(true);
    setStep(2);
    const result = await onOpenProjection();
    setLaunchResult(result);
    setOpening(false);
    setStep(result === 'blocked' ? 1 : 3);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div ref={dialogRef} tabIndex={-1} className="modal-card projection-guide" role="dialog" aria-modal="true" aria-labelledby="projection-guide-title" onClick={(event) => event.stopPropagation()}>
        <div className="projection-guide__header">
          <div>
            <span>Second-screen setup</span>
            <h3 id="projection-guide-title">Present “{serviceTitle}”</h3>
            <p>{songCount} worship video{songCount === 1 ? '' : 's'} ready</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close projection setup"><X size={20} /></button>
        </div>

        <ol className="projection-guide__steps" aria-label="Projection setup progress">
          {[1, 2, 3].map((item) => (
            <li key={item} className={step === item ? 'is-current' : step > item ? 'is-complete' : ''}>
              <span>{step > item ? <CheckCircle2 size={16} /> : item}</span>
              {item === 1 ? 'Connect' : item === 2 ? 'Launch' : 'Ready'}
            </li>
          ))}
        </ol>

        <div className="projection-guide__body">
          {step === 1 && (
            <section>
              <span className="projection-guide__large-icon"><Cable size={30} /></span>
              <h4>Connect the projector, TV or second monitor</h4>
              <p>Use HDMI, USB-C or your usual wireless display connection. Then make it an <strong>extended display</strong>, not a mirror of your dashboard.</p>
              <div className="projection-guide__platform-card">
                <Laptop size={22} />
                <div>
                  <strong>{platform === 'mac' ? 'On this Apple device' : 'On this Windows device'}</strong>
                  <span>{platform === 'mac'
                    ? 'Open System Settings → Displays. Select the church screen and choose “Use as Extended Display”.'
                    : 'Press the Windows key + P together, then choose “Extend”.'}</span>
                </div>
              </div>
              {launchResult === 'blocked' && <div className="auth-alert auth-alert--error" role="alert">Your browser blocked the clean presentation window. Allow pop-ups for worshipwordvideo.org, then try again.</div>}
              <button type="button" className="btn-primary projection-guide__primary" onClick={() => void launch()} disabled={opening}>
                <MonitorUp size={17} /> My screen is connected — open it
              </button>
            </section>
          )}

          {step === 2 && (
            <section>
              <span className="projection-guide__large-icon"><MonitorUp size={30} /></span>
              <h4>Opening the church screen…</h4>
              <p>The app is creating a separate clean presentation window and finding the other display. Chrome or Edge may ask once for permission to manage your screens.</p>
              <div className="projection-guide__waiting-confirmation"><span aria-hidden="true" /> Finding the church screen…</div>
            </section>
          )}

          {step === 3 && launchResult === 'single-screen' && (
            <section>
              <span className="projection-guide__large-icon"><Cable size={30} /></span>
              <h4>The browser can currently see only one screen</h4>
              <p>Check that the projector is connected and set to Extend rather than Mirror, then try again.</p>
              <button type="button" className="btn-primary projection-guide__primary" onClick={() => setStep(1)}>Check the display connection</button>
            </section>
          )}

          {step === 3 && launchResult !== 'single-screen' && (
            <section>
              <span className="projection-guide__large-icon is-success"><CheckCircle2 size={30} /></span>
              <h4>{launchResult === 'placed' ? 'The church screen is ready' : 'The clean presentation window is ready'}</h4>
              <p>{launchResult === 'placed'
                ? 'Look at the church screen and press its large “Full screen and start” button—or simply press Enter. Browsers require this one final confirmation.'
                : 'This browser could not place the window automatically. Move only the small clean presentation window to the church display, then press “Full screen and start”.'}</p>
              <div className="projection-guide__ready-check"><CheckCircle2 size={18} /><span>The congregation sees only the presentation. This dashboard remains private for Previous, Restart and Next.</span></div>
              <div className="projection-guide__waiting-confirmation"><span aria-hidden="true" /> Waiting for confirmation on the church screen…</div>
              <button type="button" className="btn-secondary projection-guide__primary" onClick={onStartService}>
                <Play size={17} fill="currentColor" /> Start without full screen
              </button>
              <button type="button" className="btn-link" onClick={() => setStep(2)}>Reopen the presentation window</button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
