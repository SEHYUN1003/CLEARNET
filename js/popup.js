/**
 * ClearNet 기만 행위 탐지 웹앱
 * 브라우저 확장 팝업 관리 클래스
 */

class PopupManager {
    constructor() {
        this.currentTab = null;
        this.fraudDetector = null;
        this.apiBaseUrl = 'https://your-api-domain.com/tables'; // 실제 API URL로 변경
        
        this.init();
    }

    async init() {
        console.log('팝업 관리자 초기화 중...');
        
        // FraudDetector 인스턴스 생성
        if (typeof FraudDetector !== 'undefined') {
            this.fraudDetector = new FraudDetector();
        }
        
        // 현재 활성 탭 정보 가져오기
        await this.getCurrentTab();
        
        // UI 초기화
        this.initializeUI();
        
        // 이벤트 리스너 설정
        this.setupEventListeners();
        
        // 현재 페이지 자동 스캔
        if (this.currentTab) {
            await this.scanCurrentPage();
        }
    }

    async getCurrentTab() {
        try {
            // Chrome Extension API 사용 (실제 확장 프로그램에서만 동작)
            if (typeof chrome !== 'undefined' && chrome.tabs) {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                this.currentTab = tab;
            } else {
                // 웹 버전에서는 현재 페이지 URL 사용
                this.currentTab = {
                    url: window.location.href,
                    title: document.title
                };
            }
        } catch (error) {
            console.error('현재 탭 정보 가져오기 실패:', error);
            this.currentTab = { url: '', title: '알 수 없음' };
        }
    }

    initializeUI() {
        // 현재 페이지 정보 표시
        this.updateCurrentPageInfo();
        
        // 보호 상태 업데이트
        this.updateProtectionStatus();
        
        // 통계 정보 로드
        this.loadQuickStats();
    }

    updateCurrentPageInfo() {
        const urlElement = document.getElementById('currentUrl');
        const titleElement = document.getElementById('currentTitle');
        const faviconElement = document.getElementById('currentFavicon');
        
        if (this.currentTab) {
            if (urlElement) {
                urlElement.textContent = this.currentTab.url || '';
                urlElement.title = this.currentTab.url || '';
            }
            
            if (titleElement) {
                titleElement.textContent = this.currentTab.title || '제목 없음';
            }
            
            if (faviconElement && this.currentTab.favIconUrl) {
                faviconElement.src = this.currentTab.favIconUrl;
                faviconElement.style.display = 'block';
            }
        }
    }

    async scanCurrentPage() {
        if (!this.currentTab || !this.currentTab.url) return;
        
        const scanButton = document.getElementById('scanCurrentPage');
        const resultContainer = document.getElementById('scanResult');
        
        try {
            // 스캔 버튼 로딩 상태
            if (scanButton) {
                scanButton.disabled = true;
                scanButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>스캔 중...';
            }
            
            // URL 유효성 검사
            if (!this.isValidUrl(this.currentTab.url)) {
                this.showScanResult('invalid', '유효하지 않은 URL입니다.');
                return;
            }
            
            // 위험도 분석 수행
            let riskScore = 0;
            let riskFactors = [];
            let riskLevel = 'safe';
            
            if (this.fraudDetector) {
                const analysis = this.fraudDetector.analyzeURL(this.currentTab.url);
                riskScore = analysis.riskScore;
                riskFactors = analysis.riskFactors;
                riskLevel = this.getRiskLevel(riskScore);
            }
            
            // 분석 결과 저장
            await this.saveAnalysisResult(this.currentTab.url, riskScore, riskFactors);
            
            // 결과 표시
            this.showScanResult(riskLevel, riskScore, riskFactors);
            
        } catch (error) {
            console.error('페이지 스캔 오류:', error);
            this.showScanResult('error', '스캔 중 오류가 발생했습니다.');
        } finally {
            // 스캔 버튼 상태 복원
            if (scanButton) {
                scanButton.disabled = false;
                scanButton.innerHTML = '<i class="fas fa-search mr-2"></i>다시 스캔';
            }
        }
    }

    isValidUrl(url) {
        try {
            new URL(url);
            return url.startsWith('http://') || url.startsWith('https://');
        } catch {
            return false;
        }
    }

    getRiskLevel(score) {
        if (score >= 80) return 'critical';
        if (score >= 60) return 'high';
        if (score >= 40) return 'medium';
        if (score >= 20) return 'low';
        return 'safe';
    }

    showScanResult(level, scoreOrMessage, factors = []) {
        const resultContainer = document.getElementById('scanResult');
        if (!resultContainer) return;
        
        let html = '';
        
        switch (level) {
            case 'critical':
            case 'high':
                html = `
                    <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div class="flex items-center mb-2">
                            <i class="fas fa-exclamation-triangle text-red-600 mr-2"></i>
                            <span class="font-semibold text-red-800">위험한 사이트</span>
                        </div>
                        <div class="text-sm text-red-700 mb-3">
                            위험도: <strong>${scoreOrMessage}점</strong>
                        </div>
                        ${factors.length > 0 ? `
                            <div class="text-sm text-red-600">
                                <strong>발견된 위험 요소:</strong>
                                <ul class="mt-1 ml-4 space-y-1">
                                    ${factors.map(factor => `<li>• ${factor}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                        <button id="reportSite" class="mt-3 bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 transition-colors">
                            <i class="fas fa-flag mr-1"></i>사이트 신고
                        </button>
                    </div>
                `;
                break;
                
            case 'medium':
                html = `
                    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div class="flex items-center mb-2">
                            <i class="fas fa-exclamation-circle text-yellow-600 mr-2"></i>
                            <span class="font-semibold text-yellow-800">주의 필요</span>
                        </div>
                        <div class="text-sm text-yellow-700 mb-3">
                            위험도: <strong>${scoreOrMessage}점</strong>
                        </div>
                        ${factors.length > 0 ? `
                            <div class="text-sm text-yellow-600">
                                <strong>주의 사항:</strong>
                                <ul class="mt-1 ml-4 space-y-1">
                                    ${factors.map(factor => `<li>• ${factor}</li>`).join('')}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                `;
                break;
                
            case 'low':
                html = `
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div class="flex items-center mb-2">
                            <i class="fas fa-info-circle text-blue-600 mr-2"></i>
                            <span class="font-semibold text-blue-800">양호</span>
                        </div>
                        <div class="text-sm text-blue-700">
                            위험도: <strong>${scoreOrMessage}점</strong> - 낮은 위험
                        </div>
                    </div>
                `;
                break;
                
            case 'safe':
                html = `
                    <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div class="flex items-center mb-2">
                            <i class="fas fa-check-circle text-green-600 mr-2"></i>
                            <span class="font-semibold text-green-800">안전</span>
                        </div>
                        <div class="text-sm text-green-700">
                            위험도: <strong>${scoreOrMessage}점</strong> - 안전한 사이트
                        </div>
                    </div>
                `;
                break;
                
            case 'invalid':
                html = `
                    <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div class="flex items-center mb-2">
                            <i class="fas fa-times-circle text-gray-600 mr-2"></i>
                            <span class="font-semibold text-gray-800">분석 불가</span>
                        </div>
                        <div class="text-sm text-gray-700">${scoreOrMessage}</div>
                    </div>
                `;
                break;
                
            case 'error':
            default:
                html = `
                    <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div class="flex items-center mb-2">
                            <i class="fas fa-exclamation-triangle text-red-600 mr-2"></i>
                            <span class="font-semibold text-red-800">오류</span>
                        </div>
                        <div class="text-sm text-red-700">${scoreOrMessage}</div>
                    </div>
                `;
                break;
        }
        
        resultContainer.innerHTML = html;
        resultContainer.style.display = 'block';
        
        // 신고 버튼 이벤트 리스너 추가
        const reportButton = document.getElementById('reportSite');
        if (reportButton) {
            reportButton.addEventListener('click', () => {
                this.showReportModal();
            });
        }
    }

    async saveAnalysisResult(url, riskScore, riskFactors) {
        try {
            const analysisData = {
                url: url,
                risk_score: riskScore,
                risk_factors: riskFactors.join(', '),
                user_agent: navigator.userAgent,
                scan_timestamp: new Date().toISOString()
            };
            
            // 로컬 스토리지에 저장 (API 연동 전까지 임시)
            const existingData = JSON.parse(localStorage.getItem('clearnet_scans') || '[]');
            existingData.push(analysisData);
            
            // 최대 100개 기록 유지
            if (existingData.length > 100) {
                existingData.splice(0, existingData.length - 100);
            }
            
            localStorage.setItem('clearnet_scans', JSON.stringify(existingData));
            
            // 실제 API 호출 (서버가 있을 때)
            /*
            await fetch(`${this.apiBaseUrl}/url_analysis`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(analysisData)
            });
            */
            
        } catch (error) {
            console.error('분석 결과 저장 오류:', error);
        }
    }

    updateProtectionStatus() {
        const protectionStatus = document.getElementById('protectionStatus');
        const toggleProtection = document.getElementById('toggleProtection');
        
        // 로컬 스토리지에서 보호 상태 확인
        const isProtectionEnabled = localStorage.getItem('clearnet_protection') !== 'false';
        
        if (protectionStatus) {
            if (isProtectionEnabled) {
                protectionStatus.innerHTML = `
                    <div class="flex items-center text-green-600">
                        <i class="fas fa-shield-alt mr-2"></i>
                        <span class="font-semibold">보호 활성화됨</span>
                    </div>
                `;
            } else {
                protectionStatus.innerHTML = `
                    <div class="flex items-center text-red-600">
                        <i class="fas fa-shield-alt mr-2"></i>
                        <span class="font-semibold">보호 비활성화됨</span>
                    </div>
                `;
            }
        }
        
        if (toggleProtection) {
            toggleProtection.textContent = isProtectionEnabled ? '보호 끄기' : '보호 켜기';
            toggleProtection.className = `w-full px-4 py-2 rounded font-medium transition-colors ${
                isProtectionEnabled 
                    ? 'bg-red-600 text-white hover:bg-red-700' 
                    : 'bg-green-600 text-white hover:bg-green-700'
            }`;
        }
    }

    async loadQuickStats() {
        try {
            // 로컬 스토리지에서 통계 로드
            const scanHistory = JSON.parse(localStorage.getItem('clearnet_scans') || '[]');
            
            const totalScans = scanHistory.length;
            const threatsBlocked = scanHistory.filter(scan => scan.risk_score > 70).length;
            const todayScans = scanHistory.filter(scan => {
                const scanDate = new Date(scan.scan_timestamp).toDateString();
                const today = new Date().toDateString();
                return scanDate === today;
            }).length;
            
            // UI 업데이트
            const elements = {
                'totalScans': totalScans.toLocaleString(),
                'threatsBlocked': threatsBlocked.toLocaleString(),
                'todayScans': todayScans.toLocaleString()
            };
            
            Object.entries(elements).forEach(([id, value]) => {
                const element = document.getElementById(id);
                if (element) {
                    element.textContent = value;
                }
            });
            
        } catch (error) {
            console.error('통계 로드 오류:', error);
        }
    }

    setupEventListeners() {
        // 페이지 스캔 버튼
        const scanButton = document.getElementById('scanCurrentPage');
        if (scanButton) {
            scanButton.addEventListener('click', () => {
                this.scanCurrentPage();
            });
        }
        
        // 보호 토글 버튼
        const toggleButton = document.getElementById('toggleProtection');
        if (toggleButton) {
            toggleButton.addEventListener('click', () => {
                this.toggleProtection();
            });
        }
        
        // 메인 앱 열기 버튼
        const openMainApp = document.getElementById('openMainApp');
        if (openMainApp) {
            openMainApp.addEventListener('click', () => {
                // 새 탭에서 메인 앱 열기
                if (typeof chrome !== 'undefined' && chrome.tabs) {
                    chrome.tabs.create({ url: 'index.html' });
                } else {
                    window.open('index.html', '_blank');
                }
            });
        }
        
        // 설정 버튼
        const settingsButton = document.getElementById('openSettings');
        if (settingsButton) {
            settingsButton.addEventListener('click', () => {
                this.showSettingsModal();
            });
        }
        
        // 도움말 버튼
        const helpButton = document.getElementById('openHelp');
        if (helpButton) {
            helpButton.addEventListener('click', () => {
                this.showHelpModal();
            });
        }
    }

    toggleProtection() {
        const currentStatus = localStorage.getItem('clearnet_protection') !== 'false';
        const newStatus = !currentStatus;
        
        localStorage.setItem('clearnet_protection', newStatus.toString());
        
        // UI 업데이트
        this.updateProtectionStatus();
        
        // 알림 표시
        this.showNotification(
            newStatus ? '실시간 보호가 활성화되었습니다.' : '실시간 보호가 비활성화되었습니다.',
            newStatus ? 'success' : 'warning'
        );
        
        // 콘텐츠 스크립트에 상태 변경 전달
        this.notifyContentScript(newStatus);
    }

    notifyContentScript(protectionEnabled) {
        try {
            if (typeof chrome !== 'undefined' && chrome.tabs && this.currentTab) {
                chrome.tabs.sendMessage(this.currentTab.id, {
                    action: 'updateProtection',
                    enabled: protectionEnabled
                });
            }
        } catch (error) {
            console.error('콘텐츠 스크립트 알림 오류:', error);
        }
    }

    showReportModal() {
        // 간단한 신고 모달 표시
        const modal = document.getElementById('reportModal');
        if (modal) {
            modal.style.display = 'flex';
            
            // 현재 URL을 신고 폼에 자동 입력
            const urlInput = document.getElementById('reportModalUrl');
            if (urlInput && this.currentTab) {
                urlInput.value = this.currentTab.url;
            }
        }
    }

    showSettingsModal() {
        const modal = document.getElementById('settingsModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    showHelpModal() {
        const modal = document.getElementById('helpModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    showNotification(message, type = 'info') {
        // 팝업 내 알림 표시
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-3 rounded shadow-lg z-50 text-sm ${
            type === 'success' ? 'bg-green-500 text-white' :
            type === 'warning' ? 'bg-yellow-500 text-white' :
            type === 'error' ? 'bg-red-500 text-white' :
            'bg-blue-500 text-white'
        }`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // 팝업 종료 시 정리
    destroy() {
        // 이벤트 리스너 정리 등
        console.log('팝업 관리자 정리 중...');
    }
}

// 전역 인스턴스
let popupManager = null;

// DOM 로드 후 초기화
document.addEventListener('DOMContentLoaded', () => {
    popupManager = new PopupManager();
});

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
    if (popupManager) {
        popupManager.destroy();
    }
});

// Chrome Extension 메시지 리스너 (확장 프로그램용)
if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'updateScanResult' && popupManager) {
            popupManager.showScanResult(
                request.level, 
                request.score, 
                request.factors
            );
        }
        sendResponse({ success: true });
    });
}
