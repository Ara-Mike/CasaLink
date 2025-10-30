// js/notificationManager.js - REMOVE export statement
class NotificationManager {
    static permission = null;
    static registration = null;

    static async init() {
        this.permission = Notification.permission;
        
        if ('Notification' in window && 'serviceWorker' in navigator) {
            try {
                this.registration = await navigator.serviceWorker.ready;
                
                if (this.permission === 'default') {
                    await this.requestPermission();
                }
                
                this.setupNotificationListeners();
            } catch (error) {
                console.error('Notification initialization failed:', error);
            }
        }
    }

    static async requestPermission() {
        try {
            const permission = await Notification.requestPermission();
            this.permission = permission;
            return permission;
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            return 'denied';
        }
    }

    static async showNotification(title, options = {}) {
        if (this.permission !== 'granted') {
            console.warn('Notification permission not granted');
            return;
        }

        const notificationOptions = {
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            vibrate: [200, 100, 200],
            data: {
                url: window.location.href
            },
            ...options
        };

        // Show notification via service worker
        if (this.registration) {
            this.registration.showNotification(title, notificationOptions);
        } else {
            // Fallback to regular notifications
            new Notification(title, notificationOptions);
        }
    }

    static setupNotificationListeners() {
        // Listen for notification clicks
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'NOTIFICATION_CLICK') {
                this.handleNotificationClick(event.data);
            }
        });

        // Listen for push events (if push is implemented)
        if ('PushManager' in window) {
            navigator.serviceWorker.addEventListener('push', (event) => {
                this.handlePushEvent(event);
            });
        }
    }

    static handleNotificationClick(data) {
        // Handle notification actions
        switch (data.action) {
            case 'view_bill':
                window.casaLink?.showPage('tenantBilling');
                break;
            case 'view_maintenance':
                window.casaLink?.showPage('tenantMaintenance');
                break;
            default:
                // Default behavior
                window.focus();
        }
    }

    static async scheduleReminder(title, body, triggerTime, data = {}) {
        if ('Notification' in window && 'showTrigger' in Notification.prototype) {
            try {
                const registration = await navigator.serviceWorker.ready;
                
                await registration.showNotification(title, {
                    body: body,
                    icon: '/icons/icon-192x192.png',
                    badge: '/icons/icon-72x72.png',
                    tag: 'reminder', // Group similar notifications
                    showTrigger: new TimestampTrigger(triggerTime),
                    data: data
                });
                
                console.log('Scheduled notification for:', triggerTime);
            } catch (error) {
                console.error('Error scheduling notification:', error);
            }
        }
    }

    // Tenant-specific notifications
    static notifyRentDue(bill) {
        const daysUntilDue = Math.ceil((new Date(bill.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
        
        let message = '';
        if (daysUntilDue === 0) {
            message = 'Your rent payment is due today!';
        } else if (daysUntilDue === 1) {
            message = 'Your rent payment is due tomorrow!';
        } else if (daysUntilDue > 0) {
            message = `Your rent payment of ₱${bill.totalAmount} is due in ${daysUntilDue} days`;
        } else {
            message = `Your rent payment of ₱${bill.totalAmount} is overdue by ${Math.abs(daysUntilDue)} days`;
        }

        this.showNotification('Rent Due Reminder', {
            body: message,
            tag: 'rent-reminder',
            actions: [
                { action: 'view_bill', title: 'View Bill' },
                { action: 'pay_now', title: 'Pay Now' }
            ]
        });
    }

    // Landlord-specific notifications
    static notifyNewMaintenance(request) {
        this.showNotification('New Maintenance Request', {
            body: `New ${request.type} request from ${request.tenantName}`,
            tag: 'maintenance-request',
            actions: [
                { action: 'view_maintenance', title: 'View Request' },
                { action: 'assign_staff', title: 'Assign Staff' }
            ]
        });
    }
}
window.NotificationManager = NotificationManager;