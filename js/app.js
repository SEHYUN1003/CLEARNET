/**
 * ClearNet - 메인 애플리케이션 로직
 */

class ClearNetApp {
    constructor() {
        this.currentSection = 'scanner';
        this.statistics = {
            blockedCount: 0,
            scanCount: 0,
            reportCount: 0,
            userCount: 0
        };
        this.init();
    }

    /**
     * 애플리케이션 초기화
     */
    async init() {
        this.setupEventListeners();
        await this.loadStatistics();
        await this.initializeDatabase();
        this.updateUI();
        console.log('ClearNet 시스템이 초기화되었습니다.');
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 네비게이션 버튼들
        document.getElementById('scanBtn').addEventListener('click', () => this.showSection('scanner'));
        document.getElementById('reportBtn').addEventListener('click', () => this.showSection('report'));
        document.getElementById('dashboardBtn').addEventListener('click', () => this.showSection('dashboard'));

        // URL 분석 버튼
        document.getElementById('analyzeBtn').addEventListener('click', () => this.analyzeUrl());

        // URL 입력 필드에서 Enter 키 처리
        document.getElementById('urlInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.analyzeUrl();
            }
        });

        // 신고 양식 제출
        document.getElementById('reportForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitReport();
        });
    }

    /**
     * 섹션 표시 전환
     */
    showSection(sectionName) {
        // 모든 섹션 숨기기
        document.getElementById('scannerSection').style.display = 'block';
        document.getElementById('reportSection').classList.add('hidden');
        document.getElementById('dashboardSection').classList.add('hidden');

        // 선택된 섹션만 표시
        switch(sectionName) {
            case 'scanner':
                document.getElementById('scannerSection').style.display = 'block';
                break;
            case 'report':
                document.getElementById('reportSection').classList.remove('hidden');
                break;
            case 'dashboard':
                document.getElementById('dashboardSection').classList.remove('hidden');
                this.loadDashboardData();
                // 차트 생성
                setTimeout(() => dashboard.createStatisticsChart(), 100);
                break;
        }
        
        this.currentSection = sectionName;
    }

    /**
     * URL 분석 실행
     */
    async analyzeUrl() {
        const urlInput = document.getElementById('urlInput');
        const url = urlInput.value.trim();

        if (!url) {
            this.showAlert('URL을 입력해주세요.', 'warning');
            return;
        }

        // 로딩 모달 표시
        this.showModal('loadingModal');

        try {
            // URL 분석 수행
            const analysis = await window.fraudDetector.analyzeUrl(url);
            
            // 분석 결과 저장
            await this.saveScanHistory(analysis);
            
            // 결과 표시
            this.displayAnalysisResult(analysis);
            
            // 통계 업데이트
            await this.updateStatistics('scan_count', 1);

            // 위험도가 높으면 자동으로 차단 목록에 추가 고려
            if (analysis.riskLevel === 'high') {
                await this.considerAutoBlock(analysis);
            }

        } catch (error) {
            console.error('URL 분석 중 오류:', error);
            this.showAlert('URL 분석 중 오류가 발생했습니다.', 'error');
        } finally {
            this.closeModal('loadingModal');
        }
    }

    /**
     * 분석 결과 표시
     */
    displayAnalysisResult(analysis) {
        const resultsDiv = document.getElementById('analysisResults');
        const contentDiv = document.getElementById('resultContent');
        
        const riskInfo = window.fraudDetector.getRiskLevel(analysis.riskScore);
        
        let resultHtml = `
            <div class="analysis-card ${analysis.riskLevel}">
                <div class="flex items-center justify-between mb-4">
                    <h4 class="text-lg font-semibold">분석 결과</h4>
                    <span class="status-badge status-${analysis.riskLevel}">
                        <i class="fas fa-${this.getRiskIcon(analysis.riskLevel)} mr-1"></i>
                        ${riskInfo.text}
                    </span>
                </div>
                
                <div class="mb-4">
                    <p class="text-sm text-gray-600 mb-2">검사된 URL:</p>
                    <p class="font-mono text-sm bg-gray-100 p-2 rounded break-all">${analysis.url}</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <p class="text-sm font-medium text-gray-700 mb-2">위험도 점수</p>
                        <div class="flex items-center">
                            <div class="progress-bar flex-1 mr-2">
                                <div class="progress-fill bg-${riskInfo.color}-500" style="width: ${analysis.riskScore}%"></div>
                            </div>
                            <span class="text-sm font-semibold">${analysis.riskScore}/100</span>
                        </div>
                    </div>
                    <div>
                        <p class="text-sm font-medium text-gray-700 mb-2">검사 시간</p>
                        <p class="text-sm text-gray-600">${new Date(analysis.timestamp).toLocaleString('ko-KR')}</p>
                    </div>
                </div>
        `;

        if (analysis.threats && analysis.threats.length > 0) {
            resultHtml += `
                <div class="mb-4">
                    <p class="text-sm font-medium text-red-700 mb-2">
                        <i class="fas fa-exclamation-triangle mr-1"></i>
                        발견된 위험 요소
                    </p>
                    <ul class="list-disc list-inside text-sm text-red-600 space-y-1">
                        ${analysis.threats.map(threat => `<li>${threat}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        if (analysis.recommendations && analysis.recommendations.length > 0) {
            resultHtml += `
                <div class="mb-4">
                    <p class="text-sm font-medium text-blue-700 mb-2">
                        <i class="fas fa-lightbulb mr-1"></i>
                        권장사항
                    </p>
                    <ul class="list-disc list-inside text-sm text-blue-600 space-y-1">
                        ${analysis.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        if (analysis.details) {
            resultHtml += `
                <div class="mt-4">
                    <details class="bg-gray-50 p-3 rounded">
                        <summary class="cursor-pointer text-sm font-medium text-gray-700">상세 분석 결과</summary>
                        <pre class="text-xs mt-2 overflow-auto">${JSON.stringify(analysis.details, null, 2)}</pre>
                    </details>
                </div>
            `;
        }

        resultHtml += '</div>';
        
        contentDiv.innerHTML = resultHtml;
        resultsDiv.classList.remove('hidden');
        resultsDiv.scrollIntoView({ behavior: 'smooth' });
    }

    /**
     * 신고 제출
     */
    async submitReport() {
        const form = document.getElementById('reportForm');
        const formData = new FormData(form);
        
        const reportData = {
            url: document.getElementById('reportUrl').value.trim(),
            report_type: document.getElementById('reportType').value,
            description: document.getElementById('reportDescription').value.trim(),
            reporter_email: document.getElementById('reporterEmail').value.trim(),
            status: 'pending',
            risk_score: 0,
            admin_notes: ''
        };

        if (!reportData.url || !reportData.report_type) {
            this.showAlert('필수 항목을 모두 입력해주세요.', 'warning');
            return;
        }

        try {
            // 신고된 URL 분석
            const analysis = await window.fraudDetector.analyzeUrl(reportData.url);
            reportData.risk_score = analysis.riskScore;

            // 신고 데이터 저장
            const response = await fetch('tables/reports', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(reportData)
            });

            if (response.ok) {
                this.showAlert('신고가 성공적으로 접수되었습니다.', 'success');
                form.reset();
                
                // 통계 업데이트
                await this.updateStatistics('report_count', 1);
                
                // 고위험으로 판단되면 즉시 차단 고려
                if (analysis.riskLevel === 'high') {
                    await this.autoBlockUrl(reportData.url, analysis);
                }
                
            } else {
                throw new Error('신고 접수에 실패했습니다.');
            }
        } catch (error) {
            console.error('신고 처리 중 오류:', error);
            this.showAlert('신고 처리 중 오류가 발생했습니다.', 'error');
        }
    }

    /**
     * 스캔 기록 저장
     */
    async saveScanHistory(analysis) {
        try {
            const scanData = {
                url: analysis.url,
                scan_result: JSON.stringify(analysis),
                risk_score: analysis.riskScore,
                risk_level: analysis.riskLevel,
                threats_detected: analysis.threats || [],
                user_ip: await this.getUserIP(),
                scan_duration: 0 // 실제 구현에서는 스캔 시간 측정
            };

            await fetch('tables/scan_history', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(scanData)
            });
        } catch (error) {
            console.error('스캔 기록 저장 실패:', error);
        }
    }

    /**
     * 자동 차단 고려
     */
    async considerAutoBlock(analysis) {
        if (analysis.riskScore >= 80) {
            await this.autoBlockUrl(analysis.url, analysis);
        }
    }

    /**
     * URL 자동 차단
     */
    async autoBlockUrl(url, analysis) {
        try {
            const urlObj = new URL(url);
            const blockData = {
                url: url,
                domain: urlObj.hostname,
                risk_level: analysis.riskLevel,
                block_reason: this.determineBlockReason(analysis),
                source: 'automated_detection',
                block_date: new Date().toISOString(),
                is_active: true
            };

            await fetch('tables/blocked_urls', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(blockData)
            });

            await this.updateStatistics('blocked_count', 1);
            
        } catch (error) {
            console.error('자동 차단 처리 실패:', error);
        }
    }

    /**
     * 차단 이유 결정
     */
    determineBlockReason(analysis) {
        if (analysis.threats.some(t => t.includes('피싱'))) return 'phishing';
        if (analysis.threats.some(t => t.includes('스캠'))) return 'scam';
        if (analysis.threats.some(t => t.includes('악성'))) return 'malware';
        return 'other';
    }

    /**
     * 통계 업데이트
     */
    async updateStatistics(metricName, increment = 1) {
        try {
            // 기존 통계 가져오기
            const response = await fetch(`tables/statistics?search=${metricName}`);
            const data = await response.json();
            
            let currentValue = 0;
            let recordId = null;

            if (data.data && data.data.length > 0) {
                const record = data.data[0];
                currentValue = record.metric_value || 0;
                recordId = record.id;
            }

            const newValue = currentValue + increment;
            
            const statData = {
                metric_name: metricName,
                metric_value: newValue,
                last_updated: new Date().toISOString(),
                description: this.getMetricDescription(metricName)
            };

            if (recordId) {
                // 업데이트
                await fetch(`tables/statistics/${recordId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(statData)
                });
            } else {
                // 새로 생성
                await fetch('tables/statistics', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(statData)
                });
            }

            // UI 업데이트
            this.statistics[metricName.replace('_count', 'Count')] = newValue;
            this.updateStatisticsDisplay();

        } catch (error) {
            console.error('통계 업데이트 실패:', error);
        }
    }

    /**
     * 메트릭 설명 가져오기
     */
    getMetricDescription(metricName) {
        const descriptions = {
            'scan_count': '총 URL 검사 횟수',
            'report_count': '신고 접수 건수',
            'blocked_count': '차단된 위험 사이트 수',
            'user_count': '보호받은 사용자 수'
        };
        return descriptions[metricName] || '';
    }

    /**
     * 통계 로드
     */
    async loadStatistics() {
        try {
            const response = await fetch('tables/statistics');
            const data = await response.json();
            
            if (data.data) {
                data.data.forEach(stat => {
                    const key = stat.metric_name.replace('_count', 'Count');
                    this.statistics[key] = stat.metric_value || 0;
                });
            }
            
            this.updateStatisticsDisplay();
        } catch (error) {
            console.error('통계 로드 실패:', error);
        }
    }

    /**
     * 통계 표시 업데이트
     */
    updateStatisticsDisplay() {
        document.getElementById('blockedCount').textContent = this.statistics.blockedCount.toLocaleString();
        document.getElementById('scanCount').textContent = this.statistics.scanCount.toLocaleString();
        document.getElementById('reportCount').textContent = this.statistics.reportCount.toLocaleString();
        document.getElementById('userCount').textContent = this.statistics.userCount.toLocaleString();
    }

    /**
     * 대시보드 데이터 로드
     */
    async loadDashboardData() {
        try {
            await Promise.all([
                this.loadRecentReports(),
                this.loadBlockedUrls()
            ]);
        } catch (error) {
            console.error('대시보드 데이터 로드 실패:', error);
        }
    }

    /**
     * 최근 신고 현황 로드
     */
    async loadRecentReports() {
        try {
            const response = await fetch('tables/reports?limit=10&sort=-created_at');
            const data = await response.json();
            
            const tbody = document.getElementById('reportsTable');
            tbody.innerHTML = '';

            if (data.data && data.data.length > 0) {
                data.data.forEach(report => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td class="border px-4 py-2 text-sm">
                            ${new Date(report.created_at).toLocaleDateString('ko-KR')}
                        </td>
                        <td class="border px-4 py-2 text-sm">
                            <div class="max-w-xs truncate" title="${report.url}">
                                ${report.url}
                            </div>
                        </td>
                        <td class="border px-4 py-2 text-sm">
                            ${this.getReportTypeText(report.report_type)}
                        </td>
                        <td class="border px-4 py-2 text-sm">
                            <span class="status-badge status-${report.status}">
                                ${this.getStatusText(report.status)}
                            </span>
                        </td>
                        <td class="border px-4 py-2 text-sm">
                            <button onclick="app.reviewReport('${report.id}')" class="btn-primary text-xs">
                                검토
                            </button>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">신고 내역이 없습니다.</td></tr>';
            }
        } catch (error) {
            console.error('신고 내역 로드 실패:', error);
        }
    }

    /**
     * 차단된 URL 목록 로드
     */
    async loadBlockedUrls() {
        try {
            const response = await fetch('tables/blocked_urls?limit=10&sort=-block_date&search=is_active:true');
            const data = await response.json();
            
            const tbody = document.getElementById('blockedTable');
            tbody.innerHTML = '';

            if (data.data && data.data.length > 0) {
                data.data.forEach(blocked => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td class="border px-4 py-2 text-sm">
                            <div class="max-w-xs truncate" title="${blocked.url}">
                                ${blocked.url}
                            </div>
                        </td>
                        <td class="border px-4 py-2 text-sm">
                            <span class="status-badge status-${blocked.risk_level}">
                                ${blocked.risk_level.toUpperCase()}
                            </span>
                        </td>
                        <td class="border px-4 py-2 text-sm">
                            ${new Date(blocked.block_date).toLocaleDateString('ko-KR')}
                        </td>
                        <td class="border px-4 py-2 text-sm">
                            <button onclick="app.unblockUrl('${blocked.id}')" class="btn-secondary text-xs">
                                차단해제
                            </button>
                        </td>
                    `;
                    tbody.appendChild(row);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">차단된 URL이 없습니다.</td></tr>';
            }
        } catch (error) {
            console.error('차단된 URL 목록 로드 실패:', error);
        }
    }

    /**
     * 데이터베이스 초기화
     */
    async initializeDatabase() {
        try {
            // 기본 통계 데이터 생성 (없는 경우)
            const metrics = ['scan_count', 'report_count', 'blocked_count', 'user_count'];
            
            for (const metric of metrics) {
                const response = await fetch(`tables/statistics?search=${metric}`);
                const data = await response.json();
                
                if (!data.data || data.data.length === 0) {
                    await fetch('tables/statistics', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            metric_name: metric,
                            metric_value: 0,
                            last_updated: new Date().toISOString(),
                            description: this.getMetricDescription(metric)
                        })
                    });
                }
            }
        } catch (error) {
            console.error('데이터베이스 초기화 실패:', error);
        }
    }

    /**
     * 유틸리티 함수들
     */
    getRiskIcon(riskLevel) {
        const icons = {
            'safe': 'check-circle',
            'low': 'exclamation-circle',
            'medium': 'exclamation-triangle',
            'high': 'times-circle'
        };
        return icons[riskLevel] || 'question-circle';
    }

    getReportTypeText(type) {
        const types = {
            'phishing': '피싱',
            'scam': '스캠',
            'malware': '악성코드',
            'fake_shop': '가짜쇼핑몰',
            'identity_theft': '신원도용',
            'cryptocurrency_scam': '암호화폐 사기',
            'other': '기타'
        };
        return types[type] || type;
    }

    getStatusText(status) {
        const statuses = {
            'pending': '대기중',
            'reviewing': '검토중',
            'approved': '승인됨',
            'rejected': '거부됨',
            'blocked': '차단됨'
        };
        return statuses[status] || status;
    }

    async getUserIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch {
            return 'unknown';
        }
    }

    /**
     * UI 유틸리티
     */
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    showAlert(message, type = 'info') {
        // 간단한 알림 표시
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} fixed top-4 right-4 max-w-md z-50`;
        alertDiv.innerHTML = `
            <div class="flex items-center">
                <i class="fas fa-${type === 'success' ? 'check' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'} mr-2"></i>
                <span>${message}</span>
            </div>
        `;
        
        document.body.appendChild(alertDiv);
        
        setTimeout(() => {
            alertDiv.remove();
        }, 5000);
    }

    updateUI() {
        this.updateStatisticsDisplay();
    }
}

// 모달 닫기 전역 함수
window.closeModal = function(modalId) {
    document.getElementById(modalId).classList.add('hidden');
    document.getElementById(modalId).classList.remove('flex');
};

// PWA 서비스 워커 등록
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('ClearNet PWA 서비스 워커 등록 성공:', registration.scope);
            })
            .catch((error) => {
                console.log('ClearNet PWA 서비스 워커 등록 실패:', error);
            });
    });
}

// PWA 설치 프롬프트
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    // 기본 설치 프롬프트 방지
    e.preventDefault();
    deferredPrompt = e;
    
    // 설치 버튼 표시
    showInstallPrompt();
});

function showInstallPrompt() {
    const installBanner = document.createElement('div');
    installBanner.id = 'pwa-install-banner';
    installBanner.className = 'fixed bottom-4 left-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg z-50 flex items-center justify-between';
    installBanner.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-mobile-alt mr-3 text-xl"></i>
            <div>
                <p class="font-semibold">앱으로 설치하기</p>
                <p class="text-sm opacity-90">홈화면에 ClearNet을 추가하세요</p>
            </div>
        </div>
        <div class="flex gap-2">
            <button id="install-pwa" class="bg-white text-blue-600 px-4 py-2 rounded font-medium">
                설치
            </button>
            <button id="dismiss-install" class="text-white px-2 py-2">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.body.appendChild(installBanner);
    
    // 설치 버튼 클릭
    document.getElementById('install-pwa').addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                console.log('PWA 설치됨');
            }
            deferredPrompt = null;
            installBanner.remove();
        }
    });
    
    // 닫기 버튼 클릭
    document.getElementById('dismiss-install').addEventListener('click', () => {
        installBanner.remove();
    });
}

// PWA 설치 완료 시
window.addEventListener('appinstalled', (evt) => {
    console.log('ClearNet PWA가 성공적으로 설치되었습니다!');
    app.showAlert('ClearNet이 홈화면에 설치되었습니다! 🎉', 'success');
});

// 애플리케이션 시작
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ClearNetApp();
});
