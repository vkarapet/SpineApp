import { isIOS, isStandalone } from '../utils/device';
import { getProfile, saveProfile } from '../core/db';
import { INSTALL_PROMPT_DELAY_DAYS } from '../constants';
import { eventBus } from '../main';

let deferredPrompt: BeforeInstallPromptEvent | null = null;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function initInstallService(): void {
  if (isStandalone()) return; // Already installed

  // Android: capture beforeinstallprompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
  });
}

export async function shouldShowInstallPrompt(): Promise<boolean> {
  if (isStandalone()) return false;

  const profile = await getProfile();
  if (!profile) return false;

  // Only show after first assessment
  if (!profile.first_assessment_completed) return false;

  // Check if dismissed recently
  if (profile.install_prompt_dismissed_at) {
    const dismissedAt = new Date(profile.install_prompt_dismissed_at).getTime();
    const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
    if (daysSince < INSTALL_PROMPT_DELAY_DAYS) return false;
  }

  return true;
}

export async function showInstallPrompt(): Promise<void> {
  if (isIOS()) {
    eventBus.emit('show-ios-install-prompt');
  } else if (deferredPrompt) {
    await deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === 'dismissed') {
      await dismissInstallPrompt();
    }
    deferredPrompt = null;
  }
}

export async function dismissInstallPrompt(): Promise<void> {
  const profile = await getProfile();
  if (profile) {
    profile.install_prompt_dismissed_at = new Date().toISOString();
    await saveProfile(profile);
  }
}
