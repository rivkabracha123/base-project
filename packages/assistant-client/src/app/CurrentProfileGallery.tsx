import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ErrorState, LoadingState } from '@monabid/ui';
import { getCurrentProfile } from './api';
import { EvidenceGallery } from './evidenceGallery';

// גלריית התמונות של המוכרת הנוכחית: משיגה את הפרופיל האמיתי ומעבירה את ה-id שלו לגלריה,
// כך שהיא מציגה גם את התמונות שהועלו מהצ'אט (שנשמרות לפי אותו פרופיל).
// The gallery of the current seller: loads the real profile and passes its id to the gallery,
// so it also shows the photos uploaded from the chat (which are stored under the same profile).
export function CurrentProfileGallery() {
  const { i18n } = useTranslation();
  const isHebrew = i18n.language.startsWith('he');
  // אותו מפתח כמו ProfileLanguageLoader, כדי לשתף את המטמון ולא לבקש את הפרופיל פעמיים.
  const profileQuery = useQuery({
    queryKey: ['current-profile'],
    queryFn: ({ signal }) => getCurrentProfile(signal),
  });

  if (profileQuery.isPending) {
    return <LoadingState label={isHebrew ? 'טוען פרופיל…' : 'Loading profile…'} />;
  }

  if (profileQuery.isError) {
    return (
      <ErrorState
        title={isHebrew ? 'לא ניתן לטעון את הפרופיל.' : 'The profile could not be loaded.'}
        retryLabel={isHebrew ? 'ניסיון חוזר' : 'Try again'}
        onRetry={() => void profileQuery.refetch()}
      />
    );
  }

  return <EvidenceGallery profileId={profileQuery.data.id} />;
}
