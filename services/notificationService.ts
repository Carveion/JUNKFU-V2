import { Category, UserProfile } from "../types";

export const requestNotificationPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
        alert('This browser does not support desktop notification');
        return false;
    }

    if (Notification.permission === 'granted') {
        return true;
    }

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }

    return false;
};


const postMessageToServiceWorker = (message: any) => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage(message);
    } else {
        navigator.serviceWorker.ready.then(registration => {
            registration.active?.postMessage(message);
        }).catch(err => console.error("Could not post message to SW:", err));
    }
};

export const clearAllNotifications = () => {
    postMessageToServiceWorker({ type: 'CLEAR_NOTIFICATIONS' });
};

export const scheduleNotifications = (profile: UserProfile, masterFoodList: Category[]) => {
    if (profile.notificationsEnabled) {
        postMessageToServiceWorker({ type: 'SET_USER_PROFILE', profile, masterFoodList });
    } else {
        clearAllNotifications();
    }
};
