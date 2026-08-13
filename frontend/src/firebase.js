import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// NOTE: You will need to replace this configuration object with the one from your Firebase Console
// once you have created a project.
const firebaseConfig = {
  apiKey: "AIzaSyCgeS6rLiHJ3_XnNbubb7B0OLy5VEI2cq4",
  authDomain: "ai-email-assistant-bcdc8.firebaseapp.com",
  projectId: "ai-email-assistant-bcdc8",
  storageBucket: "ai-email-assistant-bcdc8.firebasestorage.app",
  messagingSenderId: "820304417897",
  appId: "1:820304417897:web:6e84fb49468769ceedfef8",
  measurementId: "G-XBTKFK3RBH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging and get a reference to the service
export const messaging = getMessaging(app);

export const requestFirebaseNotificationPermission = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notification permission granted.');
      // Get the FCM token (needs a VAPID key in production)
      const currentToken = await getToken(messaging, { 
        vapidKey: 'BCdT6O8W7wFmfsEO5tH__QBoFAD9bjzO_uqcW_L8016r-0noK6xwg9Eco7q_Fn17_Q_JsTvpy3oA0ZS7tiRFMVE' 
      });
      if (currentToken) {
        console.log('FCM Token:', currentToken);
        return currentToken;
      } else {
        console.log('No registration token available. Request permission to generate one.');
      }
    } else {
      console.log('Unable to get permission to notify.');
    }
  } catch (err) {
    console.log('An error occurred while retrieving token. ', err);
  }
  return null;
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
