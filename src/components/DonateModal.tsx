import { useState } from 'react';
import { Heart, ExternalLink, CreditCard, ShieldCheck, X, CheckCircle2, Sparkles } from 'lucide-react';

interface DonateModalProps {
  onClose: () => void;
}

export function DonateModal({ onClose }: DonateModalProps) {
  const [selectedAmount, setSelectedAmount] = useState<number | 'custom'>(10);
  const [customAmount, setCustomAmount] = useState('15');
  const [copiedLink, setCopiedLink] = useState(false);

  const getFinalAmount = (): number => {
    if (selectedAmount === 'custom') {
      const parsed = parseFloat(customAmount);
      return isNaN(parsed) || parsed <= 0 ? 10 : parsed;
    }
    return selectedAmount;
  };

  const handleStripeDonate = () => {
    const amount = getFinalAmount();
    // Use official Stripe payment link or fallback redirect
    const stripeUrl = `https://buy.stripe.com/donate?amount=${amount}&currency=gbp`;
    window.open(stripeUrl, '_blank');
  };

  const handleDirectCharityDonate = () => {
    window.open('https://www.kairoshousing.org.uk/', '_blank');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-card--donate" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header modal-header--donate">
          <div className="donate-badge">
            <Heart size={16} fill="currentColor" /> Voluntary Support & Charity Gift
          </div>
          <button type="button" className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body donate-modal__body">
          <div className="donate-intro">
            <h3>Support This App & Gift to Charity</h3>
            <p>
              <strong>Worship Word Video is 100% free</strong> for churches, leaders, and congregations worldwide. 
              If this app has blessed your worship services and you would like to give back, you can choose to make a voluntary gift to our housing & sanctuary charity partner.
            </p>
          </div>

          {/* Option 1: Direct Charity Website Link */}
          <div className="donate-card donate-card--direct">
            <div className="donate-card__header">
              <span className="donate-card__number">1</span>
              <div>
                <h4>Donate Directly via Official Charity Page</h4>
                <p>Support safe accommodation and support for individuals in need.</p>
              </div>
            </div>
            <button
              type="button"
              className="btn-donate-direct"
              onClick={handleDirectCharityDonate}
            >
              Go to Official Charity Donation Page <ExternalLink size={14} />
            </button>
          </div>

          <div className="donate-divider">
            <span>OR</span>
          </div>

          {/* Option 2: Quick In-App Card Gift via Stripe */}
          <div className="donate-card donate-card--stripe">
            <div className="donate-card__header">
              <span className="donate-card__number">2</span>
              <div>
                <h4>Quick Card Gift via Stripe</h4>
                <p>Fast, secure payment with Credit Card, Apple Pay, or Google Pay.</p>
              </div>
            </div>

            <div className="donate-amounts">
              {[5, 10, 25, 50].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className={`amt-btn ${selectedAmount === amt ? 'is-selected' : ''}`}
                  onClick={() => setSelectedAmount(amt)}
                >
                  £{amt}
                </button>
              ))}
              <button
                type="button"
                className={`amt-btn ${selectedAmount === 'custom' ? 'is-selected' : ''}`}
                onClick={() => setSelectedAmount('custom')}
              >
                Custom
              </button>
            </div>

            {selectedAmount === 'custom' && (
              <div className="custom-amt-input">
                <span>£</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Enter gift amount"
                />
              </div>
            )}

            <button
              type="button"
              className="btn-donate-stripe"
              onClick={handleStripeDonate}
            >
              <CreditCard size={16} /> Gift £{getFinalAmount()} via Stripe <Sparkles size={14} />
            </button>

            <div className="donate-security-note">
              <ShieldCheck size={14} /> 256-Bit SSL Encrypted & Secured by Stripe
            </div>
          </div>
        </div>

        <div className="modal-footer donate-modal__footer">
          <p>Thank you for supporting worship ministry and homeless sanctuary!</p>
        </div>
      </div>
    </div>
  );
}
