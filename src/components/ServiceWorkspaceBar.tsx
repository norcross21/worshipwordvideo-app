import { Check, Cloud, Library, Plus } from 'lucide-react';
import type { SavedUserPlaylist } from '../lib/supabase';

interface ServiceWorkspaceBarProps {
  services: SavedUserPlaylist[];
  activeService: SavedUserPlaylist | null;
  loading?: boolean;
  saveState?: 'idle' | 'saving' | 'saved' | 'error';
  onSelectService: (service: SavedUserPlaylist) => Promise<void> | void;
  onCreateService: () => void;
  onManageServices: () => void;
}

export function ServiceWorkspaceBar({
  services,
  activeService,
  loading = false,
  saveState = 'idle',
  onSelectService,
  onCreateService,
  onManageServices,
}: ServiceWorkspaceBarProps) {
  const choices = activeService && !services.some((service) => service.id === activeService.id)
    ? [activeService, ...services]
    : services;

  const selectService = (serviceId: string) => {
    const service = choices.find((candidate) => candidate.id === serviceId);
    if (service && service.id !== activeService?.id) void onSelectService(service);
  };

  const status = saveState === 'saving'
    ? 'Saving…'
    : saveState === 'error'
      ? 'Not saved — check connection'
      : activeService
        ? `${activeService.items?.length ?? 0} video${activeService.items?.length === 1 ? '' : 's'}`
        : 'Choose one before adding videos';

  return (
    <section className={`service-workspace ${activeService ? 'has-service' : ''}`} aria-label="Current worship service">
      <span className="service-workspace__icon" aria-hidden="true">{activeService ? <Check size={17} /> : <Cloud size={17} />}</span>
      <label className="service-workspace__select">
        <span>Current service</span>
        <select
          aria-label="Current service"
          value={activeService?.id ?? ''}
          disabled={loading}
          onChange={(event) => selectService(event.target.value)}
        >
          <option value="">{loading ? 'Loading services…' : choices.length ? 'Choose a service' : 'No service yet'}</option>
          {choices.map((service) => (
            <option key={service.id} value={service.id}>{service.title}</option>
          ))}
        </select>
      </label>
      <span className={`service-workspace__status is-${saveState}`} role="status">{status}</span>
      <div className="service-workspace__actions">
        <button type="button" className="service-workspace__new" onClick={onCreateService}><Plus size={15} /> New</button>
        <button type="button" className="service-workspace__manage" onClick={onManageServices} aria-label="Manage saved services" title="Manage saved services"><Library size={16} /><span>Manage</span></button>
      </div>
    </section>
  );
}
