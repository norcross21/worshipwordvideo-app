import { ExternalLink, X, ShieldCheck } from 'lucide-react';

interface DonateModalProps {
  onClose: () => void;
}

export function DonateModal({ onClose }: DonateModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card modal-card--donate-rich"
        role="dialog"
        aria-modal="true"
        aria-labelledby="donate-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header modal-header--donate">
          <div className="donate-brand">
            <img src="/kairos-housing-logo.svg" alt="Kairos Housing" />
            <div>
              <span>Optional charity support</span>
              <strong id="donate-dialog-title">Support Kairos Housing</strong>
            </div>
          </div>
          <button type="button" className="icon-btn-light" onClick={onClose} aria-label="Close donation information"><X size={18} /></button>
        </div>

        <div className="modal-body donate-modal__body-scroll">
          <div className="donate-intro">
            <h3>Rebuilding lives with dignity</h3>
            <p>
              Worship Word Video is currently provided without charge. If it helps your church, you can optionally support Kairos Housing directly.
            </p>
            <p>
              Kairos provides accommodation and practical, trauma-informed support for asylum seekers and refugees experiencing homelessness in Blackburn with Darwen.
            </p>
          </div>

          <div className="donate-card donate-card--direct">
            <div className="donate-card__header">
              <span className="donate-card__number"><ShieldCheck size={16} /></span>
              <div>
                <h4>Give securely on Kairos Housing’s official page</h4>
                <p>Your gift is handled by Kairos Housing’s internal donation system. Worship Word Video never receives your card or bank details.</p>
              </div>
            </div>
            <a
              className="btn-donate-direct"
              href="https://operations.kairoshousing.org.uk/donate"
              target="_blank"
              rel="noreferrer"
            >
              Visit the Kairos donation page <ExternalLink size={14} />
            </a>
            <p className="donate-security-note"><ShieldCheck size={14} /> Kairos Housing · Registered charity number 1198820</p>
          </div>
        </div>

        <div className="modal-footer donate-modal__footer">
          <p>No pressure—close this window to continue. It will not appear again during this visit.</p>
        </div>
      </div>
    </div>
  );
}
