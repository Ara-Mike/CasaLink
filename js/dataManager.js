// js/dataManager.js
import { 
    collection, 
    doc, 
    getDocs, 
    getDoc, 
    addDoc, 
    updateDoc, 
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { db } from '../config/firebase.js';

class DataManager {
    static isOnline = navigator.onLine;

    static init() {
        // Listen for online/offline status
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.processPendingOperations();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
        });
    }

    static async addTenant(tenantData) {
        if (!this.isOnline) {
            // Store operation for later sync
            const pendingOp = {
                type: 'addTenant',
                data: tenantData,
                timestamp: new Date().toISOString()
            };
            this.storePendingOperation(pendingOp);
            throw new Error('Operation queued for sync when online');
        }

        try {
            const docRef = await addDoc(collection(db, 'tenants'), {
                ...tenantData,
                createdAt: new Date().toISOString(),
                isActive: true
            });
            return docRef.id;
        } catch (error) {
            if (error.code === 'failed-precondition') {
                // Offline - queue for later
                const pendingOp = {
                    type: 'addTenant',
                    data: tenantData,
                    timestamp: new Date().toISOString()
                };
                this.storePendingOperation(pendingOp);
                return 'queued';
            }
            throw error;
        }
    }

    static storePendingOperation(operation) {
        const pendingOps = JSON.parse(localStorage.getItem('pendingOperations') || '[]');
        pendingOps.push(operation);
        localStorage.setItem('pendingOperations', JSON.stringify(pendingOps));
        
        // Update UI to show pending sync
        this.updateSyncStatus();
    }

    static async processPendingOperations() {
        const pendingOps = JSON.parse(localStorage.getItem('pendingOperations') || '[]');
        
        for (const op of pendingOps) {
            try {
                switch (op.type) {
                    case 'addTenant':
                        await this.addTenant(op.data);
                        break;
                    case 'createBill':
                        await this.createBill(op.data);
                        break;
                    case 'submitMaintenance':
                        await this.submitMaintenanceRequest(op.data);
                        break;
                    case 'recordPayment':
                        await this.recordPayment(op.data);
                        break;
                }
                
                // Remove successful operation
                this.removePendingOperation(op);
            } catch (error) {
                console.error('Failed to process pending operation:', op, error);
            }
        }
    }

    static removePendingOperation(operation) {
        const pendingOps = JSON.parse(localStorage.getItem('pendingOperations') || '[]');
        const index = pendingOps.findIndex(op => 
            op.timestamp === operation.timestamp && op.type === operation.type
        );
        
        if (index > -1) {
            pendingOps.splice(index, 1);
            localStorage.setItem('pendingOperations', JSON.stringify(pendingOps));
        }
        
        this.updateSyncStatus();
    }

    static updateSyncStatus() {
        const pendingOps = JSON.parse(localStorage.getItem('pendingOperations') || '[]');
        const syncIndicator = document.getElementById('syncStatus');
        
        if (syncIndicator) {
            if (pendingOps.length > 0) {
                syncIndicator.innerHTML = `<i class="fas fa-sync-alt"></i> ${pendingOps.length} pending`;
                syncIndicator.style.display = 'block';
            } else {
                syncIndicator.style.display = 'none';
            }
        }
    }

    // Cache frequently accessed data
    static async getCachedData(collectionName, queryFn) {
        const cacheKey = `cache_${collectionName}`;
        const cacheTimestamp = localStorage.getItem(`${cacheKey}_timestamp`);
        const now = new Date().getTime();
        
        // Use cache if less than 5 minutes old and online
        if (cacheTimestamp && (now - parseInt(cacheTimestamp)) < 300000 && this.isOnline) {
            const cachedData = localStorage.getItem(cacheKey);
            if (cachedData) {
                return JSON.parse(cachedData);
            }
        }
        
        // Fetch fresh data
        const data = await queryFn();
        
        // Update cache
        localStorage.setItem(cacheKey, JSON.stringify(data));
        localStorage.setItem(`${cacheKey}_timestamp`, now.toString());
        
        return data;
    }


    

    

    

    // ===== DASHBOARD STATS =====
    static async getDashboardStats(landlordId) {
        const [tenants, bills, maintenance, properties] = await Promise.all([
            this.getTenants(landlordId),
            this.getBills(landlordId),
            this.getMaintenanceRequests(landlordId),
            this.getProperties(landlordId)
        ]);

        const unpaidBills = bills.filter(bill => bill.status === 'pending');
        const totalRevenue = bills
            .filter(bill => bill.status === 'paid')
            .reduce((sum, bill) => sum + (bill.totalAmount || 0), 0);
        
        const openMaintenance = maintenance.filter(req => req.status === 'open');
        const occupiedUnits = tenants.filter(tenant => tenant.status === 'active').length;

        return {
            totalTenants: tenants.length,
            totalProperties: properties.length,
            occupiedUnits,
            vacancyRate: properties.length > 0 ? ((properties.length - occupiedUnits) / properties.length * 100).toFixed(1) : 0,
            unpaidBills: unpaidBills.length,
            totalRevenue,
            openMaintenance: openMaintenance.length
        };
    }

    static listenToDashboardStats(landlordId, callback) {
        const tenantsQuery = query(collection(db, 'tenants'), where('landlordId', '==', landlordId));
        const billsQuery = query(collection(db, 'bills'), where('landlordId', '==', landlordId));
        const maintenanceQuery = query(collection(db, 'maintenance'), where('landlordId', '==', landlordId));
        const propertiesQuery = query(collection(db, 'properties'), where('landlordId', '==', landlordId));

        // Combine multiple real-time listeners
        const unsubscribeFunctions = [
            onSnapshot(tenantsQuery, () => this.updateCombinedStats()),
            onSnapshot(billsQuery, () => this.updateCombinedStats()),
            onSnapshot(maintenanceQuery, () => this.updateCombinedStats()),
            onSnapshot(propertiesQuery, () => this.updateCombinedStats())
        ];

        let combinedCallback = callback;

        this.updateCombinedStats = async () => {
            const stats = await this.getDashboardStats(landlordId);
            combinedCallback(stats);
        };

        // Initial call
        this.updateCombinedStats();

        return () => unsubscribeFunctions.forEach(unsub => unsub());
    }

    

    // ===== TENANTS =====
    static async getTenants(landlordId) {
        const q = query(
            collection(db, 'tenants'),
            where('landlordId', '==', landlordId)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    static async addTenant(tenantData) {
        const docRef = await addDoc(collection(db, 'tenants'), {
            ...tenantData,
            createdAt: new Date().toISOString(),
            isActive: true
        });
        return docRef.id;
    }

    static async updateTenant(tenantId, updates) {
        await updateDoc(doc(db, 'tenants', tenantId), updates);
    }

    static async deleteTenant(tenantId) {
        await deleteDoc(doc(db, 'tenants', tenantId));
    }

    // ===== BILLS =====
    static async updateBill(billId, updates) {
        await updateDoc(doc(db, 'bills', billId), updates);
    }

    static async deleteBill(billId) {
        await deleteDoc(doc(db, 'bills', billId));
    }

    // ===== MAINTENANCE =====
    static async updateMaintenance(requestId, updates) {
        await updateDoc(doc(db, 'maintenance', requestId), updates);
    }

    // ===== PROPERTIES =====
    static async getProperties(landlordId) {
        const q = query(
            collection(db, 'properties'),
            where('landlordId', '==', landlordId)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    static async addProperty(propertyData) {
        const docRef = await addDoc(collection(db, 'properties'), {
            ...propertyData,
            createdAt: new Date().toISOString(),
            isActive: true
        });
        return docRef.id;
    }

    static async updateProperty(propertyId, updates) {
        await updateDoc(doc(db, 'properties', propertyId), updates);
    }

    static async deleteProperty(propertyId) {
        await deleteDoc(doc(db, 'properties', propertyId));
    }

    // ===== BILLS =====
    static async getBills(landlordId) {
        const q = query(
            collection(db, 'bills'),
            where('landlordId', '==', landlordId),
            orderBy('dueDate', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    static async createBill(billData) {
        const docRef = await addDoc(collection(db, 'bills'), {
            ...billData,
            createdAt: new Date().toISOString(),
            status: 'pending'
        });
        return docRef.id;
    }

    // ===== MAINTENANCE REQUESTS =====
    static async getMaintenanceRequests(landlordId) {
        const q = query(
            collection(db, 'maintenance'),
            where('landlordId', '==', landlordId),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    static async createMaintenanceRequest(requestData) {
        const docRef = await addDoc(collection(db, 'maintenance'), {
            ...requestData,
            createdAt: new Date().toISOString(),
            status: 'open'
        });
        return docRef.id;
    }

    // ===== REAL-TIME LISTENERS =====
    static listenToTenants(landlordId, callback) {
        const q = query(
            collection(db, 'tenants'),
            where('landlordId', '==', landlordId)
        );
        return onSnapshot(q, (snapshot) => {
            const tenants = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(tenants);
        });
    }

    static listenToBills(landlordId, callback) {
        const q = query(
            collection(db, 'bills'),
            where('landlordId', '==', landlordId),
            orderBy('dueDate', 'desc')
        );
        return onSnapshot(q, (snapshot) => {
            const bills = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(bills);
        });
    }

    static async getTenantBills(tenantId) {
        const q = query(
            collection(db, 'bills'),
            where('tenantId', '==', tenantId),
            orderBy('dueDate', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    static async getTenantMaintenanceRequests(tenantId) {
        const q = query(
            collection(db, 'maintenance'),
            where('tenantId', '==', tenantId),
            orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    static async submitMaintenanceRequest(requestData) {
        const docRef = await addDoc(collection(db, 'maintenance'), {
            ...requestData,
            status: 'open',
            priority: 'medium',
            createdAt: new Date().toISOString()
        });
        return docRef.id;
    }

    // In dataManager.js - Fix the getTenantProfile method
    static async getTenantProfile(tenantId) {
        try {
            // FIXED: Changed variable name from 'doc' to 'docRef'
            const docRef = doc(db, 'tenants', tenantId);
            const document = await getDoc(docRef);
            return document.exists() ? { id: document.id, ...document.data() } : null;
        } catch (error) {
            console.error('Error getting tenant profile:', error);
            return null;
        }
    }

    // Fix any other instances where 'doc' is used as a variable
    static async updateTenantProfile(tenantId, updates) {
        try {
            // FIXED: Changed variable name from 'doc' to 'docRef'
            const docRef = doc(db, 'tenants', tenantId);
            await updateDoc(docRef, updates);
        } catch (error) {
            console.error('Error updating tenant profile:', error);
            throw error;
        }
    }

    // ===== PAYMENT PROCESSING =====
    static async recordPayment(paymentData) {
        const docRef = await addDoc(collection(db, 'payments'), {
            ...paymentData,
            processedAt: new Date().toISOString(),
            status: 'completed'
        });

        // Update bill status to paid
        if (paymentData.billId) {
            await updateDoc(doc(db, 'bills', paymentData.billId), {
                status: 'paid',
                paidDate: new Date().toISOString()
            });
        }

        return docRef.id;
    }

        // ===== REAL-TIME LISTENERS FOR TENANTS =====
    static listenToTenantBills(tenantId, callback) {
        const q = query(
            collection(db, 'bills'),
            where('tenantId', '==', tenantId),
            orderBy('dueDate', 'desc')
        );
        return onSnapshot(q, (snapshot) => {
            const bills = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(bills);
        });
    }

    static listenToTenantMaintenance(tenantId, callback) {
        const q = query(
            collection(db, 'maintenance'),
            where('tenantId', '==', tenantId),
            orderBy('createdAt', 'desc')
        );
        return onSnapshot(q, (snapshot) => {
            const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            callback(requests);
        });
    }
}

DataManager.init();
export default DataManager;
window.DataManager = DataManager;
console.log('DataManager initialized and made global');
