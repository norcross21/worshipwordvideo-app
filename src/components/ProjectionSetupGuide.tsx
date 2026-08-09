import { useMemo, useState } from 'react';
import { CheckCircle2, Cable, Laptop, MonitorUp, Play, X } from 'lucide-react';

export type ProjectionLaunchResult = 'opened' | 'placed' | 'blocked';

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

  const launch = async () => {
    setOpening(true);
    const result = await onOpenProjection();
    setLaunchResult(result);
    setOpening(false);
    if (result !== 'blocked') setStep(3);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card projection-guide" role="dialog" aria-modal="true" aria-labelledby="projection-guide-title" onClick={(event) => event.stopPropagation()}>
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
              {item === 1 ? 'Connect' : item === 2 ? 'Open' : 'Present'}
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
              <button type="button" className="btn-primary projection-guide__primary" onClick={() => setStep(2)}>My second screen is extended</button>
            </section>
          )}

          {step === 2 && (
            <section>
              <span className="projection-guide__large-icon"><MonitorUp size={30} /></span>
              <h4>Open the clean projection window</h4>
              <p>The new window contains only the worship video. Your service controls stay private on this screen.</p>
              {launchResult === 'blocked' && <div className="auth-alert auth-alert--error" role="alert">Your browser blocked the new window. Allow pop-ups for worshipwordvideo.org, then press the button again.</div>}
              <button type="button" className="btn-primary projection-guide__primary" onClick={() => void launch()} disabled={opening}>
                <MonitorUp size={17} /> {opening ? 'Opening projection…' : 'Open projection window'}
              </button>
            </section>
          )}

          {step === 3 && (
            <section>
              <span className="projection-guide__large-icon is-success"><CheckCircle2 size={30} /></span>
              <h4>{launchResult === 'placed' ? 'Projection placed on the second screen' : 'Projection window is open'}</h4>
              <p>{launchResult === 'placed'
                ? 'On the church screen, press the large Full screen button. Then return here to start the first video.'
                : 'Drag the projection window onto the church screen, press its large Full screen button, then return here.'}</p>
              <div className="projection-guide__ready-check"><CheckCircle2 size={18} /><span>Your dashboard remains on this screen and the congregation sees only the video.</span></div>
              <button type="button" className="btn-primary projection-guide__primary" onClick={onStartService}>
                <Play size={17} fill="currentColor" /> Start the first video
              </button>
              <button type="button" className="btn-link" onClick={() => setStep(2)}>Open the projection window again</button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
