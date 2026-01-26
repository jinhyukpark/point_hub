import * as admin from 'firebase-admin';

// Initialize Firebase Admin once for the entire application
if (admin.apps.length === 0) {
  // Check if running in emulator
  const useEmulator = process.env.FUNCTIONS_EMULATOR === 'true' ||
                      process.env.FIREBASE_DATABASE_EMULATOR_HOST;

  if (useEmulator) {
    // Use emulator in local development
    admin.initializeApp({
      projectId: 'point-hub-a9db1',
      databaseURL: 'http://127.0.0.1:9000?ns=point-hub-a9db1'
    });
    console.log('[Firebase Admin] Using Database Emulator at http://127.0.0.1:9000');
  } else {
    // Use production - let Firebase auto-configure with default credentials
    admin.initializeApp();
    console.log('[Firebase Admin] Using Production Database (auto-configured)');
  }
}

export const rtdb = admin.database();
export default admin;