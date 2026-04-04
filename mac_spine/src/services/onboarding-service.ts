import { loadProfile, isConsentCurrent } from './profile-service';
import { router } from '../main';

export async function determineStartRoute(): Promise<string> {
  const profile = await loadProfile();

  if (!profile) {
    // No profile — new user or data cleared
    return '#/consent';
  }

  // Check consent version
  const consentCurrent = await isConsentCurrent();
  if (!consentCurrent) {
    return '#/consent';
  }

  return '#/menu';
}

export async function startOnboarding(): Promise<void> {
  const route = await determineStartRoute();
  router.navigate(route, true);
}
