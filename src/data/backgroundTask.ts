import * as BackgroundTask from 'expo-background-task';
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
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    // Request permissions if needed
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('Notification permissions not granted, skipping background check');
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    // Check for new listings
    await checkForNewListings();

    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.error('Background fetch task error:', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/**
 * Register the background fetch task.
 * Note: Background tasks require a development build and do not work in Expo Go.
 */
export async function registerBackgroundFetch(): Promise<void> {
  try {
    // Set up Android notification channel
    await setupAndroidNotificationChannel();

    // Check if background task is available (requires development build, not Expo Go)
    const status = await BackgroundTask.getStatusAsync();
    if (status === BackgroundTask.BackgroundTaskStatus.Restricted) {
      console.warn('Background tasks are restricted. A development build is required for background tasks.');
      return;
    }

    // Register the background task
    await BackgroundTask.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval: 15, // 15 minutes (minimum allowed) - note: value is in minutes, not seconds
    });

    console.log('Background task registered');
  } catch (error: any) {
    // Silently handle errors - background tasks may not be available in Expo Go
    if (error?.message?.includes('UIBackgroundModes') || error?.message?.includes('Info.plist')) {
      console.warn('Background tasks require UIBackgroundModes in Info.plist. This will work in a development build.');
    } else if (error?.message?.includes('Expo Go') || error?.message?.includes('development build')) {
      console.warn('Background tasks require a development build. Learn more: https://expo.fyi/dev-client');
    } else {
      console.warn('Failed to register background task:', error?.message || error);
    }
  }
}

/**
 * Unregister the background task.
 */
export async function unregisterBackgroundFetch(): Promise<void> {
  try {
    await BackgroundTask.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
    console.log('Background task unregistered');
  } catch (error) {
    console.warn('Failed to unregister background task:', error);
  }
}

/**
 * Get the status of the background task.
 */
export async function getBackgroundFetchStatus(): Promise<BackgroundTask.BackgroundTaskStatus> {
  try {
    return await BackgroundTask.getStatusAsync();
  } catch (error) {
    console.warn('Failed to get background task status:', error);
    return BackgroundTask.BackgroundTaskStatus.Restricted;
  }
}
