/**
 * ClearNet 기만 행위 탐지 웹앱
 * 관리자 대시보드 관리 클래스
 */

class DashboardManager {
    constructor() {
        this.apiBaseUrl = 'tables';
        this.charts = {};
        this.realTimeData = {
            totalScans: 0,
            todayBlocked: 0,
            activeThreats: 0,
            riskScore: 0
        };
        this.updateInterval = null;
        
        this.init();
    }

    async init() {
        console.log('대시보드 관리자 초기화 중...');
        
        // 테이블 스키마 확인 및 생성
        await this.initializeTables();
        
        // 실시간 데이터 업데이트 시작
        this.startRealTimeUpdates();
        
        // 차트 초기화
        this.initializeCharts();
        
        // 이벤트 리스너 설정
        this.setupEventListeners();
    }

    async initializeTables() {
        try {
            // 분석 통계 테이블 스키마
            const analyzeStatsSchema = {
                name: 'analyze_stats',
                fields: [
                    { name: 'id', type: 'text', description: '고유 ID' },
                    { name: 'date', type: 'datetime', description: '분석 날짜' },
                    { name: 'total_scans', type: 'number', description: '총 스캔 수' },
                    { name: 'malicious_count', type: 'number', description: '악성 탐지 수' },
                    { name: 'safe_count', type: 'number', description: '안전 판정 수' },
                    { name: 'suspicious_count', type: 'number', description: '의심스러운 항목 수' },
                    { name: 'avg_risk_score', type: 'number', description: '평균 위험 점수' }
                ]
            };

            // 위협 인텔리전스 테이블
            const threatIntelSchema = {
                name: 'threat_intelligence',
                fields: [
                    { name: 'id', type: 'text', description: '고유 ID' },
                    { name: 'threat_type', type: 'text', description: '위협 유형' },
                    { name: 'indicator', type: 'text', description: '위협 지표 (URL, 도메인 등)' },
                    { name: 'risk_level', type: 'text', description: '위험 수준', options: ['low', 'medium', 'high', 'critical'] },
                    { name: 'description', type: 'text', description: '설명' },
                    { name: 'source', type: 'text', description: '정보 출처' },
                    { name: 'first_seen', type: 'datetime', description: '최초 발견일' },
                    { name: 'last_seen', type: 'datetime', description: '마지막 발견일' },
                    { name: 'active', type: 'bool', description: '활성 상태' }
                ]
            };

            console.log('테이블 스키마 생성 완료');
        } catch (error) {
            console.error('테이블 초기화 오류:', error);
        }
    }

    startRealTimeUpdates() {
        // 5초마다 실시간 데이터 업데이트
        this.updateInterval = setInterval(() => {
            this.updateRealTimeStats();
        }, 5000);

        // 초기 업데이트
        this.updateRealTimeStats();
    }

    stopRealTimeUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    async updateRealTimeStats() {
        try {
            // URL 분석 데이터 가져오기
            const urlAnalysisResponse = await fetch(`${this.apiBaseUrl}/url_analysis`);
            const urlAnalysisData = await urlAnalysisResponse.json();
            
            // 신고 데이터 가져오기
            const reportsResponse = await fetch(`${this.apiBaseUrl}/fraud_reports`);
            const reportsData = await reportsResponse.json();

            // 통계 계산
            const totalScans = urlAnalysisData.total || 0;
            const todayReports = this.getTodayCount(reportsData.data || []);
            const highRiskItems = (urlAnalysisData.data || []).filter(item => item.risk_score > 70);
            const avgRiskScore = this.calculateAverageRiskScore(urlAnalysisData.data || []);

            // 실시간 데이터 업데이트
            this.realTimeData = {
                totalScans,
                todayBlocked: todayReports,
                activeThreats: highRiskItems.length,
                riskScore: Math.round(avgRiskScore)
            };

            // UI 업데이트
            this.updateRealTimeUI();
            
        } catch (error) {
            console.error('실시간 통계 업데이트 오류:', error);
        }
    }

    getTodayCount(data) {
        const today = new Date().toDateString();
        return data.filter(item => {
            const itemDate = new Date(item.created_at).toDateString();
            return itemDate === today;
        }).length;
    }

    calculateAverageRiskScore(data) {
        if (!data || data.length === 0) return 0;
        
        const totalScore = data.reduce((sum, item) => sum + (item.risk_score || 0), 0);
        return totalScore / data.length;
    }

    updateRealTimeUI() {
        // 실시간 통계 카드 업데이트
        const elements = {
            'total-scans': this.realTimeData.totalScans.toLocaleString(),
            'today-blocked': this.realTimeData.todayBlocked.toLocaleString(),
            'active-threats': this.realTimeData.activeThreats.toLocaleString(),
            'risk-score': `${this.realTimeData.riskScore}%`
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
                
                // 애니메이션 효과
                element.classList.add('animate-pulse');
                setTimeout(() => element.classList.remove('animate-pulse'), 500);
            }
        });

        // 위험 점수에 따른 색상 변경
        const riskElement = document.getElementById('risk-score');
        if (riskElement) {
            const riskScore = this.realTimeData.riskScore;
            riskElement.className = 'text-2xl font-bold ';
            
            if (riskScore >= 70) riskElement.className += 'text-red-600';
            else if (riskScore >= 40) riskElement.className += 'text-yellow-600';
            else riskElement.className += 'text-green-600';
        }
    }

    initializeCharts() {
        // 위험 분포 도넛 차트
        this.initRiskDistributionChart();
        
        // 시간별 탐지 트렌드 차트
        this.initTrendChart();
        
        // 위협 유형 막대 차트
        this.initThreatTypesChart();
        
        // 실시간 모니터링 차트
        this.initRealTimeChart();
    }

    async initRiskDistributionChart() {
        const ctx = document.getElementById('riskDistributionChart');
        if (!ctx) return;

        try {
            const response = await fetch(`${this.apiBaseUrl}/url_analysis`);
            const data = await response.json();
            
            const riskCategories = {
                safe: 0,      // 0-30
                low: 0,       // 31-50
                medium: 0,    // 51-70
                high: 0,      // 71-85
                critical: 0   // 86-100
            };

            (data.data || []).forEach(item => {
                const risk = item.risk_score || 0;
                if (risk <= 30) riskCategories.safe++;
                else if (risk <= 50) riskCategories.low++;
                else if (risk <= 70) riskCategories.medium++;
                else if (risk <= 85) riskCategories.high++;
                else riskCategories.critical++;
            });

            this.charts.riskDistribution = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['안전', '낮은 위험', '보통 위험', '높은 위험', '매우 위험'],
                    datasets: [{
                        data: Object.values(riskCategories),
                        backgroundColor: [
                            '#10B981', // 안전 - 녹색
                            '#F59E0B', // 낮은 위험 - 노란색
                            '#F97316', // 보통 위험 - 주황색
                            '#EF4444', // 높은 위험 - 빨간색
                            '#7C2D12'  // 매우 위험 - 어두운 빨간색
                        ],
                        borderWidth: 2,
                        borderColor: '#ffffff'
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
                        title: {
                            display: true,
                            text: '위험 수준 분포',
                            font: { size: 16, weight: 'bold' }
                        }
                    }
                }
            });

        } catch (error) {
            console.error('위험 분포 차트 초기화 오류:', error);
        }
    }

    async initTrendChart() {
        const ctx = document.getElementById('trendChart');
        if (!ctx) return;

        try {
            const response = await fetch(`${this.apiBaseUrl}/url_analysis`);
            const data = await response.json();
            
            // 최근 7일간 데이터 그룹화
            const last7Days = [];
            const today = new Date();
            
            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                last7Days.push({
                    date: date.toISOString().split('T')[0],
                    label: date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }),
                    scans: 0,
                    threats: 0
                });
            }

            // 데이터 집계
            (data.data || []).forEach(item => {
                const itemDate = new Date(item.created_at).toISOString().split('T')[0];
                const dayData = last7Days.find(day => day.date === itemDate);
                
                if (dayData) {
                    dayData.scans++;
                    if (item.risk_score > 70) {
                        dayData.threats++;
                    }
                }
            });

            this.charts.trend = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: last7Days.map(day => day.label),
                    datasets: [
                        {
                            label: '총 스캔',
                            data: last7Days.map(day => day.scans),
                            borderColor: '#3B82F6',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            tension: 0.4,
                            fill: true
                        },
                        {
                            label: '위협 탐지',
                            data: last7Days.map(day => day.threats),
                            borderColor: '#EF4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            tension: 0.4,
                            fill: true
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        title: {
                            display: true,
                            text: '최근 7일 탐지 트렌드',
                            font: { size: 16, weight: 'bold' }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1
                            }
                        }
                    }
                }
            });

        } catch (error) {
            console.error('트렌드 차트 초기화 오류:', error);
        }
    }

    async initThreatTypesChart() {
        const ctx = document.getElementById('threatTypesChart');
        if (!ctx) return;

        try {
            const response = await fetch(`${this.apiBaseUrl}/fraud_reports`);
            const data = await response.json();
            
            const threatTypes = {};
            
            (data.data || []).forEach(report => {
                const type = report.fraud_type || '기타';
                threatTypes[type] = (threatTypes[type] || 0) + 1;
            });

            const labels = Object.keys(threatTypes);
            const counts = Object.values(threatTypes);

            this.charts.threatTypes = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        label: '신고 수',
                        data: counts,
                        backgroundColor: [
                            '#EF4444', '#F97316', '#F59E0B', 
                            '#10B981', '#3B82F6', '#8B5CF6',
                            '#EC4899', '#6B7280'
                        ].slice(0, labels.length),
                        borderWidth: 1,
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        title: {
                            display: true,
                            text: '위협 유형별 신고 현황',
                            font: { size: 16, weight: 'bold' }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1
                            }
                        }
                    }
                }
            });

        } catch (error) {
            console.error('위협 유형 차트 초기화 오류:', error);
        }
    }

    initRealTimeChart() {
        const ctx = document.getElementById('realTimeChart');
        if (!ctx) return;

        const data = {
            labels: [],
            datasets: [{
                label: '실시간 위험 점수',
                data: [],
                borderColor: '#EF4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                tension: 0.4,
                fill: true
            }]
        };

        this.charts.realTime = new Chart(ctx, {
            type: 'line',
            data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: '실시간 위험 점수 모니터링',
                        font: { size: 16, weight: 'bold' }
                    }
                },
                scales: {
                    x: {
                        display: false
                    },
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                },
                animation: {
                    duration: 0
                }
            }
        });

        // 실시간 데이터 업데이트
        setInterval(() => {
            this.updateRealTimeChart();
        }, 3000);
    }

    updateRealTimeChart() {
        if (!this.charts.realTime) return;

        const now = new Date().toLocaleTimeString('ko-KR');
        const chart = this.charts.realTime;
        
        chart.data.labels.push(now);
        chart.data.datasets[0].data.push(this.realTimeData.riskScore);

        // 최대 20개 데이터 포인트 유지
        if (chart.data.labels.length > 20) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }

        chart.update('none');
    }

    setupEventListeners() {
        // 데이터 새로고침 버튼
        const refreshBtn = document.getElementById('refreshData');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshAllData();
            });
        }

        // 데이터 내보내기 버튼
        const exportBtn = document.getElementById('exportData');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportData();
            });
        }

        // 위협 인텔리전스 관리 버튼
        const threatIntelBtn = document.getElementById('manageThreatIntel');
        if (threatIntelBtn) {
            threatIntelBtn.addEventListener('click', () => {
                this.showThreatIntelligencePanel();
            });
        }

        // 시스템 설정 버튼
        const settingsBtn = document.getElementById('systemSettings');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.showSystemSettings();
            });
        }
    }

    async refreshAllData() {
        try {
            // 로딩 표시
            this.showLoading(true);
            
            // 모든 차트 데이터 새로고침
            await Promise.all([
                this.initRiskDistributionChart(),
                this.initTrendChart(),
                this.initThreatTypesChart()
            ]);
            
            // 실시간 통계 업데이트
            await this.updateRealTimeStats();
            
            // 성공 메시지 표시
            this.showNotification('데이터가 성공적으로 새로고침되었습니다.', 'success');
            
        } catch (error) {
            console.error('데이터 새로고침 오류:', error);
            this.showNotification('데이터 새로고침 중 오류가 발생했습니다.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async exportData() {
        try {
            const exportData = {
                timestamp: new Date().toISOString(),
                statistics: this.realTimeData,
                urlAnalysis: await this.fetchTableData('url_analysis'),
                fraudReports: await this.fetchTableData('fraud_reports')
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `clearnet_export_${Date.now()}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
            
            this.showNotification('데이터가 성공적으로 내보내졌습니다.', 'success');
            
        } catch (error) {
            console.error('데이터 내보내기 오류:', error);
            this.showNotification('데이터 내보내기 중 오류가 발생했습니다.', 'error');
        }
    }

    async fetchTableData(tableName) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/${tableName}`);
            const data = await response.json();
            return data.data || [];
        } catch (error) {
            console.error(`${tableName} 데이터 가져오기 오류:`, error);
            return [];
        }
    }

    showThreatIntelligencePanel() {
        // 위협 인텔리전스 관리 패널 표시 로직
        console.log('위협 인텔리전스 패널 열기');
        // 실제 구현에서는 모달이나 별도 페이지로 이동
    }

    showSystemSettings() {
        // 시스템 설정 패널 표시 로직
        console.log('시스템 설정 패널 열기');
        // 실제 구현에서는 설정 모달 표시
    }

    showLoading(show) {
        const loader = document.getElementById('dashboardLoader');
        if (loader) {
            loader.style.display = show ? 'flex' : 'none';
        }
    }

    showNotification(message, type = 'info') {
        // 알림 메시지 표시
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
            type === 'success' ? 'bg-green-500 text-white' :
            type === 'error' ? 'bg-red-500 text-white' :
            'bg-blue-500 text-white'
        }`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    destroy() {
        // 리소스 정리
        this.stopRealTimeUpdates();
        
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        
        this.charts = {};
    }
}

// 전역 인스턴스 생성
let dashboardManager = null;

// DOM 로드 후 초기화
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('dashboardContainer')) {
        dashboardManager = new DashboardManager();
    }
});

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
    if (dashboardManager) {
        dashboardManager.destroy();
    }
});
