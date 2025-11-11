// js/dataManager.js - COMPAT VERSION
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
            const docRef = await firebaseDb.collection('tenants').add({
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

    // Add to js/dataManager.js
    static async getTenantLease(tenantId) {
        try {
            const querySnapshot = await firebaseDb.collection('leases')
                .where('tenantId', '==', tenantId)
                .where('isActive', '==', true)
                .limit(1)
                .get();
            
            if (querySnapshot.empty) {
                return null;
            }
            
            return {
                id: querySnapshot.docs[0].id,
                ...querySnapshot.docs[0].data()
            };
        } catch (error) {
            console.error('Error getting tenant lease:', error);
            return null;
        }
    }

    static async getLandlordLeases(landlordId) {
        try {
            const querySnapshot = await firebaseDb.collection('leases')
                .where('landlordId', '==', landlordId)
                .orderBy('createdAt', 'desc')
                .get();
            
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting landlord leases:', error);
            return [];
        }
    }

    // ===== DASHBOARD STATS =====
    static async getDashboardStats(userId, userRole) {
        console.log(`📊 Getting dashboard stats for ${userRole}: ${userId}`);
        
        if (userRole === 'landlord') {
            // Landlord-specific stats
            const [tenants, bills, maintenance, properties] = await Promise.all([
                this.getTenants(userId),
                this.getBills(userId),
                this.getMaintenanceRequests(userId),
                this.getProperties(userId)
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
            
        } else if (userRole === 'tenant') {
            // Tenant-specific stats
            const [bills, maintenance] = await Promise.all([
                this.getTenantBills(userId),
                this.getTenantMaintenanceRequests(userId)
            ]);

            const unpaidBills = bills.filter(bill => bill.status === 'pending');
            const openMaintenance = maintenance.filter(req => req.status === 'open');
            const nextPayment = bills.find(bill => bill.status === 'pending');

            return {
                unpaidBills: unpaidBills.length,
                openMaintenance: openMaintenance.length,
                nextPaymentDue: nextPayment ? nextPayment.dueDate : null,
                nextPaymentAmount: nextPayment ? nextPayment.totalAmount : 0
            };
        }
        
        return {};
    }

    static listenToDashboardStats(landlordId, callback) {
        const tenantsQuery = firebaseDb.collection('tenants').where('landlordId', '==', landlordId);
        const billsQuery = firebaseDb.collection('bills').where('landlordId', '==', landlordId);
        const maintenanceQuery = firebaseDb.collection('maintenance').where('landlordId', '==', landlordId);
        const propertiesQuery = firebaseDb.collection('properties').where('landlordId', '==', landlordId);

        // Combine multiple real-time listeners
        const unsubscribeFunctions = [
            tenantsQuery.onSnapshot(() => this.updateCombinedStats()),
            billsQuery.onSnapshot(() => this.updateCombinedStats()),
            maintenanceQuery.onSnapshot(() => this.updateCombinedStats()),
            propertiesQuery.onSnapshot(() => this.updateCombinedStats())
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
        try {
            console.log('🔍 DataManager.getTenants called with landlordId:', landlordId);
            
            const querySnapshot = await firebaseDb.collection('users')
                .where('landlordId', '==', landlordId)
                .where('role', '==', 'tenant')
                .get();
            
            const tenants = querySnapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data() 
            }));
            
            console.log('✅ DataManager.getTenants returning:', tenants.length, 'tenants');
            return tenants;
            
        } catch (error) {
            console.error('❌ DataManager.getTenants error:', error);
            return []; // Return empty array instead of throwing
        }
    }

    static async updateTenant(tenantId, updates) {
        await firebaseDb.doc(`tenants/${tenantId}`).update(updates);
    }

    static async deleteTenant(tenantId) {
        await firebaseDb.doc(`tenants/${tenantId}`).delete();
    }

    // ===== BILLS =====
    static async getBills(landlordId) {
        const querySnapshot = await firebaseDb.collection('bills')
            .where('landlordId', '==', landlordId)
            .orderBy('dueDate', 'desc')
            .get();
        return querySnapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
        }));
    }

    static async createBill(billData) {
        const docRef = await firebaseDb.collection('bills').add({
            ...billData,
            createdAt: new Date().toISOString(),
            status: 'pending'
        });
        return docRef.id;
    }

    static async updateBill(billId, updates) {
        await firebaseDb.doc(`bills/${billId}`).update(updates);
    }

    static async deleteBill(billId) {
        await firebaseDb.doc(`bills/${billId}`).delete();
    }

    // ===== MAINTENANCE REQUESTS =====
    static async getMaintenanceRequests(landlordId) {
        const querySnapshot = await firebaseDb.collection('maintenance')
            .where('landlordId', '==', landlordId)
            .orderBy('createdAt', 'desc')
            .get();
        return querySnapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
        }));
    }

    static async updateMaintenance(requestId, updates) {
        await firebaseDb.doc(`maintenance/${requestId}`).update(updates);
    }

    static async submitMaintenanceRequest(requestData) {
        const docRef = await firebaseDb.collection('maintenance').add({
            ...requestData,
            status: 'open',
            priority: 'medium',
            createdAt: new Date().toISOString()
        });
        return docRef.id;
    }

    // ===== PROPERTIES =====
    static async getProperties(landlordId) {
        const querySnapshot = await firebaseDb.collection('properties')
            .where('landlordId', '==', landlordId)
            .get();
        return querySnapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
        }));
    }

    static async addProperty(propertyData) {
        const docRef = await firebaseDb.collection('properties').add({
            ...propertyData,
            createdAt: new Date().toISOString(),
            isActive: true
        });
        return docRef.id;
    }

    static async updateProperty(propertyId, updates) {
        await firebaseDb.doc(`properties/${propertyId}`).update(updates);
    }

    // ===== TENANT-SPECIFIC METHODS =====
    static async getTenantBills(tenantId) {
        const querySnapshot = await firebaseDb.collection('bills')
            .where('tenantId', '==', tenantId)
            .orderBy('dueDate', 'desc')
            .get();
        return querySnapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
        }));
    }

    static async getTenantMaintenanceRequests(tenantId) {
        const querySnapshot = await firebaseDb.collection('maintenance')
            .where('tenantId', '==', tenantId)
            .orderBy('createdAt', 'desc')
            .get();
        return querySnapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
        }));
    }

    static async getTenantProfile(tenantId) {
        try {
            const userDoc = await firebaseDb.collection('tenants').doc(tenantId).get();
            return userDoc.exists ? { 
                id: userDoc.id, 
                ...userDoc.data() 
            } : null;
        } catch (error) {
            console.error('Error getting tenant profile:', error);
            return null;
        }
    }

    static async updateTenantProfile(tenantId, updates) {
        try {
            const docRef = firebaseDb.doc(`tenants/${tenantId}`);
            await docRef.update(updates);
        } catch (error) {
            console.error('Error updating tenant profile:', error);
            throw error;
        }
    }

    // ===== PAYMENT PROCESSING =====
    static async recordPayment(paymentData) {
        const docRef = await firebaseDb.collection('payments').add({
            ...paymentData,
            processedAt: new Date().toISOString(),
            status: 'completed'
        });

        // Update bill status to paid
        if (paymentData.billId) {
            await firebaseDb.doc(`bills/${paymentData.billId}`).update({
                status: 'paid',
                paidDate: new Date().toISOString()
            });
        }

        return docRef.id;
    }

    // ===== REAL-TIME LISTENERS =====
    static listenToBills(landlordId, callback) {
        return firebaseDb.collection('bills')
            .where('landlordId', '==', landlordId)
            .orderBy('dueDate', 'desc')
            .onSnapshot((snapshot) => {
                const bills = snapshot.docs.map(doc => ({ 
                    id: doc.id, 
                    ...doc.data() 
                }));
                callback(bills);
            });
    }

    static listenToTenantBills(tenantId, callback) {
        return firebaseDb.collection('bills')
            .where('tenantId', '==', tenantId)
            .orderBy('dueDate', 'desc')
            .onSnapshot((snapshot) => {
                const bills = snapshot.docs.map(doc => ({ 
                    id: doc.id, 
                    ...doc.data() 
                }));
                callback(bills);
            });
    }

    static listenToTenantMaintenance(tenantId, callback) {
        return firebaseDb.collection('maintenance')
            .where('tenantId', '==', tenantId)
            .orderBy('createdAt', 'desc')
            .onSnapshot((snapshot) => {
                const requests = snapshot.docs.map(doc => ({ 
                    id: doc.id, 
                    ...doc.data() 
                }));
                callback(requests);
            });
    }
}

DataManager.init();
window.DataManager = DataManager;