class PredictionCharts {
    constructor(chartsManager) {
        this.chartsManager = chartsManager;
        this.predictionCharts = new Map();
    }

    // Initialize all prediction charts
    async initializePredictionCharts(predictiveData) {
        await this.createRevenueForecastChart(predictiveData.revenueForecast);
        await this.createRevenueForecastMiniChart(predictiveData.revenueForecast);
        this.updatePredictionCards(predictiveData);
    }

    // Revenue forecast with historical data
    async createRevenueForecastChart(revenueData) {
        const ctx = document.getElementById('revenueTrendChart');
        if (!ctx) return;

        // Get historical data for context
        const historicalData = await this.getHistoricalRevenueData();
        
        const historicalLabels = historicalData.map(d => {
            const [year, month] = d.month.split('-');
            return new Date(parseInt(year), parseInt(month)).toLocaleDateString('en-US', { month: 'short' });
        });

        const predictionLabels = revenueData.predictions.map((_, i) => {
            const date = new Date();
            date.setMonth(date.getMonth() + i + 1);
            return date.toLocaleDateString('en-US', { month: 'short' });
        });

        // Destroy existing chart if it exists
        if (this.predictionCharts.has('revenueTrend')) {
            this.predictionCharts.get('revenueTrend').destroy();
        }

        this.predictionCharts.set('revenueTrend', new Chart(ctx, {
            type: 'line',
            data: {
                labels: [...historicalLabels.slice(-6), ...predictionLabels.slice(0, 3)],
                datasets: [
                    {
                        label: 'Historical Revenue',
                        data: [...historicalData.slice(-6).map(d => d.revenue), ...Array(3).fill(null)],
                        borderColor: this.chartsManager.colors.primary,
                        backgroundColor: this.chartsManager.colors.primary + '20',
                        borderWidth: 3,
                        fill: false,
                        tension: 0.4
                    },
                    {
                        label: 'Revenue Forecast',
                        data: [...Array(historicalData.slice(-6).length).fill(null), ...revenueData.predictions.slice(0, 3)],
                        borderColor: this.chartsManager.colors.success,
                        backgroundColor: this.chartsManager.colors.success + '20',
                        borderWidth: 3,
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ₱${context.parsed.y?.toLocaleString() || 'N/A'}`;
                            }
                        }
                    },
                    annotation: {
                        annotations: {
                            forecastLine: {
                                type: 'line',
                                xMin: historicalData.slice(-6).length - 0.5,
                                xMax: historicalData.slice(-6).length - 0.5,
                                borderColor: 'rgba(255, 0, 0, 0.3)',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                label: {
                                    display: true,
                                    content: 'Forecast Start',
                                    position: 'end',
                                    backgroundColor: 'rgba(255, 0, 0, 0.1)'
                                }
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: function(value) {
                                return '₱' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        }));
    }

    // Mini chart for the prediction card
    createRevenueForecastMiniChart(revenueData) {
        const ctx = document.getElementById('revenueForecastMiniChart');
        if (!ctx) return;

        const labels = revenueData.predictions.slice(0, 3).map((_, i) => `M${i + 1}`);
        
        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: revenueData.predictions.slice(0, 3),
                    borderColor: '#2e7d32',
                    backgroundColor: 'rgba(46, 125, 50, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: '#2e7d32'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: false
                    }
                },
                scales: {
                    x: {
                        display: false
                    },
                    y: {
                        display: false
                    }
                }
            }
        });
    }

    // Update the prediction cards with real data
    updatePredictionCards(predictiveData) {
        // Update revenue card
        const nextMonthRevenue = document.getElementById('nextMonthRevenue');
        const revenueGrowthRate = document.getElementById('revenueGrowthRate');
        
        if (nextMonthRevenue) {
            nextMonthRevenue.textContent = predictiveData.revenueForecast.nextMonthPrediction.toLocaleString();
        }
        if (revenueGrowthRate) {
            revenueGrowthRate.textContent = `+${predictiveData.revenueForecast.growthRate}%`;
        }

        // Update occupancy card
        const nextMonthOccupancy = document.getElementById('nextMonthOccupancy');
        const atRiskUnits = document.getElementById('atRiskUnits');
        
        if (nextMonthOccupancy) {
            nextMonthOccupancy.textContent = predictiveData.occupancyTrend.predictions[0];
        }
        if (atRiskUnits) {
            atRiskUnits.textContent = predictiveData.occupancyTrend.atRiskUnits;
        }

        // Update maintenance card
        const nextMonthMaintenance = document.getElementById('nextMonthMaintenance');
        if (nextMonthMaintenance) {
            nextMonthMaintenance.textContent = predictiveData.maintenanceCosts.monthlyPredictions[0].toLocaleString();
        }
    }

    // Helper method to get historical data
    async getHistoricalRevenueData() {
        // This would typically come from your data manager
        // For now, return sample data
        return [
            { month: '2024-1', revenue: 72000 },
            { month: '2024-2', revenue: 78000 },
            { month: '2024-3', revenue: 82000 },
            { month: '2024-4', revenue: 79000 },
            { month: '2024-5', revenue: 86000 },
            { month: '2024-6', revenue: 84500 }
        ];
    }

    // Cleanup method
    destroyAll() {
        this.predictionCharts.forEach(chart => chart.destroy());
        this.predictionCharts.clear();
    }
}

window.PredictionCharts = PredictionCharts;

