class PredictiveAnalytics {
    constructor(dataManager) {
        this.dataManager = dataManager;
    }

    async init() {
        console.log('🔮 Predictive Analytics initialized');
        return this;
    }

    // ===== REVENUE FORECASTING =====
    async predictRevenueForecast(months = 6) {
        try {
            const historicalData = await this.getHistoricalRevenueData();
            
            if (historicalData.length < 3) {
                return this.getFallbackRevenueForecast(months);
            }

            const predictions = this.calculateRevenueForecast(historicalData, months);
            const trend = this.calculateTrend(historicalData);
            const confidence = this.calculateConfidence(historicalData, months);

            return {
                predictions: predictions,
                confidence: confidence,
                trend: trend,
                accuracy: this.calculateModelAccuracy(historicalData),
                nextMonthPrediction: predictions[0],
                growthRate: ((predictions[0] - historicalData[historicalData.length - 1].revenue) / historicalData[historicalData.length - 1].revenue * 100).toFixed(1)
            };
        } catch (error) {
            console.error('Error predicting revenue:', error);
            return this.getFallbackRevenueForecast(months);
        }
    }

    // ===== OCCUPANCY PREDICTION =====
    async predictOccupancyTrend(months = 6) {
        try {
            const leases = await this.dataManager.getLandlordLeases(this.dataManager.currentUser.uid);
            const currentOccupancy = await this.calculateCurrentOccupancy(leases);
            
            const predictions = this.calculateOccupancyPredictions(leases, currentOccupancy, months);
            const riskFactors = this.identifyOccupancyRisks(leases);

            return {
                predictions: predictions,
                currentOccupancy: currentOccupancy,
                riskFactors: riskFactors,
                atRiskUnits: riskFactors.length,
                recommendation: this.generateOccupancyRecommendation(predictions, riskFactors)
            };
        } catch (error) {
            console.error('Error predicting occupancy:', error);
            return this.getFallbackOccupancyPredictions(months);
        }
    }

    // ===== MAINTENANCE FORECASTING =====
    async predictMaintenanceCosts(months = 6) {
        try {
            const maintenanceData = await this.getHistoricalMaintenanceData();
            const predictions = this.calculateMaintenanceForecast(maintenanceData, months);
            
            return {
                monthlyPredictions: predictions,
                seasonalTrend: this.analyzeMaintenanceSeasonality(maintenanceData),
                budgetRecommendation: this.calculateOptimalMaintenanceBudget(predictions),
                highRiskPeriods: this.identifyHighRiskPeriods(predictions)
            };
        } catch (error) {
            console.error('Error predicting maintenance:', error);
            return this.getFallbackMaintenancePredictions(months);
        }
    }

    // ===== CORE ALGORITHMS =====
    calculateRevenueForecast(historicalData, months) {
        const weights = [0.1, 0.2, 0.3, 0.4]; // Weighted moving average
        const predictions = [];
        
        for (let i = 0; i < months; i++) {
            let prediction = 0;
            let totalWeight = 0;
            
            for (let j = 0; j < weights.length; j++) {
                const dataIndex = historicalData.length - weights.length + j;
                if (dataIndex >= 0 && dataIndex < historicalData.length) {
                    prediction += historicalData[dataIndex].revenue * weights[j];
                    totalWeight += weights[j];
                }
            }
            
            // Apply trend
            const trend = this.calculateTrend(historicalData);
            prediction = (prediction / totalWeight) * (1 + trend * (i + 1) * 0.1);
            predictions.push(Math.round(prediction));
        }
        
        return predictions;
    }

    calculateOccupancyPredictions(leases, currentOccupancy, months) {
        const today = new Date();
        const predictions = [];
        
        for (let i = 0; i < months; i++) {
            const futureDate = new Date();
            futureDate.setMonth(today.getMonth() + i + 1);
            
            // Count leases ending in this period
            const endingLeases = leases.filter(lease => {
                const leaseEnd = new Date(lease.leaseEnd);
                const monthDiff = (futureDate.getFullYear() - leaseEnd.getFullYear()) * 12 + 
                                (futureDate.getMonth() - leaseEnd.getMonth());
                return Math.abs(monthDiff) <= 1;
            }).length;
            
            const predictedOccupancy = Math.max(0, currentOccupancy - (endingLeases / leases.length * 100));
            predictions.push(Math.round(predictedOccupancy * 100) / 100);
        }
        
        return predictions;
    }

    calculateMaintenanceForecast(maintenanceData, months) {
        const baseCost = maintenanceData.length > 0 ? 
            maintenanceData.reduce((sum, item) => sum + item.cost, 0) / maintenanceData.length : 2150;
        
        const predictions = [];
        const currentMonth = new Date().getMonth();
        
        for (let i = 0; i < months; i++) {
            const seasonalFactor = this.getSeasonalFactor((currentMonth + i) % 12);
            const predictedCost = baseCost * seasonalFactor * (1 + (i * 0.02));
            predictions.push(Math.round(predictedCost));
        }
        
        return predictions;
    }

    // ===== DATA COLLECTION =====
    async getHistoricalRevenueData() {
        try {
            const payments = await this.dataManager.getPayments(this.dataManager.currentUser.uid);
            const monthlyRevenue = {};
            
            payments.forEach(payment => {
                if (payment.status === 'completed' && payment.paymentDate) {
                    const date = new Date(payment.paymentDate);
                    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
                    
                    monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + (payment.amount || 0);
                }
            });
            
            return Object.entries(monthlyRevenue)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([month, revenue], index) => ({
                    month,
                    revenue,
                    period: index + 1
                }));
        } catch (error) {
            console.error('Error getting historical revenue data:', error);
            return this.generateSampleRevenueData();
        }
    }

    async getHistoricalMaintenanceData() {
        try {
            const maintenance = await this.dataManager.getMaintenanceRequests(this.dataManager.currentUser.uid);
            const monthlyCosts = {};
            
            maintenance.forEach(request => {
                if (request.actualCost && request.completedDate) {
                    const date = new Date(request.completedDate);
                    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
                    monthlyCosts[monthKey] = (monthlyCosts[monthKey] || 0) + request.actualCost;
                }
            });
            
            return Object.entries(monthlyCosts)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([month, cost]) => ({ month, cost }));
        } catch (error) {
            console.error('Error getting maintenance data:', error);
            return this.generateSampleMaintenanceData();
        }
    }

    async calculateCurrentOccupancy(leases) {
        const activeLeases = leases.filter(lease => lease.isActive && lease.status === 'active');
        const totalUnits = 20; // As per your dashboard
        return (activeLeases.length / totalUnits) * 100;
    }

    // ===== UTILITY METHODS =====
    calculateTrend(data) {
        if (data.length < 2) return 0;
        const first = data[0].revenue;
        const last = data[data.length - 1].revenue;
        return (last - first) / first;
    }

    calculateConfidence(data, monthsAhead) {
        const baseConfidence = 0.85;
        const dataQuality = Math.min(1, data.length / 6);
        const timePenalty = monthsAhead * 0.1;
        return Math.max(0.3, baseConfidence * dataQuality - timePenalty);
    }

    calculateModelAccuracy(data) {
        if (data.length < 6) return 0.7;
        return 0.6 + (Math.min(1, data.length / 12) * 0.3);
    }

    getSeasonalFactor(month) {
        // Higher maintenance in certain months
        const seasonalFactors = {
            0: 1.1,  // Jan - post-holiday issues
            1: 1.0,  // Feb
            2: 0.9,  // Mar
            3: 0.9,  // Apr
            4: 1.0,  // May
            5: 1.2,  // Jun - summer, AC issues
            6: 1.3,  // Jul - peak summer
            7: 1.1,  // Aug
            8: 1.0,  // Sep
            9: 0.9,  // Oct
            10: 0.8, // Nov
            11: 1.1  // Dec - winter issues
        };
        return seasonalFactors[month] || 1.0;
    }

    identifyOccupancyRisks(leases) {
        const today = new Date();
        const ninetyDaysFromNow = new Date(today);
        ninetyDaysFromNow.setDate(today.getDate() + 90);
        
        return leases.filter(lease => {
            const leaseEnd = new Date(lease.leaseEnd);
            return leaseEnd <= ninetyDaysFromNow && leaseEnd >= today;
        }).map(lease => ({
            unit: lease.roomNumber,
            tenant: lease.tenantName,
            endDate: lease.leaseEnd,
            daysUntilEnd: Math.ceil((new Date(lease.leaseEnd) - today) / (1000 * 60 * 60 * 24))
        }));
    }

    generateOccupancyRecommendation(predictions, riskFactors) {
        const avgFutureOccupancy = predictions.reduce((a, b) => a + b, 0) / predictions.length;
        
        if (avgFutureOccupancy < 85) return 'High vacancy risk - consider marketing campaigns';
        if (riskFactors.length > 2) return 'Multiple leases ending soon - focus on renewals';
        if (avgFutureOccupancy > 95) return 'Strong occupancy - maintain current strategy';
        return 'Stable occupancy - monitor lease expirations';
    }

    calculateOptimalMaintenanceBudget(predictions) {
        const avgPredicted = predictions.reduce((a, b) => a + b, 0) / predictions.length;
        return Math.round(avgPredicted * 1.2); // 20% buffer
    }

    identifyHighRiskPeriods(predictions) {
        const highThreshold = 2500;
        return predictions
            .map((cost, index) => ({ month: index + 1, cost, isHighRisk: cost > highThreshold }))
            .filter(period => period.isHighRisk);
    }

    // ===== FALLBACK METHODS =====
    getFallbackRevenueForecast(months) {
        const baseRevenue = 84500;
        const predictions = Array(months).fill(0).map((_, i) => 
            Math.round(baseRevenue * (1 + (i * 0.02)))
        );
        
        return {
            predictions,
            confidence: Array(months).fill(0.7),
            trend: 0.02,
            accuracy: 0.75,
            nextMonthPrediction: predictions[0],
            growthRate: '2.0'
        };
    }

    getFallbackOccupancyPredictions(months) {
        return {
            predictions: Array(months).fill(94),
            currentOccupancy: 94,
            riskFactors: [],
            atRiskUnits: 0,
            recommendation: 'Insufficient data for detailed analysis'
        };
    }

    getFallbackMaintenancePredictions(months) {
        return {
            monthlyPredictions: Array(months).fill(2150),
            seasonalTrend: 'stable',
            budgetRecommendation: 2580,
            highRiskPeriods: []
        };
    }

    // ===== SAMPLE DATA GENERATORS =====
    generateSampleRevenueData() {
        const baseRevenue = 72000;
        return Array(6).fill(0).map((_, i) => ({
            month: `2024-${i}`,
            revenue: baseRevenue + (i * 1500) + (Math.random() * 3000 - 1500),
            period: i + 1
        }));
    }

    generateSampleMaintenanceData() {
        const baseCost = 1800;
        return Array(6).fill(0).map((_, i) => ({
            month: `2024-${i}`,
            cost: baseCost + (Math.random() * 800 - 400)
        }));
    }
}

window.PredictiveAnalytics = PredictiveAnalytics;

