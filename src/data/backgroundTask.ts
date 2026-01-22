import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import { checkForNewListings } from './newListingsCheck';
import { setupAndroidNotificationChannel, requestNotificationPermissions } from '../notifications/notifications';

const BACKGROUND_FETCH_TASK = 'background-fetch-new-listings';

// Define the background task
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    console.log('Background fetch task running: checking for new listings');
    
    // Check if user has notifications enabled
    const { getProfileSettings } = await import('./profileSettingsRepo');
    const settings = await getProfileSettings();
    
    if (!settings.pushNewListings) {
      console.log('New listings notifications are disabled, skipping background check');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Request permissions if needed
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('Notification permissions not granted, skipping background check');
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Check for new listings
    await checkForNewListings();

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    console.error('Background fetch task error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

/**
 * Register the background fetch task.
 * Note: Background fetch requires a development build and does not work in Expo Go.
 */
export async function registerBackgroundFetch(): Promise<void> {
  try {
    // Set up Android notification channel
    await setupAndroidNotificationChannel();

    // Check if background fetch is available (requires development build, not Expo Go)
    const status = await BackgroundFetch.getStatusAsync();
    if (status === BackgroundFetch.BackgroundFetchStatus.Restricted) {
      console.warn('Background fetch is restricted. A development build is required for background tasks.');
      return;
    }

    // Register the background fetch task
    await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval: 15 * 60, // 15 minutes (minimum allowed)
      stopOnTerminate: false, // Continue running even when app is terminated
      startOnBoot: true, // Start when device boots
    });

    console.log('Background fetch task registered');
  } catch (error: any) {
    // Silently handle errors - background fetch may not be available in Expo Go
    if (error?.message?.includes('UIBackgroundModes') || error?.message?.includes('Info.plist')) {
      console.warn('Background fetch requires UIBackgroundModes in Info.plist. This will work in a development build.');
    } else if (error?.message?.includes('Expo Go') || error?.message?.includes('development build')) {
      console.warn('Background fetch requires a development build. Learn more: https://expo.fyi/dev-client');
    } else {
      console.warn('Failed to register background fetch task:', error?.message || error);
    }
  }
}

/**
 * Unregister the background fetch task.
 */
export async function unregisterBackgroundFetch(): Promise<void> {
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
    console.log('Background fetch task unregistered');
  } catch (error) {
    console.warn('Failed to unregister background fetch task:', error);
  }
}

/**
 * Get the status of the background fetch task.
 */
export async function getBackgroundFetchStatus(): Promise<BackgroundFetch.BackgroundFetchStatus> {
  try {
    return await BackgroundFetch.getStatusAsync();
  } catch (error) {
    console.warn('Failed to get background fetch status:', error);
    return BackgroundFetch.BackgroundFetchStatus.Restricted;
  }
}
