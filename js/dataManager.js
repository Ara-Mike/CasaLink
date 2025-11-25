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

    async getTenants() {
        if (!this.user) throw new Error('User not authenticated');
        
        try {
            const snapshot = await this.db.collection('tenants')
                .where('landlordId', '==', this.user.uid)
                .get();
            
            const tenants = snapshot.docs.map(doc => {
                const data = doc.data();
                return { ...data, id: doc.id };
            });
            
            console.log('✅ Tenants loaded:', tenants.length);
            return tenants;
        } catch (error) {
            console.error('❌ Error getting tenants:', error);
            return [];
        }
    }

    static async getProperties() {
        if (!this.user) throw new Error('User not authenticated');
        
        try {
            const snapshot = await this.db.collection('properties')
                .where('landlordId', '==', this.user.uid)
                .get();
            
            const properties = snapshot.docs.map(doc => {
                const data = doc.data();
                return { ...data, id: doc.id };
            });
            
            console.log('✅ Properties loaded:', properties.length);
            return properties;
        } catch (error) {
            console.error('❌ Error getting properties:', error);
            return [];
        }
    }

    async getLease() {
        if (!this.user) throw new Error('User not authenticated');
        
        try {
            console.log('🔍 Fetching lease:', leaseId);
            const doc = await this.db.collection('leases').doc(leaseId).get();
            
            if (!doc.exists) {
                throw new Error('Lease not found');
            }
            
            const leaseData = doc.data();
            console.log('✅ Lease data found:', leaseData);
            return leaseData;
        } catch (error) {
            console.error('❌ Error getting lease:', error);
            throw error;
        }
    }

    
    async updateLease(leaseId, updates) {
        if (!this.user) throw new Error('User not authenticated');
        
        await this.db.collection('leases').doc(leaseId).update({
            ...updates,
            updatedAt: new Date().toISOString()
        });
    }
    
    async deleteLease(leaseId) {
        if (!this.user) throw new Error('User not authenticated');
        
        try {
            await this.db.collection('leases').doc(leaseId).delete();
            console.log('✅ Lease deleted:', leaseId);
        } catch (error) {
            console.error('❌ Error deleting lease:', error);
            throw error;
        }
    }

    generateId() {
        return 'lease_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }


    async createLease(leaseData) {
        if (!this.user) throw new Error('User not authenticated');
        
        try {
            const lease = {
                ...leaseData,
                id: this.generateId(),
                landlordId: this.user.uid,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            await this.db.collection('leases').doc(lease.id).set(lease);
            console.log('✅ Lease created:', lease.id);
            return lease;
        } catch (error) {
            console.error('❌ Error creating lease:', error);
            throw error;
        }
    }

    static testDueDateCalculation() {
        const testLease = {
            paymentDueDay: 15, // 15th of each month
            monthlyRent: 5000,
            isActive: true
        };
        
        const testBills = [];
        
        const nextDueDate = this.calculateNextDueDate(testLease, testBills);
        console.log('🧪 Test due date calculation:', {
            paymentDay: testLease.paymentDueDay,
            calculatedDueDate: nextDueDate,
            formattedDate: nextDueDate ? nextDueDate.toLocaleDateString() : 'N/A'
        });
        
        return nextDueDate;
    }

    static async applyLateFees() {
        try {
            const settings = await this.getBillingSettings();
            if (!settings.autoLateFees) {
                console.log('⏸️ Auto late fees disabled');
                return { applied: 0 };
            }

            const today = new Date();
            const lateFeeDate = new Date();
            lateFeeDate.setDate(today.getDate() - settings.lateFeeAfterDays);

            // Find overdue bills without late fees
            const overdueBills = await firebaseDb.collection('bills')
                .where('status', '==', 'pending')
                .where('dueDate', '<=', lateFeeDate.toISOString())
                .where('lateFeeApplied', '==', false)
                .get();

            let appliedCount = 0;
            const batch = firebaseDb.batch();

            overdueBills.forEach(doc => {
                const bill = doc.data();
                const lateFeeItem = {
                    description: `Late Fee (${settings.lateFeeAfterDays} days overdue)`,
                    amount: settings.lateFeeAmount,
                    type: 'late_fee',
                    appliedDate: new Date().toISOString()
                };

                // Update bill with late fee
                const updatedItems = [...(bill.items || []), lateFeeItem];
                const updatedAmount = updatedItems.reduce((sum, item) => sum + item.amount, 0);

                batch.update(doc.ref, {
                    items: updatedItems,
                    totalAmount: updatedAmount,
                    lateFeeApplied: true,
                    lateFeeDate: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });

                appliedCount++;
            });

            if (appliedCount > 0) {
                await batch.commit();
                console.log(`✅ Applied late fees to ${appliedCount} bills`);
            }

            return { applied: appliedCount };
        } catch (error) {
            console.error('Error applying late fees:', error);
            throw error;
        }
    }

    static async createCustomBill(billData) {
        try {
            const billRef = await firebaseDb.collection('bills').add({
                ...billData,
                createdAt: new Date().toISOString(),
                status: 'pending',
                isAutoGenerated: false
            });
            console.log('✅ Custom bill created:', billRef.id);
            return billRef.id;
        } catch (error) {
            console.error('Error creating custom bill:', error);
            throw error;
        }
    }
    
    static async updateBillingSettings(updates) {
        try {
            updates.updatedAt = new Date().toISOString();
            await firebaseDb.collection('billingSettings').doc('default').update(updates);
            console.log('✅ Billing settings updated');
            return true;
        } catch (error) {
            console.error('Error updating billing settings:', error);
            throw error;
        }
    }

    static getOrdinalSuffix(day) {
        if (!day || typeof day !== 'number') return '';
        
        if (day >= 11 && day <= 13) return 'th';
        
        const lastDigit = day % 10;
        switch (lastDigit) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    }

    static async createMaintenanceRequest(requestData) {
        try {
            console.log('🔧 Creating maintenance request:', requestData);
            
            const requestRef = await firebaseDb.collection('maintenance').add({
                ...requestData,
                status: 'open',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            console.log('✅ Maintenance request created:', requestRef.id);
            return requestRef.id;
        } catch (error) {
            console.error('❌ Error creating maintenance request:', error);
            throw error;
        }
    }

    static async getMaintenanceRequests(landlordId, filters = {}) {
        try {
            let query = firebaseDb.collection('maintenance')
                .where('landlordId', '==', landlordId)
                .orderBy('createdAt', 'desc');

            // Apply filters
            if (filters.status) {
                query = query.where('status', '==', filters.status);
            }
            if (filters.priority) {
                query = query.where('priority', '==', filters.priority);
            }
            if (filters.type) {
                query = query.where('type', '==', filters.type);
            }

            const snapshot = await query.get();
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting maintenance requests:', error);
            return [];
        }
    }

    static async getMaintenanceRequest(requestId) {
        try {
            const requestDoc = await firebaseDb.collection('maintenance').doc(requestId).get();
            if (requestDoc.exists) {
                return { id: requestDoc.id, ...requestDoc.data() };
            }
            return null;
        } catch (error) {
            console.error('❌ Error getting maintenance request:', error);
            throw error;
        }
    }

    static async updateMaintenanceRequest(requestId, updates) {
        try {
            updates.updatedAt = new Date().toISOString();
            await firebaseDb.collection('maintenance').doc(requestId).update(updates);
            console.log('✅ Maintenance request updated:', requestId);
            return true;
        } catch (error) {
            console.error('❌ Error updating maintenance request:', error);
            throw error;
        }
    }

    static async getMaintenancePriorities() {
        return [
            { id: 'low', name: 'Low', color: 'var(--success)', icon: 'fas fa-arrow-down' },
            { id: 'medium', name: 'Medium', color: 'var(--warning)', icon: 'fas fa-minus' },
            { id: 'high', name: 'High', color: 'var(--danger)', icon: 'fas fa-arrow-up' },
            { id: 'emergency', name: 'Emergency', color: 'var(--danger)', icon: 'fas fa-exclamation-triangle' }
        ];
    }

    static async getMaintenanceTypes() {
        return [
            { id: 'general', name: 'General Maintenance', icon: 'fas fa-tools' },
            { id: 'plumbing', name: 'Plumbing', icon: 'fas fa-faucet' },
            { id: 'electrical', name: 'Electrical', icon: 'fas fa-bolt' },
            { id: 'hvac', name: 'HVAC', icon: 'fas fa-wind' },
            { id: 'appliance', name: 'Appliance', icon: 'fas fa-blender' },
            { id: 'structural', name: 'Structural', icon: 'fas fa-home' },
            { id: 'pest_control', name: 'Pest Control', icon: 'fas fa-bug' },
            { id: 'other', name: 'Other', icon: 'fas fa-question-circle' }
        ];
    }

    static async getMaintenanceStats(landlordId) {
        try {
            const requests = await this.getMaintenanceRequests(landlordId);
            
            const now = new Date();
            const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
            
            return {
                total: requests.length,
                open: requests.filter(r => r.status === 'open').length,
                inProgress: requests.filter(r => r.status === 'in-progress').length,
                completed: requests.filter(r => r.status === 'completed').length,
                highPriority: requests.filter(r => r.priority === 'high' || r.priority === 'emergency').length,
                recent: requests.filter(r => new Date(r.createdAt) > thirtyDaysAgo).length,
                byType: this.groupBy(requests, 'type'),
                byStatus: this.groupBy(requests, 'status')
            };
        } catch (error) {
            console.error('Error getting maintenance stats:', error);
            return {};
        }
    }

    static async addMaintenanceStaff(staffData) {
        try {
            const staffWithMeta = {
                ...staffData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const docRef = await firebaseDb.collection('maintenanceStaff').add(staffWithMeta);
            console.log('✅ Maintenance staff added:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('Error adding maintenance staff:', error);
            throw error;
        }
    }

    static async getMaintenanceStaff(landlordId) {
        try {
            const snapshot = await firebaseDb.collection('maintenanceStaff')
                .where('landlordId', '==', landlordId)
                .where('isActive', '==', true)
                .get();

            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting maintenance staff:', error);
            return [];
        }
    }

    // Helper method
    static groupBy(array, key) {
        return array.reduce((groups, item) => {
            const val = item[key];
            groups[val] = groups[val] || [];
            groups[val].push(item);
            return groups;
        }, {});
    }

    static maintenanceRequestSchema = {
        id: '', // Firestore document ID
        title: '',
        description: '',
        type: 'general', // general, plumbing, electrical, hvac, appliance, structural, pest_control, other
        priority: 'medium', // low, medium, high, emergency
        status: 'open', // open, in-progress, pending_parts, completed, cancelled
        tenantId: '',
        tenantName: '',
        landlordId: '',
        roomNumber: '',
        images: [], // Array of image URLs
        createdAt: '',
        updatedAt: '',
        assignedTo: '', // Staff/contractor ID
        assignedName: '', // Staff/contractor name
        scheduledDate: '', // For scheduled maintenance
        completedDate: '',
        costEstimate: 0,
        actualCost: 0,
        tenantNotes: '',
        internalNotes: '',
        resolutionNotes: ''
    };

    static maintenanceStaffSchema = {
        id: '',
        name: '',
        email: '',
        phone: '',
        type: 'internal', // internal, external_contractor
        specialty: 'general', // general, plumbing, electrical, etc.
        hourlyRate: 0,
        isActive: true,
        createdAt: '',
        landlordId: ''
    };

    static async createDefaultBillingSettings() {
        const defaultSettings = {
            autoBillingEnabled: true,
            defaultPaymentDay: 5,
            lateFeeAmount: 500,
            gracePeriodDays: 3,
            autoLateFees: true,
            lateFeeAfterDays: 5,
            includeUtilities: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        await firebaseDb.collection('billingSettings').doc('default').set(defaultSettings);
        console.log('✅ Created default billing settings');
        return defaultSettings;
    }

    

    static async getBillingSettings() {
        try {
            console.log('🔄 Loading billing settings...');
            const settingsDoc = await firebaseDb.collection('billingSettings').doc('default').get();
            
            if (settingsDoc.exists) {
                const settings = settingsDoc.data();
                console.log('✅ Billing settings loaded:', settings);
                return settings;
            } else {
                console.log('📝 No billing settings found, creating defaults...');
                return await this.createDefaultBillingSettings();
            }
        } catch (error) {
            console.error('❌ Error getting billing settings:', error);
            // Return default settings even if there's an error
            return {
                autoBillingEnabled: true,
                defaultPaymentDay: 5,
                lateFeeAmount: 500,
                gracePeriodDays: 3,
                autoLateFees: true,
                lateFeeAfterDays: 5
            };
        }
    }


    static async getBillsWithTenants(landlordId) {
        try {
            console.log('💰 Fetching bills with tenant data for landlord:', landlordId);
            
            const billsSnapshot = await firebaseDb.collection('bills')
                .where('landlordId', '==', landlordId)
                .orderBy('dueDate', 'desc')
                .get();
                
            const bills = billsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log(`✅ Found ${bills.length} bills for landlord`);
            return bills;
            
        } catch (error) {
            console.error('❌ Error getting bills with tenants:', error);
            return [];
        }
    }

    static async getActiveLeases() {
        try {
            const querySnapshot = await firebaseDb.collection('leases')
                .where('isActive', '==', true)
                .get();
                
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting active leases:', error);
            return [];
        }
    }

    static async getPaymentStats(landlordId) {
        try {
            const payments = await this.getPayments(landlordId);
            const today = new Date();
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();

            // Filter only completed payments
            const completedPayments = payments.filter(p => p.status === 'completed');

            // Total collected
            const totalCollected = completedPayments.reduce((sum, payment) => sum + payment.amount, 0);

            // This month's collection
            const monthlyPayments = completedPayments.filter(payment => {
                const paymentDate = new Date(payment.paymentDate);
                return paymentDate.getMonth() === currentMonth && 
                    paymentDate.getFullYear() === currentYear;
            });
            const monthlyCollected = monthlyPayments.reduce((sum, payment) => sum + payment.amount, 0);

            // Payment methods count
            const methodCount = new Set(completedPayments.map(p => p.paymentMethod)).size;

            // Average payment
            const averagePayment = completedPayments.length > 0 ? totalCollected / completedPayments.length : 0;

            return {
                totalCollected,
                monthlyCollected,
                methodCount,
                averagePayment,
                totalTransactions: completedPayments.length,
                monthlyTransactions: monthlyPayments.length
            };
        } catch (error) {
            console.error('Error getting payment stats:', error);
            throw error;
        }
    }

    static async getPayments(landlordId, filters = {}) {
        try {
            let query = firebaseDb.collection('payments')
                .where('landlordId', '==', landlordId)
                .orderBy('paymentDate', 'desc');

            // Apply filters
            if (filters.method && filters.method !== 'all') {
                query = query.where('paymentMethod', '==', filters.method);
            }

            if (filters.status && filters.status !== 'all') {
                query = query.where('status', '==', filters.status);
            }

            if (filters.month) {
                const startDate = new Date(filters.month + '-01');
                const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
                
                query = query.where('paymentDate', '>=', startDate.toISOString())
                            .where('paymentDate', '<=', endDate.toISOString());
            }

            const snapshot = await query.get();
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('Error getting payments:', error);
            throw error;
        }
    }

    static async recordPayment(paymentData) {
        try {
            console.log('💳 Recording payment:', paymentData);
            
            const paymentRef = await firebaseDb.collection('payments').add({
                ...paymentData,
                processedAt: new Date().toISOString(),
                status: 'completed'
            });

            // Update bill status
            if (paymentData.billId) {
                await firebaseDb.collection('bills').doc(paymentData.billId).update({
                    status: 'paid',
                    paidDate: new Date().toISOString(),
                    paymentMethod: paymentData.paymentMethod,
                    paymentReference: paymentData.referenceNumber
                });
            }

            console.log('✅ Payment recorded successfully');
            return paymentRef.id;
            
        } catch (error) {
            console.error('❌ Error recording payment:', error);
            throw error;
        }
    }

    static async getTenantPayments(tenantId) {
        try {
            console.log('💰 Fetching payments for tenant:', tenantId);
            
            const querySnapshot = await firebaseDb.collection('payments')
                .where('tenantId', '==', tenantId)
                .orderBy('paymentDate', 'desc')
                .get();
            
            const payments = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            console.log('✅ Fetched', payments.length, 'payments for tenant');
            return payments;
            
        } catch (error) {
            console.error('❌ Error getting tenant payments:', error);
            return [];
        }
    }

    static async getPaymentMethods() {
        return [
            { id: 'cash', name: 'Cash', icon: 'fas fa-money-bill' },
            { id: 'gcash', name: 'GCash', icon: 'fas fa-mobile-alt' },
            { id: 'maya', name: 'Maya', icon: 'fas fa-wallet' },
            { id: 'bank_transfer', name: 'Bank Transfer', icon: 'fas fa-university' },
            { id: 'check', name: 'Check', icon: 'fas fa-money-check' }
        ];
    }

    static async generateMonthlyBills() {
        try {
            console.log('💰 Generating monthly bills for all active leases...');
            
            const leases = await this.getActiveLeases();
            const today = new Date();
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();
            const settings = await this.getBillingSettings();
            
            let generatedCount = 0;
            let skippedCount = 0;
            
            const billPromises = leases.map(async (lease) => {
                // Enhanced validation
                if (!lease.isActive) {
                    skippedCount++;
                    return;
                }
                
                if (!lease.monthlyRent || lease.monthlyRent <= 0) {
                    console.warn(`⚠️ Skipping ${lease.tenantName}: Invalid rent amount`);
                    skippedCount++;
                    return;
                }
                
                // Check for existing bill this month
                const existingBill = await firebaseDb.collection('bills')
                    .where('tenantId', '==', lease.tenantId)
                    .where('dueDate', '>=', new Date(currentYear, currentMonth, 1).toISOString())
                    .where('dueDate', '<=', new Date(currentYear, currentMonth + 1, 0).toISOString())
                    .limit(1)
                    .get();
                    
                if (existingBill.empty) {
                    const paymentDay = lease.paymentDueDay || settings?.defaultPaymentDay || 5;
                    const dueDate = new Date(currentYear, currentMonth, paymentDay);
                    
                    // FIXED: Use consistent description format
                    const billData = {
                        tenantId: lease.tenantId,
                        landlordId: lease.landlordId,
                        tenantName: lease.tenantName,
                        roomNumber: lease.roomNumber,
                        type: 'rent',
                        description: `Rent - ${today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
                        totalAmount: lease.monthlyRent,
                        dueDate: dueDate.toISOString(),
                        status: 'pending',
                        createdAt: new Date().toISOString(),
                        isAutoGenerated: true,
                        items: [
                            {
                                description: 'Monthly Rent',
                                amount: lease.monthlyRent,
                                type: 'rent'
                            }
                        ]
                    };
                    
                    await firebaseDb.collection('bills').add(billData);
                    generatedCount++;
                    console.log(`✅ Generated bill for ${lease.tenantName} (Due: ${paymentDay}${this.getOrdinalSuffix(paymentDay)})`);
                } else {
                    skippedCount++;
                }
            });
            
            await Promise.all(billPromises);
            
            console.log(`✅ Monthly bills generation completed: ${generatedCount} generated, ${skippedCount} skipped`);
            return {
                generated: generatedCount,
                skipped: skippedCount,
                total: leases.length
            };
            
        } catch (error) {
            console.error('❌ Error generating monthly bills:', error);
            throw error;
        }
    }

    static calculateLandlordStats(tenants, leases, bills, maintenance) {
        console.log('🧮 Calculating landlord statistics...');
        
        // PROPERTY OVERVIEW
        const totalUnits = 22; // Fixed total units as per your structure
        
        // Active leases (both isActive and status check)
        const activeLeases = leases.filter(lease => 
            lease.isActive !== false && 
            (lease.status === 'active' || lease.status === 'verified' || !lease.status)
        );
        
        const occupiedUnits = activeLeases.length;
        const vacantUnits = Math.max(0, totalUnits - occupiedUnits);
        const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
        
        // Total tenants (active and verified)
        const activeTenants = tenants.filter(tenant => 
            tenant.isActive !== false && 
            (tenant.status === 'verified' || tenant.status === 'active' || !tenant.status)
        ).length;
        
        // Average monthly rent (only from active leases with rent amount)
        const leasesWithRent = activeLeases.filter(lease => lease.monthlyRent && lease.monthlyRent > 0);
        const totalRent = leasesWithRent.reduce((sum, lease) => sum + (lease.monthlyRent || 0), 0);
        const averageRent = leasesWithRent.length > 0 ? Math.round(totalRent / leasesWithRent.length) : 0;
        
        // FINANCIAL OVERVIEW
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        
        // Monthly revenue (paid bills this month)
        const monthlyRevenue = bills
            .filter(bill => {
                if (bill.status !== 'paid') return false;
                const billDate = new Date(bill.paidDate || bill.dueDate);
                return billDate.getMonth() === currentMonth && 
                    billDate.getFullYear() === currentYear;
            })
            .reduce((total, bill) => total + (bill.totalAmount || 0), 0);
        
        // Rent collection rate (percentage of expected rent collected this month)
        const expectedMonthlyRent = totalRent; // Total rent from all active leases
        const collectionRate = expectedMonthlyRent > 0 ? 
            Math.round((monthlyRevenue / expectedMonthlyRent) * 100) : 0;
        
        // Late payments (bills overdue)
        const latePayments = bills.filter(bill => 
            bill.status === 'pending' && 
            new Date(bill.dueDate) < today
        ).length;
        
        // Unpaid bills (all pending bills)
        const unpaidBills = bills.filter(bill => bill.status === 'pending').length;
        
        // OPERATIONS
        // Lease renewals (leases ending in next 30 days)
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        
        const upcomingRenewals = leases.filter(lease => {
            if (!lease.leaseEnd || !lease.isActive) return false;
            const leaseEnd = new Date(lease.leaseEnd);
            return leaseEnd <= thirtyDaysFromNow && leaseEnd >= today;
        }).length;
        
        // Open maintenance (new requests)
        const openMaintenance = maintenance.filter(req => 
            req.status === 'open' || !req.status
        ).length;
        
        // Maintenance backlog (all pending maintenance)
        const maintenanceBacklog = maintenance.filter(req => 
            ['open', 'in-progress'].includes(req.status) || !req.status
        ).length;
        
        const stats = {
            // Property Overview
            totalTenants: activeTenants,
            totalUnits: totalUnits,
            occupiedUnits: occupiedUnits,
            vacantUnits: vacantUnits,
            occupancyRate: occupancyRate,
            averageRent: averageRent,
            
            // Financial Overview
            collectionRate: collectionRate,
            totalRevenue: monthlyRevenue,
            latePayments: latePayments,
            unpaidBills: unpaidBills,
            
            // Operations
            upcomingRenewals: upcomingRenewals,
            openMaintenance: openMaintenance,
            maintenanceBacklog: maintenanceBacklog
        };
        
        console.log('📊 Calculated landlord stats:', stats);
        return stats;
    }

    // ===== DASHBOARD STATISTICS METHODS =====
    static async getDashboardStats(userId, userRole) {
        console.log(`📊 Getting dashboard stats for ${userRole}: ${userId}`);
        
        try {
            if (userRole === 'landlord') {
                // Fetch all necessary data in parallel
                const [tenants, leases, bills, maintenanceRequests] = await Promise.all([
                    this.getTenants(userId),
                    this.getLandlordLeases(userId),
                    this.getBills(userId),
                    this.getMaintenanceRequests(userId)
                ]);

                console.log('📦 Fetched data counts:', {
                    tenants: tenants.length,
                    leases: leases.length,
                    bills: bills.length,
                    maintenance: maintenanceRequests.length
                });

                // Calculate statistics
                const stats = this.calculateLandlordStats(tenants, leases, bills, maintenanceRequests);
                console.log('✅ Calculated dashboard stats:', stats);
                return stats;
                
            } else {
                // Tenant-specific stats (keep existing tenant logic)
                const [bills, maintenance, lease] = await Promise.all([
                    this.getTenantBills(userId),
                    this.getTenantMaintenanceRequests(userId),
                    this.getTenantLease(userId)
                ]);

                if (lease && lease.isActive) {
                    await this.generateMonthlyBillsForTenant(userId, lease);
                    const updatedBills = await this.getTenantBills(userId);
                    // Use updatedBills for calculations...
                }

                const unpaidBills = bills.filter(bill => bill.status === 'pending');
                const totalDue = unpaidBills.reduce((sum, bill) => sum + (bill.totalAmount || 0), 0);
                
                const nextDueDate = this.calculateNextDueDate(lease, bills);
                const openMaintenance = maintenance.filter(req => 
                    ['open', 'in-progress'].includes(req.status)
                );

                return {
                    totalDue: totalDue,
                    nextDueDate: nextDueDate,
                    paymentStatus: unpaidBills.length > 0 ? 'pending' : 'current',
                    roomNumber: lease?.roomNumber || 'N/A',
                    monthlyRent: lease?.monthlyRent || 0,
                    unpaidBills: unpaidBills.length,
                    lastPaymentAmount: this.getLastPaymentAmount(bills),
                    lastPaymentDate: this.getLastPaymentDate(bills),
                    openMaintenance: openMaintenance.length,
                    recentUpdates: maintenance.filter(req => 
                        new Date(req.updatedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    ).length,
                    lease: lease
                };
            }
            
        } catch (error) {
            console.error('❌ Dashboard stats error:', error);
            return this.getFallbackStats(userRole);
        }
    }


    static calculateNextDueDate(lease, bills) {
        if (!lease) return null;
        
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();
        
        // Get payment day from lease (e.g., 5th, 10th, 15th, etc.)
        const paymentDay = lease.paymentDueDay || 1; // Default to 1st if not specified
        
        // Calculate due date for current month
        const dueDateThisMonth = new Date(currentYear, currentMonth, paymentDay);
        
        // If today is after the due date this month, calculate for next month
        let nextDueDate = today <= dueDateThisMonth ? dueDateThisMonth : new Date(currentYear, currentMonth + 1, paymentDay);
        
        // Check if there are any unpaid bills that might affect the next due date
        const unpaidBills = bills.filter(bill => bill.status === 'pending');
        if (unpaidBills.length > 0) {
            // If there are unpaid bills, use the earliest unpaid bill's due date
            const earliestUnpaid = unpaidBills.reduce((earliest, bill) => {
                const billDate = new Date(bill.dueDate);
                return (!earliest || billDate < earliest) ? billDate : earliest;
            }, null);
            
            if (earliestUnpaid && earliestUnpaid < nextDueDate) {
                nextDueDate = earliestUnpaid;
            }
        }
        
        return nextDueDate;
    }



    static getFallbackStats(userRole) {
        if (userRole === 'tenant') {
            return {
                totalDue: 0,
                nextDueDate: null,
                paymentStatus: 'current',
                roomNumber: 'N/A',
                monthlyRent: 0,
                unpaidBills: 0,
                lastPaymentAmount: 0,
                lastPaymentDate: null,
                openMaintenance: 0,
                recentUpdates: 0
            };
        } else {
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
    }

    static getLastPaymentAmount(bills) {
        const paidBills = bills.filter(bill => bill.status === 'paid');
        return paidBills.length > 0 ? paidBills[0].totalAmount : 0;
    }

    static getLastPaymentDate(bills) {
        const paidBills = bills.filter(bill => bill.status === 'paid');
        return paidBills.length > 0 ? paidBills[0].paidDate : null;
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
                
                // Add missing fields with default values
                if (leaseData.isActive === undefined) updates.isActive = true;
                if (!leaseData.status) updates.status = 'active';
                if (!leaseData.monthlyRent) updates.monthlyRent = 0;
                if (!leaseData.leaseEnd) {
                    updates.leaseEnd = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
                }
                if (!leaseData.roomNumber) updates.roomNumber = 'N/A';
                
                // Ensure payment due day is set (default to 1st of month)
                if (!leaseData.paymentDueDay) updates.paymentDueDay = 1;
                
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

    static async generateMonthlyBillsForTenant(tenantId, lease) {
        try {
            if (!lease || !lease.isActive) return;
            
            const today = new Date();
            const currentMonth = today.getMonth();
            const currentYear = today.getFullYear();
            const paymentDay = lease.paymentDueDay || 1;
            
            // Calculate due date for this month
            const dueDate = new Date(currentYear, currentMonth, paymentDay);
            
            // Check if bill already exists for this month
            const existingBill = await firebaseDb.collection('bills')
                .where('tenantId', '==', tenantId)
                .where('dueDate', '>=', new Date(currentYear, currentMonth, 1).toISOString())
                .where('dueDate', '<=', new Date(currentYear, currentMonth + 1, 0).toISOString())
                .limit(1)
                .get();
                
            if (existingBill.empty) {
                // Create new bill for this month
                const billData = {
                    tenantId: tenantId,
                    landlordId: lease.landlordId,
                    tenantName: lease.tenantName,
                    roomNumber: lease.roomNumber,
                    type: 'rent',
                    totalAmount: lease.monthlyRent,
                    dueDate: dueDate.toISOString(),
                    status: 'pending',
                    description: `Monthly Rent - ${today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
                    createdAt: new Date().toISOString()
                };
                
                await firebaseDb.collection('bills').add(billData);
                console.log(`✅ Generated monthly bill for ${lease.tenantName}`);
            }
            
        } catch (error) {
            console.error('Error generating monthly bill:', error);
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

    async getTenants() {
        if (!this.user) throw new Error('User not authenticated');
        
        try {
            const snapshot = await this.db.collection('tenants')
                .where('landlordId', '==', this.user.uid)
                .get();
            
            const tenants = snapshot.docs.map(doc => {
                const data = doc.data();
                return { ...data, id: doc.id };
            });
            
            console.log('✅ Tenants loaded:', tenants.length);
            return tenants;
        } catch (error) {
            console.error('❌ Error getting tenants:', error);
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
            
            const leaseData = querySnapshot.docs[0].data();
            
            // RETURN ALL FIELDS including occupants and totalOccupants
            return {
                id: querySnapshot.docs[0].id,
                // Basic lease info
                tenantId: leaseData.tenantId,
                landlordId: leaseData.landlordId,
                tenantName: leaseData.tenantName,
                
                // Property info
                roomNumber: leaseData.roomNumber,
                rentalAddress: leaseData.rentalAddress,
                
                // Financial terms
                monthlyRent: leaseData.monthlyRent,
                securityDeposit: leaseData.securityDeposit,
                paymentMethod: leaseData.paymentMethod,
                paymentDueDay: leaseData.paymentDueDay,
                
                // Lease period
                leaseStart: leaseData.leaseStart,
                leaseEnd: leaseData.leaseEnd,
                leaseDuration: leaseData.leaseDuration,
                
                // Occupancy information - MAKE SURE THESE ARE INCLUDED
                maxOccupants: leaseData.maxOccupants,
                occupants: leaseData.occupants, // THIS WAS MISSING
                totalOccupants: leaseData.totalOccupants, // THIS WAS MISSING
                
                // Status
                status: leaseData.status,
                isActive: leaseData.isActive,
                
                // Agreement tracking
                agreementViewed: leaseData.agreementViewed,
                agreementAccepted: leaseData.agreementAccepted,
                agreementAcceptedDate: leaseData.agreementAcceptedDate,
                
                // Additional terms
                maxOccupants: leaseData.maxOccupants,
                additionalOccupantFee: leaseData.additionalOccupantFee,
                
                // Dates
                createdAt: leaseData.createdAt,
                updatedAt: leaseData.updatedAt
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
        try {
            console.log('💰 Fetching bills for tenant:', tenantId);
            
            const querySnapshot = await firebaseDb.collection('bills')
                .where('tenantId', '==', tenantId)
                .orderBy('dueDate', 'desc')
                .get();
            
            const bills = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            console.log('✅ Fetched', bills.length, 'bills for tenant');
            return bills;
            
        } catch (error) {
            console.error('❌ Error getting tenant bills:', error);
            return [];
        }
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
            console.log('📋 Fetching tenant profile:', tenantId);
            
            const userDoc = await firebaseDb.collection('users').doc(tenantId).get();
            
            if (!userDoc.exists) {
                console.warn('⚠️ Tenant profile not found');
                return null;
            }

            const profileData = userDoc.data();
            console.log('✅ Tenant profile loaded');
            
            return {
                id: userDoc.id,
                ...profileData
            };

        } catch (error) {
            console.error('❌ Error fetching tenant profile:', error);
            throw error;
        }
    }

    static async updateTenantProfile(tenantId, updates) {
        try {
            console.log('💾 Updating tenant profile:', tenantId);
            
            await firebaseDb.collection('users').doc(tenantId).update({
                ...updates,
                updatedAt: new Date().toISOString()
            });

            console.log('✅ Tenant profile updated');
            return true;

        } catch (error) {
            console.error('❌ Error updating tenant profile:', error);
            throw error;
        }
    }
}

const dataManager = new DataManager();
if (typeof dataManager.init === 'function') dataManager.init();
window.DataManager = dataManager;