import { useRef, useState } from 'react';
import type { HouseRanking } from '@monabid/shared';
import { HouseJourneyCard } from '../app/SellerJourneyChrome';
import { createSellerLead, grantP3ServiceConsent, rankHousesForLead, saveSellerHouseChoice } from '../app/api';

export function SellerHouseCards({ ranking, category, language }: { ranking: HouseRanking; category?: string; language: 'he' | 'en' }) {
  const he = language === 'he';
  const houses = [ranking.recommendation, ...ranking.alternatives].filter(entry => entry?.house.active && (!category || entry.house.categories.includes(category)));
  const [selectedHouseId, setSelectedHouseId] = useState(houses[0]?.house.id);
  const [saving, setSaving] = useState(false);
  const [savedHouseName, setSavedHouseName] = useState('');
  const [error, setError] = useState('');
  const leadId = useRef<string>();

  async function saveChoice() {
    if (!selectedHouseId || saving) return;
    setSaving(true);
    setError('');
    setSavedHouseName('');
    try {
      if (!leadId.current) {
        const granted = await grantP3ServiceConsent();
        if (!granted) throw new Error('Service consent could not be saved');
        leadId.current = await createSellerLead();
      }
      const selected = houses.find(entry => entry?.house.id === selectedHouseId);
      await rankHousesForLead(leadId.current, undefined, {
        category: category ?? selected!.house.categories[0]!, preferredLanguage: language,
      });
      const choice = await saveSellerHouseChoice(leadId.current, selectedHouseId);
      setSavedHouseName(choice.houseName);
    } catch {
      setError(he ? 'לא ניתן לשמור את בחירת הבית. אפשר לנסות שוב.' : 'Could not save the house choice. Try again.');
    } finally { setSaving(false); }
  }
  return <div dir={he ? 'rtl' : 'ltr'}>
    {!houses.length && <p role="status">{he ? 'לא נמצאו בתי מכירות מתאימים.' : 'No matching auction houses were found.'}</p>}
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {houses.map(entry => <li key={entry!.house.id} className="min-w-0">
        <HouseJourneyCard row={entry!} recommended={entry === ranking.recommendation} selectedId={selectedHouseId}
          onSelect={id => { if (!saving) { setSelectedHouseId(id); setSavedHouseName(''); } }} />
        {entry!.house.id.startsWith('demo-') && <p className="mt-2 text-xs font-semibold text-red-800">{he ? 'נתוני הדגמה בלבד' : 'DEMO data only'}</p>}
      </li>)}
    </ul>
    {houses.length > 0 && <button type="button" disabled={saving || !selectedHouseId} onClick={() => void saveChoice()}
      className="mt-4 rounded-full bg-[#b08948] px-5 py-2 text-white disabled:opacity-50">
      {saving ? he ? 'שומר...' : 'Saving...' : he ? 'שמירת בחירת הבית' : 'Save house choice'}
    </button>}
    {savedHouseName && <p role="status" className="mt-3 text-green-800">{he ? `הבחירה נשמרה: ${savedHouseName}` : `Choice saved: ${savedHouseName}`}</p>}
    {error && <p role="alert" className="mt-3 text-red-800">{error}</p>}
  </div>;
}
