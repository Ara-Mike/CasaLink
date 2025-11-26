class ChartsManager {
    constructor() {
        this.charts = {};
        this.colors = {
            primary: '#162660',
            secondary: '#3498db',
            success: '#34A853',
            warning: '#FBBC04',
            danger: '#EA4335',
            info: '#17a2b8',
            purple: '#9334E6',
            teal: '#4ECDC4',
            lightBlue: '#D0E6FD',
            lightGray: '#F4F6F8'
        };
    }

    initializeAllCharts() {
        this.createRevenueTrendChart();
        this.createPaymentMethodsChart();
        this.createRevenuePerUnitChart();
        this.createOccupancyChart();
        this.createLatePaymentsChart();
        this.createMaintenanceCostsChart();
        this.createRetentionChart();
        this.createRentComparisonChart();
    }

    createRevenueTrendChart() {
        const ctx = document.getElementById('revenueTrendChart').getContext('2d');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        this.charts.revenueTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months.slice(0, 6),
                datasets: [
                    {
                        label: 'Monthly Revenue',
                        data: [72000, 78000, 82000, 79000, 86000, 84500],
                        borderColor: this.colors.primary,
                        backgroundColor: this.colors.primary + '20',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Previous Year',
                        data: [65000, 68000, 72000, 70000, 75000, 73000],
                        borderColor: this.colors.secondary,
                        backgroundColor: this.colors.secondary + '20',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ₱${context.parsed.y.toLocaleString()}`;
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
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                }
            }
        });
    }

    createPaymentMethodsChart() {
        const ctx = document.getElementById('paymentMethodsChart').getContext('2d');
        
        this.charts.paymentMethods = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['GCash', 'Bank Transfer', 'Cash', 'Maya', 'Check'],
                datasets: [{
                    data: [45, 25, 15, 10, 5],
                    backgroundColor: [
                        this.colors.success,
                        this.colors.primary,
                        this.colors.warning,
                        this.colors.purple,
                        this.colors.danger
                    ],
                    borderWidth: 2,
                    borderColor: 'white'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.label}: ${context.parsed}%`;
                            }
                        }
                    }
                },
                cutout: '65%'
            }
        });
    }

    createRevenuePerUnitChart() {
        const ctx = document.getElementById('revenuePerUnitChart').getContext('2d');
        
        this.charts.revenuePerUnit = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Unit 101', 'Unit 102', 'Unit 201', 'Unit 202', 'Unit 301', 'Unit 302'],
                datasets: [{
                    label: 'Monthly Revenue',
                    data: [12500, 11800, 13200, 12700, 14000, 13500],
                    backgroundColor: [
                        this.colors.primary,
                        this.colors.secondary,
                        this.colors.success,
                        this.colors.warning,
                        this.colors.purple,
                        this.colors.teal
                    ],
                    borderWidth: 0,
                    borderRadius: 6
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
                        callbacks: {
                            label: function(context) {
                                return `Revenue: ₱${context.parsed.y.toLocaleString()}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₱' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }

    createOccupancyChart() {
        const ctx = document.getElementById('occupancyChart').getContext('2d');
        
        this.charts.occupancy = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Occupied', 'Vacant'],
                datasets: [{
                    data: [94, 6],
                    backgroundColor: [
                        this.colors.success,
                        this.colors.danger
                    ],
                    borderWidth: 3,
                    borderColor: 'white'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.label}: ${context.parsed}%`;
                            }
                        }
                    }
                },
                cutout: '70%'
            }
        });
    }

    createLatePaymentsChart() {
        const ctx = document.getElementById('latePaymentsChart').getContext('2d');
        
        this.charts.latePayments = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Late Payments',
                    data: [3, 5, 2, 4, 6, 2],
                    backgroundColor: this.colors.danger,
                    borderWidth: 0,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Late Payments'
                        }
                    }
                }
            }
        });
    }

    createMaintenanceCostsChart() {
        const ctx = document.getElementById('maintenanceCostsChart').getContext('2d');
        
        this.charts.maintenanceCosts = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                datasets: [{
                    label: 'Maintenance Costs',
                    data: [1800, 2200, 1500, 1900, 2100, 2150],
                    borderColor: this.colors.warning,
                    backgroundColor: this.colors.warning + '20',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
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
                        callbacks: {
                            label: function(context) {
                                return `Cost: ₱${context.parsed.y.toLocaleString()}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₱' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }

    createRetentionChart() {
        const ctx = document.getElementById('retentionChart').getContext('2d');
        
        this.charts.retention = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Renewed', 'Moved Out'],
                datasets: [{
                    data: [78, 22],
                    backgroundColor: [
                        this.colors.success,
                        this.colors.danger
                    ],
                    borderWidth: 2,
                    borderColor: 'white'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.label}: ${context.parsed}%`;
                            }
                        }
                    }
                },
                cutout: '65%'
            }
        });
    }

    createRentComparisonChart() {
        const ctx = document.getElementById('rentComparisonChart').getContext('2d');
        
        this.charts.rentComparison = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Studio', '1BR', '2BR', '3BR'],
                datasets: [
                    {
                        label: 'Your Rent',
                        data: [12000, 15000, 18000, 22000],
                        backgroundColor: this.colors.primary,
                        borderWidth: 0,
                        borderRadius: 6
                    },
                    {
                        label: 'Market Average',
                        data: [11500, 14500, 17500, 21000],
                        backgroundColor: this.colors.secondary,
                        borderWidth: 0,
                        borderRadius: 6
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
                                return `${context.dataset.label}: ₱${context.parsed.y.toLocaleString()}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₱' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }

    // Method to update charts with new data (for future use)
    updateChartData(chartId, newData) {
        if (this.charts[chartId]) {
            this.charts[chartId].data = newData;
            this.charts[chartId].update();
        }
    }

    // Method to destroy charts (for cleanup)
    destroyAllCharts() {
        Object.values(this.charts).forEach(chart => {
            chart.destroy();
        });
        this.charts = {};
    }
}