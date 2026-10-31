/**
 * PC Builder - Mock Charts
 * Fixed tooltip interaction for accurate point/dataset targeting.
 * Updated to accept dynamic data from analysis engine.
 */

document.addEventListener('DOMContentLoaded', function() {

    // Shared Chart.js defaults
    Chart.defaults.font.family = "'Inter', -apple-system, sans-serif";
    Chart.defaults.color = "#475569";

    // Retrieve analysis data from sessionStorage (populated by analysis engine + navigation)
    var analysisData = null;
    var savedAnalysis = sessionStorage.getItem('pcBuilderAnalysis');
    if (savedAnalysis) {
        try {
            analysisData = JSON.parse(savedAnalysis);
        } catch (e) {
            console.warn('[CHARTS] Failed to parse saved analysis data');
        }
    }

    // Get performance data if available
    var perf = analysisData && analysisData.performance ? analysisData.performance : null;

    // Helper to format estimated label
    function estLabel(label) {
        return perf && perf.isEstimate ? label + ' (Estimate)' : label;
    }

    // 1. Workload Scores Chart (Radar)
    var ctxWorkload = document.getElementById('chart-workload');
    if (ctxWorkload) {
        var workloadScores = perf ? perf.workloadScores : null;
        var workloadData = workloadScores ? [
            workloadScores.gaming || 0,
            workloadScores.productivity || 0,
            workloadScores.contentCreation || 0,
            workloadScores.gaming || 0, // Use gaming as proxy for AI/ML
            workloadScores.productivity || 0, // Use productivity as proxy for Engineering
            workloadScores.generalUse || 0
        ] : [0, 0, 0, 0, 0, 0];

        new Chart(ctxWorkload, {
            type: 'radar',
            data: {
                labels: ['Gaming', 'Programming', 'Video Editing', 'AI / ML', 'Engineering', 'Everyday Use'],
                datasets: [{
                    label: estLabel('System Score'),
                    data: workloadData,
                    fill: true,
                    backgroundColor: 'rgba(37, 99, 235, 0.15)',
                    borderColor: 'rgb(37, 99, 235)',
                    pointBackgroundColor: 'rgb(37, 99, 235)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgb(37, 99, 235)',
                    tension: 0.3
                }]
            },
            options: {
                animation: { duration: 1500, easing: 'easeOutQuart' },
                scales: {
                    r: {
                        angleLines: { color: 'rgba(226, 232, 240, 0.5)' },
                        grid: { color: 'rgba(226, 232, 240, 0.3)' },
                        suggestedMin: 0, suggestedMax: 100,
                        ticks: { font: { size: 10 }, backdropColor: 'rgba(255,255,255,0.8)' }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleFont: { size: 12 }, bodyFont: { size: 11 },
                        // FIX: Use 'point' mode with intersect: true for precise tooltip targeting
                        mode: 'point',
                        intersect: true,
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + context.parsed.r;
                            }
                        }
                    }
                }
            }
        });
    }

    // 2. Bottleneck Analysis Chart (Horizontal Bar)
    var ctxBottleneck = document.getElementById('chart-bottleneck');
    if (ctxBottleneck) {
        var bottleneck = perf ? perf.bottleneck : null;
        var cpuBottleneck = bottleneck ? bottleneck.cpuBottleneck || 0 : 0;
        var gpuBottleneck = bottleneck ? bottleneck.gpuBottleneck || 0 : 0;

        new Chart(ctxBottleneck, {
            type: 'bar',
            data: {
                labels: ['CPU Bottleneck', 'GPU Bottleneck'],
                datasets: [{
                    label: estLabel('Bottleneck'),
                    data: [cpuBottleneck, gpuBottleneck],
                    backgroundColor: ['rgba(239, 68, 68, 0.6)', 'rgba(34, 197, 94, 0.6)'],
                    borderColor: ['rgb(239, 68, 68)', 'rgb(34, 197, 94)'],
                    borderWidth: 1
                }]
            },
            options: {
                animation: { duration: 1500, easing: 'easeOutQuart' },
                responsive: true,
                indexAxis: 'y',
                // FIX: interaction mode 'point' with intersect: true targets the exact bar
                interaction: { mode: 'point', intersect: true, axis: 'y' },
                scales: {
                    x: { grid: { display: false }, max: 30, title: { display: true, text: estLabel('Estimated %') } },
                    y: { grid: { display: false } }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        // FIX: mode 'point' with intersect: true shows exact bar value
                        mode: 'point',
                        intersect: true,
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleFont: { size: 12 }, bodyFont: { size: 11 },
                        callbacks: {
                            label: function(context) {
                                return context.parsed.x + '%';
                            }
                        }
                    }
                }
            }
        });
    }

    // 3. Gaming FPS Estimates (Horizontal Bar)
    var ctxFps = document.getElementById('chart-fps');
    if (ctxFps) {
        var fpsEstimates = perf ? perf.fpsEstimates : null;
        var fpsData = fpsEstimates ? [
            fpsEstimates['1080p'] || 0,
            fpsEstimates['1440p'] || 0,
            fpsEstimates['4K'] || 0
        ] : [0, 0, 0];

        new Chart(ctxFps, {
            type: 'bar',
            data: {
                labels: ['1080p', '1440p', '4K'],
                datasets: [{
                    label: estLabel('FPS'),
                    data: fpsData,
                    backgroundColor: 'rgba(37, 99, 235, 0.7)',
                    borderColor: 'rgb(37, 99, 235)',
                    borderWidth: 1
                }]
            },
            options: {
                animation: { duration: 1500, easing: 'easeOutQuart' },
                indexAxis: 'y',
                // FIX: interaction mode 'point' with intersect: true targets the exact bar
                interaction: { mode: 'point', intersect: true, axis: 'y' },
                scales: {
                    x: { beginAtZero: true, grid: { display: false }, title: { display: true, text: estLabel('Estimated FPS') } },
                    y: { grid: { display: false } }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        // FIX: mode 'point' with intersect: true shows exact bar value without switching
                        mode: 'point',
                        intersect: true,
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleFont: { size: 12 }, bodyFont: { size: 11 },
                        callbacks: {
                            label: function(context) {
                                return context.parsed.x + ' FPS';
                            }
                        }
                    }
                }
            }
        });
    }

    // 4. Power Consumption Chart (Horizontal Bar)
    var ctxPower = document.getElementById('chart-power');
    if (ctxPower) {
        var powerConsumption = perf ? perf.powerConsumption : null;
        var estimatedWithOverhead = powerConsumption ? powerConsumption.estimatedWithOverhead || 0 : 0;
        var breakdown = powerConsumption ? powerConsumption.breakdown || [] : [];
        
        var powerLabels = breakdown.map(function(b) { return b.component; });
        var powerData = breakdown.map(function(b) { return b.tdp; });
        powerLabels.push('Total (w/ 30% overhead)');
        powerData.push(estimatedWithOverhead);

        new Chart(ctxPower, {
            type: 'bar',
            data: {
                labels: powerLabels,
                datasets: [{
                    label: estLabel('Power (W)'),
                    data: powerData,
                    backgroundColor: 'rgba(139, 92, 246, 0.7)',
                    borderColor: 'rgb(139, 92, 246)',
                    borderWidth: 1
                }]
            },
            options: {
                animation: { duration: 1500, easing: 'easeOutQuart' },
                indexAxis: 'y',
                interaction: { mode: 'point', intersect: true, axis: 'y' },
                scales: {
                    x: { beginAtZero: true, grid: { display: false }, title: { display: true, text: estLabel('Power (W)') } },
                    y: { grid: { display: false } }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'point',
                        intersect: true,
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleFont: { size: 12 }, bodyFont: { size: 11 },
                        callbacks: {
                            label: function(context) {
                                return context.parsed.x + ' W';
                            }
                        }
                    }
                }
            }
        });
    }
});