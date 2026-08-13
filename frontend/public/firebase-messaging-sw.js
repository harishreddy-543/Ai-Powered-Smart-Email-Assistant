// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in the
// messagingSenderId.
// NOTE: We don't have the config yet. This will be replaced by the user once they create their Firebase project.
const firebaseConfig = {
  apiKey: "AIzaSyCgeS6rLiHJ3_XnNbubb7B0OLy5VEI2cq4",
  authDomain: "ai-email-assistant-bcdc8.firebaseapp.com",
  projectId: "ai-email-assistant-bcdc8",
  storageBucket: "ai-email-assistant-bcdc8.firebasestorage.app",
  messagingSenderId: "820304417897",
  appId: "1:820304417897:web:6e84fb49468769ceedfef8",
  measurementId: "G-XBTKFK3RBH"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/vite.svg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
