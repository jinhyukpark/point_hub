import * as admin from 'firebase-admin';

// Initialize Firebase Admin once for the entire application
if (admin.apps.length === 0) {
  // Check if running in emulator
  const useEmulator = process.env.FUNCTIONS_EMULATOR === 'true' ||
                      process.env.FIREBASE_DATABASE_EMULATOR_HOST;

  if (useEmulator) {
    // Use emulator in local development
    admin.initializeApp({
      projectId: 'pointhub-ab054',
      databaseURL: 'http://127.0.0.1:9000?ns=pointhub-ab054'
    });
    console.log('[Firebase Admin] Using Database Emulator at http://127.0.0.1:9000');
  } else {
    // Use production DB
    admin.initializeApp({
      databaseURL: 'https://pointhub-ab054-default-rtdb.asia-southeast1.firebasedatabase.app'
    });
    console.log('[Firebase Admin] Using Production Database');
  }
}

export const rtdb = admin.database();
export default admin;