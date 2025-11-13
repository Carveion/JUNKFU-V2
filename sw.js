
let userProfile = null;
let masterFoodList = [];
let notificationTimeouts = [];

const getMealTypeForCurrentTime = () => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 12) return 'Breakfast';
    if (hour >= 12 && hour < 17) return 'Lunch';
    if (hour >= 17 || hour < 4) return 'Dinner';
    return 'Snacks';
};

const clearAllTimeouts = () => {
    notificationTimeouts.forEach(clearTimeout);
    notificationTimeouts = [];
};

const scheduleNotifications = () => {
    clearAllTimeouts();
    if (!self.registration || !userProfile || !userProfile.notificationsEnabled || !userProfile.notificationTimes || userProfile.notificationTimes.length === 0) {
        return;
    }

    const now = new Date();

    userProfile.notificationTimes.forEach(time => {
        const [hours, minutes] = time.split(':').map(Number);
        const notificationDate = new Date();
        notificationDate.setHours(hours, minutes, 0, 0);

        if (notificationDate <= now) {
            notificationDate.setDate(notificationDate.getDate() + 1);
        }

        const delay = notificationDate.getTime() - now.getTime();

        if (delay > 0) {
            const timeoutId = setTimeout(() => {
                showNotification();
                scheduleNotifications(); 
            }, delay);
            notificationTimeouts.push(timeoutId);
        }
    });
};

const showNotification = () => {
    if (!self.registration || !userProfile) return;

    const mealType = getMealTypeForCurrentTime();
    const mealKey = mealType.toLowerCase();

    const title = `JUNKFU: Time for ${mealType}?`;
    const options = {
        body: 'Ready to track your meal? It only takes a second.',
        icon: '/vite.svg',
        actions: [],
        data: { mealType }
    };

    const standardMeal = userProfile.standardMeals[mealKey]?.[0];
    if (standardMeal) {
        options.actions.push({ action: 'track_standard', title: `Track: ${standardMeal.name}` });
        options.data.standardMeal = standardMeal;
    }
    
    const favoriteName = userProfile.favoriteCategoryNames?.[0];
    if (favoriteName) {
         options.actions.push({ action: 'track_favorite', title: `Track: ${favoriteName}` });
         options.data.favoriteCategoryName = favoriteName;
    }

    options.actions.push({ action: 'add_custom', title: 'Custom Entry...' });

    self.registration.showNotification(title, options);
};

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('message', (event) => {
    if (event.data.type === 'SET_USER_PROFILE') {
        userProfile = event.data.profile;
        masterFoodList = event.data.masterFoodList;
        scheduleNotifications();
    } else if (event.data.type === 'CLEAR_NOTIFICATIONS') {
        clearAllTimeouts();
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const { action, data } = event;
    const { mealType } = data;

    const promise = clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
        let client = windowClients.find(wc => wc.visibilityState === 'visible');
        if (client) {
            return client.focus();
        }
        if (windowClients.length > 0) {
            return windowClients[0].focus();
        }
        return clients.openWindow('/');
    }).then(client => {
        if (!client) return;

        setTimeout(() => {
            if (action === 'add_custom') {
                client.postMessage({ type: 'OPEN_CUSTOM_MODAL', payload: { mealType } });
            } else if (action === 'track_standard' && data.standardMeal) {
                const entry = {
                    ...data.standardMeal,
                    mealType, isCustom: false, baseCalories: data.standardMeal.calories,
                    quantity: 1, quantityUnit: 'pcs', quantity_label: data.standardMeal.name,
                };
                client.postMessage({ type: 'QUICK_ADD_FOOD', payload: entry });
            } else if (action === 'track_favorite' && data.favoriteCategoryName) {
                const category = masterFoodList.find(c => c.name === data.favoriteCategoryName);
                if (category) {
                    const entry = {
                        name: category.name, calories: category.calories, baseCalories: category.calories,
                        quantity: 'Medium', quantityUnit: 'serving', quantity_label: 'Medium',
                        mealType, isCustom: false,
                    };
                    client.postMessage({ type: 'QUICK_ADD_FOOD', payload: entry });
                }
            }
        }, 500);
    });

    event.waitUntil(promise);
});
