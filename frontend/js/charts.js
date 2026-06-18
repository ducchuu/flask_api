/**
 * Chart.js Wrapper for Pulse Dashboards
 * Ensure Chart.js is loaded via CDN in the HTML before calling these methods.
 */

let chartInstances = {};

export function renderSourceMixChart(canvasId, data) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    // Data format expected: { news: 10, video: 5, discuss: 3 }
    const chartData = {
        labels: ['News (GNews)', 'Video (YouTube)', 'Discussion (Lemmy)'],
        datasets: [{
            data: [data.news || 0, data.video || 0, data.discuss || 0],
            backgroundColor: [
                '#3B82F6', // Blue for News
                '#EF4444', // Red for Video
                '#8B5CF6'  // Purple for Discuss
            ],
            borderWidth: 0,
            hoverOffset: 4
        }]
    };

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#F8FAFC',
                        font: { family: "'Inter', sans-serif", size: 12 }
                    }
                }
            },
            cutout: '70%'
        }
    });
    return chartInstances[canvasId];
}

export function renderActivityChart(canvasId, data) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    // Data format expected: { labels: ['Mon', 'Tue'], counts: [5, 10] }
    const chartData = {
        labels: data.labels || [],
        datasets: [{
            label: 'Stories Processed',
            data: data.counts || [],
            backgroundColor: '#10B981', // Emerald Primary
            borderRadius: 4
        }]
    };

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#334155' },
                    ticks: { color: '#94A3B8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94A3B8' }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
    return chartInstances[canvasId];
}
