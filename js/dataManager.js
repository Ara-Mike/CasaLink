// js/dataManager.js - CLEANED & ORGANIZED VERSION
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
        
        console.log('✅ DataManager initialized');
    }

    // ===== DASHBOARD STATISTICS METHODS =====
    static async getDashboardStats(userId, userRole) {
        console.log(`📊 Getting dashboard stats for ${userRole}: ${userId}`);
        
        try {
            const [tenants, bills, leases, maintenance] = await Promise.all([
                this.getTenants(userId),
                this.getBills(userId),
                this.getLandlordLeases(userId),
                this.getMaintenanceRequests(userId)
            ]);

            const TOTAL_UNITS = 22; // Fixed capacity: 1A-1E, 2A-2E, 3A-3E, 4A-4E, 5A-5B
            
            // Active tenants with verified leases
            const activeTenants = tenants.filter(t => 
                t.isActive && t.status === 'verified' && t.leaseId
            );
            
            const occupiedUnits = activeTenants.length;
            const vacantUnits = TOTAL_UNITS - occupiedUnits;
            const occupancyRate = Math.round((occupiedUnits / TOTAL_UNITS) * 100);

            // Rent calculations
            const averageRent = this.calculateAverageRent(leases);

            // Current month bills (rent collection)
            const currentMonth = new Date().getMonth();
            const currentYear = new Date().getFullYear();
            const currentMonthBills = bills.filter(bill => {
                const billDate = new Date(bill.dueDate);
                return billDate.getMonth() === currentMonth && 
                       billDate.getFullYear() === currentYear &&
                       bill.type === 'rent';
            });
            
            const paidBills = currentMonthBills.filter(bill => bill.status === 'paid');
            const collectionRate = currentMonthBills.length > 0 ? 
                Math.round((paidBills.length / currentMonthBills.length) * 100) : 100;

            // Late payments (overdue rent)
            const latePayments = bills.filter(bill => 
                bill.status === 'pending' && 
                new Date(bill.dueDate) < new Date() &&
                bill.type === 'rent'
            ).length;

            // Upcoming renewals (next 30 days)
            const upcomingRenewals = leases.filter(lease => {
                if (!lease.isActive) return false;
                const daysUntilEnd = Math.ceil((new Date(lease.leaseEnd) - new Date()) / (1000 * 60 * 60 * 24));
                return daysUntilEnd <= 30 && daysUntilEnd > 0;
            }).length;

            // Maintenance backlog (beyond open status)
            const maintenanceBacklog = maintenance.filter(req => 
                ['pending', 'in-progress', 'assigned'].includes(req.status)
            ).length;

            return {
                totalTenants: activeTenants.length,
                totalUnits: TOTAL_UNITS,
                occupiedUnits,
                vacantUnits,
                occupancyRate,
                averageRent,
                collectionRate,
                latePayments,
                upcomingRenewals,
                maintenanceBacklog,
                unpaidBills: bills.filter(bill => bill.status === 'pending').length,
                openMaintenance: maintenance.filter(req => req.status === 'open').length,
                totalRevenue: this.calculateMonthlyRevenue(bills)
            };
            
        } catch (error) {
            console.error('Dashboard stats error:', error);
            return this.getFallbackStats();
        }
    }

    static calculateMonthlyRevenue(bills) {
        try {
            const currentMonth = new Date().getMonth();
            const currentYear = new Date().getFullYear();
            
            const monthlyRevenue = bills
                .filter(bill => {
                    if (bill.status !== 'paid') return false;
                    const billDate = new Date(bill.paidDate || bill.dueDate);
                    return billDate.getMonth() === currentMonth && 
                           billDate.getFullYear() === currentYear;
                })
                .reduce((total, bill) => total + (bill.totalAmount || 0), 0);
                
            return monthlyRevenue;
        } catch (error) {
            console.error('Error calculating monthly revenue:', error);
            return 0;
        }
    }

    static calculateAverageRent(leases) {
        try {
            const activeLeases = leases.filter(lease => 
                lease.isActive && lease.status === 'active' && lease.monthlyRent
            );
            
            if (activeLeases.length === 0) return 0;
            
            const totalRent = activeLeases.reduce((sum, lease) => sum + (lease.monthlyRent || 0), 0);
            return totalRent / activeLeases.length;
        } catch (error) {
            console.error('Error calculating average rent:', error);
            return 0;
        }
    }

    static getFallbackStats() {
        console.log('🔄 Using fallback dashboard stats');
        return {
            totalTenants: 0,
            totalUnits: 22,
            occupiedUnits: 0,
            vacantUnits: 22,
            occupancyRate: 0,
            averageRent: 0,
            collectionRate: 0,
            latePayments: 0,
            upcomingRenewals: 0,
            maintenanceBacklog: 0,
            unpaidBills: 0,
            openMaintenance: 0,
            totalRevenue: 0
        };
    }

    // ===== DATABASE VALIDATION & SETUP =====
    static async validateAndSetupDatabase() {
        console.log('🔍 Validating Firestore database structure...');
        
        try {
            // First, migrate existing data
            await this.migrateExistingUsers();
            await this.migrateExistingLeases();
            
            const collections = ['users', 'leases', 'bills', 'maintenance'];
            const requiredFields = {
                users: ['isActive', 'status', 'leaseId', 'roomNumber'],
                leases: ['isActive', 'status', 'monthlyRent', 'leaseEnd', 'roomNumber'],
                bills: ['status', 'dueDate', 'type', 'totalAmount'],
                maintenance: ['status']
            };

            for (const collection of collections) {
                await this.validateCollection(collection, requiredFields[collection] || []);
            }
            
            console.log('✅ Database validation and migration completed');
            return true;
            
        } catch (error) {
            console.error('❌ Database validation failed:', error);
            return false;
        }
    }

    static async validateCollection(collectionName, requiredFields) {
        console.log(`📋 Validating ${collectionName} collection...`);
        
        try {
            const snapshot = await firebaseDb.collection(collectionName).limit(1).get();
            
            if (snapshot.empty) {
                console.log(`➡️ ${collectionName} collection is empty, creating sample document...`);
                await this.createSampleDocument(collectionName);
            } else {
                console.log(`✅ ${collectionName} collection exists, checking fields...`);
                const doc = snapshot.docs[0];
                const data = doc.data();
                await this.validateDocumentFields(collectionName, doc.id, data, requiredFields);
            }
            
        } catch (error) {
            if (error.code === 'permission-denied') {
                console.log(`⚠️ Cannot access ${collectionName} collection (permission denied)`);
            } else {
                console.error(`❌ Error validating ${collectionName}:`, error);
            }
        }
    }

    static async validateDocumentFields(collectionName, docId, data, requiredFields) {
        const missingFields = requiredFields.filter(field => !data.hasOwnProperty(field));
        
        if (missingFields.length > 0) {
            console.log(`➡️ Adding missing fields to ${collectionName}/${docId}:`, missingFields);
            
            const updates = {};
            missingFields.forEach(field => {
                updates[field] = this.getDefaultValue(collectionName, field);
            });
            
            try {
                await firebaseDb.collection(collectionName).doc(docId).update(updates);
                console.log(`✅ Added missing fields to ${collectionName}/${docId}`);
            } catch (updateError) {
                console.warn(`⚠️ Could not update ${collectionName}/${docId}:`, updateError);
            }
        } else {
            console.log(`✅ ${collectionName} has all required fields`);
        }
    }

    static getDefaultValue(collectionName, field) {
        const defaults = {
            users: {
                isActive: true,
                status: 'active',
                leaseId: null,
                roomNumber: 'N/A'
            },
            leases: {
                isActive: true,
                status: 'active',
                monthlyRent: 0,
                leaseEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                roomNumber: 'N/A'
            },
            bills: {
                status: 'pending',
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                type: 'rent',
                totalAmount: 0
            },
            maintenance: {
                status: 'open'
            }
        };
        
        return defaults[collectionName]?.[field] ?? null;
    }

    static async createSampleDocument(collectionName) {
        const sampleData = {
            users: {
                email: 'sample@example.com',
                name: 'Sample User',
                role: 'tenant',
                isActive: true,
                status: 'active',
                leaseId: null,
                roomNumber: '1A',
                createdAt: new Date().toISOString()
            },
            leases: {
                tenantId: 'sample-tenant-id',
                landlordId: 'sample-landlord-id',
                tenantName: 'Sample Tenant',
                roomNumber: '1A',
                monthlyRent: 5000,
                securityDeposit: 5000,
                leaseStart: new Date().toISOString(),
                leaseEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                isActive: true,
                status: 'active',
                createdAt: new Date().toISOString()
            },
            bills: {
                tenantId: 'sample-tenant-id',
                landlordId: 'sample-landlord-id',
                tenantName: 'Sample Tenant',
                roomNumber: '1A',
                type: 'rent',
                totalAmount: 5000,
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                status: 'pending',
                createdAt: new Date().toISOString(),
                description: 'Monthly Rent'
            },
            maintenance: {
                tenantId: 'sample-tenant-id',
                landlordId: 'sample-landlord-id',
                tenantName: 'Sample Tenant',
                roomNumber: '1A',
                type: 'repair',
                title: 'Sample Maintenance Request',
                description: 'This is a sample maintenance request',
                status: 'open',
                priority: 'medium',
                createdAt: new Date().toISOString()
            }
        };

        try {
            const docRef = await firebaseDb.collection(collectionName).add(sampleData[collectionName]);
            console.log(`✅ Created sample document in ${collectionName} with ID: ${docRef.id}`);
            return docRef.id;
        } catch (error) {
            console.error(`❌ Failed to create sample document in ${collectionName}:`, error);
            throw error;
        }
    }

    static async migrateExistingUsers() {
        console.log('🔄 Migrating existing user documents...');
        
        try {
            const usersSnapshot = await firebaseDb.collection('users').get();
            const migrationPromises = [];
            
            usersSnapshot.forEach(doc => {
                const userData = doc.data();
                const updates = {};
                
                if (userData.isActive === undefined) updates.isActive = true;
                if (!userData.status) updates.status = 'active';
                if (!userData.leaseId) updates.leaseId = null;
                if (!userData.roomNumber) updates.roomNumber = 'N/A';
                
                if (Object.keys(updates).length > 0) {
                    migrationPromises.push(
                        firebaseDb.collection('users').doc(doc.id).update(updates)
                    );
                }
            });
            
            await Promise.all(migrationPromises);
            console.log(`✅ Migrated ${migrationPromises.length} user documents`);
            
        } catch (error) {
            console.error('❌ User migration failed:', error);
        }
    }

    static async migrateExistingLeases() {
        console.log('🔄 Migrating existing lease documents...');
        
        try {
            const leasesSnapshot = await firebaseDb.collection('leases').get();
            const migrationPromises = [];
            
            leasesSnapshot.forEach(doc => {
                const leaseData = doc.data();
                const updates = {};
                
                if (leaseData.isActive === undefined) updates.isActive = true;
                if (!leaseData.status) updates.status = 'active';
                if (!leaseData.monthlyRent) updates.monthlyRent = 0;
                if (!leaseData.leaseEnd) {
                    updates.leaseEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
                }
                if (!leaseData.roomNumber) updates.roomNumber = 'N/A';
                
                if (Object.keys(updates).length > 0) {
                    migrationPromises.push(
                        firebaseDb.collection('leases').doc(doc.id).update(updates)
                    );
                }
            });
            
            await Promise.all(migrationPromises);
            console.log(`✅ Migrated ${migrationPromises.length} lease documents`);
            
        } catch (error) {
            console.error('❌ Lease migration failed:', error);
        }
    }

    // ===== CORE DATA METHODS =====
    static async getTenants(landlordId) {
        try {
            const querySnapshot = await firebaseDb.collection('users')
                .where('landlordId', '==', landlordId)
                .where('role', '==', 'tenant')
                .get();
            
            return querySnapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data() 
            }));
        } catch (error) {
            console.error('❌ DataManager.getTenants error:', error);
            return [];
        }
    }

    static async getLandlordLeases(landlordId) {
        try {
            const querySnapshot = await firebaseDb.collection('leases')
                .where('landlordId', '==', landlordId)
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

    static async getMaintenanceRequests(landlordId) {
        try {
            const querySnapshot = await firebaseDb.collection('maintenance')
                .where('landlordId', '==', landlordId)
                .get();
            
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting maintenance requests:', error);
            return [];
        }
    }

    static async getBills(landlordId) {
        try {
            const querySnapshot = await firebaseDb.collection('bills')
                .where('landlordId', '==', landlordId)
                .get();
            
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting bills:', error);
            return [];
        }
    }

    static async getTenantLease(tenantId) {
        try {
            const querySnapshot = await firebaseDb.collection('leases')
                .where('tenantId', '==', tenantId)
                .where('isActive', '==', true)
                .limit(1)
                .get();
            
            if (querySnapshot.empty) return null;
            
            return {
                id: querySnapshot.docs[0].id,
                ...querySnapshot.docs[0].data()
            };
        } catch (error) {
            console.error('Error getting tenant lease:', error);
            return null;
        }
    }

    // ===== CRUD OPERATIONS =====
    static async addTenant(tenantData) {
        if (!this.isOnline) {
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

    static async createBill(billData) {
        const docRef = await firebaseDb.collection('bills').add({
            ...billData,
            createdAt: new Date().toISOString(),
            status: 'pending'
        });
        return docRef.id;
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

    static async recordPayment(paymentData) {
        const docRef = await firebaseDb.collection('payments').add({
            ...paymentData,
            processedAt: new Date().toISOString(),
            status: 'completed'
        });

        if (paymentData.billId) {
            await firebaseDb.doc(`bills/${paymentData.billId}`).update({
                status: 'paid',
                paidDate: new Date().toISOString()
            });
        }

        return docRef.id;
    }

    // ===== OFFLINE SUPPORT =====
    static storePendingOperation(operation) {
        const pendingOps = JSON.parse(localStorage.getItem('pendingOperations') || '[]');
        pendingOps.push(operation);
        localStorage.setItem('pendingOperations', JSON.stringify(pendingOps));
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

    // ===== REAL-TIME LISTENERS =====
    static listenToBills(landlordId, callback) {
        return firebaseDb.collection('bills')
            .where('landlordId', '==', landlordId)
            .orderBy('dueDate', 'desc')
            .onSnapshot((snapshot) => {
                const bills = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                callback(bills);
            });
    }

    static listenToTenantBills(tenantId, callback) {
        return firebaseDb.collection('bills')
            .where('tenantId', '==', tenantId)
            .orderBy('dueDate', 'desc')
            .onSnapshot((snapshot) => {
                const bills = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                callback(bills);
            });
    }

    static listenToTenantMaintenance(tenantId, callback) {
        return firebaseDb.collection('maintenance')
            .where('tenantId', '==', tenantId)
            .orderBy('createdAt', 'desc')
            .onSnapshot((snapshot) => {
                const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                callback(requests);
            });
    }

    // ===== LEGACY METHODS (Keep for compatibility) =====
    static async updateTenant(tenantId, updates) {
        await firebaseDb.doc(`tenants/${tenantId}`).update(updates);
    }

    static async deleteTenant(tenantId) {
        await firebaseDb.doc(`tenants/${tenantId}`).delete();
    }

    static async updateBill(billId, updates) {
        await firebaseDb.doc(`bills/${billId}`).update(updates);
    }

    static async deleteBill(billId) {
        await firebaseDb.doc(`bills/${billId}`).delete();
    }

    static async updateMaintenance(requestId, updates) {
        await firebaseDb.doc(`maintenance/${requestId}`).update(updates);
    }

    static async getProperties(landlordId) {
        const querySnapshot = await firebaseDb.collection('properties')
            .where('landlordId', '==', landlordId)
            .get();
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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

    static async getTenantBills(tenantId) {
        const querySnapshot = await firebaseDb.collection('bills')
            .where('tenantId', '==', tenantId)
            .orderBy('dueDate', 'desc')
            .get();
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    static async getTenantMaintenanceRequests(tenantId) {
        const querySnapshot = await firebaseDb.collection('maintenance')
            .where('tenantId', '==', tenantId)
            .orderBy('createdAt', 'desc')
            .get();
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    static async getTenantProfile(tenantId) {
        try {
            const userDoc = await firebaseDb.collection('tenants').doc(tenantId).get();
            return userDoc.exists ? { id: userDoc.id, ...userDoc.data() } : null;
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
}

DataManager.init();
window.DataManager = DataManager;