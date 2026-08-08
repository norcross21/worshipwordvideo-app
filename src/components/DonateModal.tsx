import { useState } from 'react';
import { Heart, ExternalLink, CreditCard, ShieldCheck, X, Sparkles, Home, Brain, Users, GraduationCap, Building2 } from 'lucide-react';

interface DonateModalProps {
  onClose: () => void;
}

export function DonateModal({ onClose }: DonateModalProps) {
  const [selectedAmount, setSelectedAmount] = useState<number | 'custom'>(10);
  const [customAmount, setCustomAmount] = useState('15');
  const [showBankDetails, setShowBankDetails] = useState(false);

  const getFinalAmount = (): number => {
    if (selectedAmount === 'custom') {
      const parsed = parseFloat(customAmount);
      return isNaN(parsed) || parsed <= 0 ? 10 : parsed;
    }
    return selectedAmount;
  };

  const handleStripeDonate = () => {
    const amount = getFinalAmount();
    const stripeUrl = `https://buy.stripe.com/donate?amount=${amount}&currency=gbp`;
    window.open(stripeUrl, '_blank');
  };

  const handleDirectCharityDonate = () => {
    window.open('https://localgiving.org/charity/kairoshousing', '_blank');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-card--donate-rich" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header modal-header--donate">
          <div className="donate-badge">
            <Heart size={16} fill="currentColor" /> Voluntary Charity Gift & Sanctuary Support
          </div>
          <button type="button" className="icon-btn-light" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body donate-modal__body-scroll">
          {/* Mission Hero Banner */}
          <div className="charity-mission-hero">
            <span className="charity-mission-hero__subtitle">PARTNER CHARITY SUPPORT</span>
            <h3>More Than Just a Roof: Rebuilding Lives with Dignity</h3>
            <p>
              Worship Word Video is <strong>100% free</strong> for all churches. 
              If this app blesses your worship services, consider making a voluntary gift to our housing & sanctuary charity partner.
            </p>
            <p className="charity-mission-hero__statement">
              Supporting asylum seekers, refugees, and individuals at risk of homelessness — providing safe accommodation and trauma-informed support to help people rebuild their lives.
            </p>
          </div>

          {/* 4 Impact Pillars */}
          <div className="impact-pillars-grid">
            <div className="pillar-card">
              <Home size={18} className="pillar-icon pillar-icon--blue" />
              <div>
                <strong>Safe Homes</strong>
                <p>A secure base where healing and stability begin.</p>
              </div>
            </div>

            <div className="pillar-card">
              <Brain size={18} className="pillar-icon pillar-icon--teal" />
              <div>
                <strong>Healing & Dignity</strong>
                <p>Therapeutic workshops & agency restoration.</p>
              </div>
            </div>

            <div className="pillar-card">
              <Users size={18} className="pillar-icon pillar-icon--purple" />
              <div>
                <strong>Connecting to Life</strong>
                <p>Combating isolation through community & volunteering.</p>
              </div>
            </div>

            <div className="pillar-card">
              <GraduationCap size={18} className="pillar-icon pillar-icon--gold" />
              <div>
                <strong>Building a Future</strong>
                <p>Practical navigation of UK housing, healthcare & education.</p>
              </div>
            </div>
          </div>

          {/* Option 1: Direct Charity Website Link */}
          <div className="donate-card donate-card--direct">
            <div className="donate-card__header">
              <span className="donate-card__number">1</span>
              <div>
                <h4>Donate Directly via Official LocalGiving / Charity Page</h4>
                <p>Support safe accommodation and monthly sanctuary giving.</p>
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
                <p>Fast payment with Credit Card, Apple Pay, or Google Pay.</p>
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

          {/* Option 3: Direct Bank Transfer Accordion */}
          <div className="donate-card donate-card--bank">
            <button
              type="button"
              className="bank-accordion-toggle"
              onClick={() => setShowBankDetails(!showBankDetails)}
            >
              <span><Building2 size={16} /> Direct Bank Transfer / Standing Order</span>
              <span className="toggle-text">{showBankDetails ? 'Hide' : 'Show Details'}</span>
            </button>

            {showBankDetails && (
              <div className="bank-details-box">
                <p>You can make a one-off donation or set up a standing order directly through your UK bank:</p>
                <ul>
                  <li><strong>Bank:</strong> CAF Bank</li>
                  <li><strong>Account Name:</strong> Kairos Housing</li>
                  <li><strong>Sort Code:</strong> 40-52-40</li>
                  <li><strong>Account Number:</strong> 00035327</li>
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer donate-modal__footer">
          <p>Thank you for supporting worship ministry and sanctuary housing!</p>
        </div>
      </div>
    </div>
  );
}
