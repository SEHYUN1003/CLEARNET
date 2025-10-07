/**
 * ClearNet - 온라인 기만 행위 탐지 엔진
 * 피싱, 스캠, 악성 링크 등을 탐지하는 클라이언트사이드 분석 도구
 */

class FraudDetector {
    constructor() {
        this.knownMaliciousPatterns = [
            // 피싱 관련 패턴
            /(?:secure|account|verify|update|confirm|suspended|locked|expired).*(?:paypal|amazon|apple|microsoft|google|facebook|instagram|twitter|bank|credit)/i,
            /(?:login|signin|account).*(?:verify|confirm|update|suspended|security)/i,
            /(?:click|visit|go).*(?:here|now|immediately|urgent|asap)/i,
            
            // 스캠 관련 패턴
            /(?:free|win|winner|congratulations|selected|chosen).*(?:money|cash|prize|gift|reward)/i,
            /(?:urgent|immediate|limited|expire|act now|don't miss)/i,
            /(?:bitcoin|crypto|investment|trading|profit|earn).*(?:guaranteed|easy|quick|instant)/i,
            
            // 의심스러운 도메인 패턴
            /[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/,  // IP 주소
            /[a-z]{2,}\.(tk|ml|ga|cf|pw|top|click|download)/i,  // 의심스러운 TLD
            /[a-z]+-[a-z]+-[a-z]+\.(com|net|org)/i,  // 다중 하이픈 도메인
        ];

        this.trustedDomains = [
            'google.com', 'youtube.com', 'facebook.com', 'instagram.com', 
            'twitter.com', 'linkedin.com', 'github.com', 'stackoverflow.com',
            'wikipedia.org', 'mozilla.org', 'w3.org', 'naver.com', 'daum.net',
            'kakao.com', 'samsung.com', 'lg.com'
        ];

        this.suspiciousKeywords = [
            'verify account', 'suspended account', 'urgent action', 'click here',
            'free money', 'easy profit', 'guaranteed income', 'act now',
            'limited time', 'exclusive offer', 'congratulations winner',
            '무료 돈', '긴급 조치', '계정 정지', '계정 확인', '당첨',
            '무료 제공', '특별 혜택', '긴급'
        ];

        this.phishingIndicators = [
            'security alert', 'account verification', 'confirm identity',
            'update payment', 'billing issue', 'suspicious activity',
            '보안 경고', '계정 인증', '신원 확인', '결제 업데이트', '의심스러운 활동'
        ];
    }

    /**
     * URL 종합 분석
     * @param {string} url - 분석할 URL
     * @returns {Object} 분석 결과
     */
    async analyzeUrl(url) {
        try {
            const analysis = {
                url: url,
                riskLevel: 'safe',
                riskScore: 0,
                threats: [],
                recommendations: [],
                details: {},
                timestamp: new Date().toISOString()
            };

            // URL 유효성 검사
            if (!this.isValidUrl(url)) {
                analysis.riskLevel = 'high';
                analysis.riskScore = 90;
                analysis.threats.push('잘못된 URL 형식');
                return analysis;
            }

            const urlObj = new URL(url);
            
            // 도메인 분석
            const domainAnalysis = this.analyzeDomain(urlObj.hostname);
            analysis.details.domain = domainAnalysis;
            analysis.riskScore += domainAnalysis.riskScore;

            // URL 구조 분석
            const urlStructureAnalysis = this.analyzeUrlStructure(url);
            analysis.details.urlStructure = urlStructureAnalysis;
            analysis.riskScore += urlStructureAnalysis.riskScore;

            // 프로토콜 분석
            const protocolAnalysis = this.analyzeProtocol(urlObj.protocol);
            analysis.details.protocol = protocolAnalysis;
            analysis.riskScore += protocolAnalysis.riskScore;

            // 의심스러운 패턴 검사
            const patternAnalysis = this.analyzePatterns(url);
            analysis.details.patterns = patternAnalysis;
            analysis.riskScore += patternAnalysis.riskScore;

            // 위험도 레벨 결정
            if (analysis.riskScore >= 70) {
                analysis.riskLevel = 'high';
            } else if (analysis.riskScore >= 40) {
                analysis.riskLevel = 'medium';
            } else if (analysis.riskScore >= 20) {
                analysis.riskLevel = 'low';
            } else {
                analysis.riskLevel = 'safe';
            }

            // 위협 요소 수집
            this.collectThreats(analysis);
            
            // 권장사항 생성
            this.generateRecommendations(analysis);

            return analysis;

        } catch (error) {
            console.error('URL 분석 중 오류 발생:', error);
            return {
                url: url,
                riskLevel: 'high',
                riskScore: 100,
                threats: ['URL 분석 실패'],
                recommendations: ['다른 URL을 시도해보세요'],
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * URL 유효성 검사
     */
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 도메인 분석
     */
    analyzeDomain(hostname) {
        const analysis = {
            hostname: hostname,
            riskScore: 0,
            flags: [],
            isTrusted: false,
            isSuspicious: false
        };

        // 신뢰할 수 있는 도메인 체크
        const isTrusted = this.trustedDomains.some(domain => 
            hostname === domain || hostname.endsWith('.' + domain)
        );
        
        if (isTrusted) {
            analysis.isTrusted = true;
            analysis.riskScore = 0;
            analysis.flags.push('신뢰할 수 있는 도메인');
            return analysis;
        }

        // IP 주소 체크
        if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
            analysis.riskScore += 30;
            analysis.flags.push('IP 주소 사용 (의심)');
            analysis.isSuspicious = true;
        }

        // 의심스러운 TLD 체크
        if (/\.(tk|ml|ga|cf|pw|top|click|download)$/i.test(hostname)) {
            analysis.riskScore += 25;
            analysis.flags.push('의심스러운 도메인 확장자');
            analysis.isSuspicious = true;
        }

        // 다중 하이픈 도메인 체크
        const hyphenCount = (hostname.match(/-/g) || []).length;
        if (hyphenCount >= 3) {
            analysis.riskScore += 20;
            analysis.flags.push('과도한 하이픈 사용');
        }

        // 서브도메인 깊이 체크
        const subdomainDepth = hostname.split('.').length;
        if (subdomainDepth > 4) {
            analysis.riskScore += 15;
            analysis.flags.push('복잡한 서브도메인 구조');
        }

        // 도메인 길이 체크
        if (hostname.length > 50) {
            analysis.riskScore += 10;
            analysis.flags.push('비정상적으로 긴 도메인');
        }

        return analysis;
    }

    /**
     * URL 구조 분석
     */
    analyzeUrlStructure(url) {
        const analysis = {
            riskScore: 0,
            flags: [],
            pathLength: 0,
            parameterCount: 0,
            hasRedirect: false
        };

        const urlObj = new URL(url);
        
        // 경로 길이 체크
        analysis.pathLength = urlObj.pathname.length;
        if (analysis.pathLength > 100) {
            analysis.riskScore += 15;
            analysis.flags.push('비정상적으로 긴 경로');
        }

        // 매개변수 개수 체크
        analysis.parameterCount = urlObj.searchParams.size;
        if (analysis.parameterCount > 10) {
            analysis.riskScore += 10;
            analysis.flags.push('과도한 매개변수');
        }

        // 리다이렉트 의심 매개변수
        const redirectParams = ['redirect', 'url', 'return', 'goto', 'next', 'continue'];
        for (const param of redirectParams) {
            if (urlObj.searchParams.has(param)) {
                analysis.hasRedirect = true;
                analysis.riskScore += 20;
                analysis.flags.push('리다이렉트 매개변수 발견');
                break;
            }
        }

        // URL 인코딩된 문자 체크
        const encodedChars = url.match(/%[0-9A-F]{2}/gi) || [];
        if (encodedChars.length > 5) {
            analysis.riskScore += 15;
            analysis.flags.push('과도한 URL 인코딩');
        }

        return analysis;
    }

    /**
     * 프로토콜 분석
     */
    analyzeProtocol(protocol) {
        const analysis = {
            protocol: protocol,
            riskScore: 0,
            flags: [],
            isSecure: false
        };

        if (protocol === 'https:') {
            analysis.isSecure = true;
            analysis.flags.push('보안 연결 (HTTPS)');
        } else if (protocol === 'http:') {
            analysis.riskScore += 10;
            analysis.flags.push('비보안 연결 (HTTP)');
        } else {
            analysis.riskScore += 30;
            analysis.flags.push(`비표준 프로토콜: ${protocol}`);
        }

        return analysis;
    }

    /**
     * 의심스러운 패턴 분석
     */
    analyzePatterns(url) {
        const analysis = {
            riskScore: 0,
            flags: [],
            matchedPatterns: []
        };

        // 알려진 악성 패턴 체크
        for (let i = 0; i < this.knownMaliciousPatterns.length; i++) {
            const pattern = this.knownMaliciousPatterns[i];
            if (pattern.test(url)) {
                analysis.riskScore += 25;
                analysis.matchedPatterns.push(`패턴 ${i + 1} 매치`);
                analysis.flags.push('알려진 악성 패턴 발견');
                break;
            }
        }

        // 의심스러운 키워드 체크
        const urlLower = url.toLowerCase();
        let keywordMatches = 0;
        for (const keyword of this.suspiciousKeywords) {
            if (urlLower.includes(keyword.toLowerCase())) {
                keywordMatches++;
                analysis.matchedPatterns.push(`키워드: ${keyword}`);
            }
        }

        if (keywordMatches > 0) {
            analysis.riskScore += keywordMatches * 10;
            analysis.flags.push(`의심스러운 키워드 ${keywordMatches}개 발견`);
        }

        // 피싱 지표 체크
        let phishingMatches = 0;
        for (const indicator of this.phishingIndicators) {
            if (urlLower.includes(indicator.toLowerCase())) {
                phishingMatches++;
                analysis.matchedPatterns.push(`피싱 지표: ${indicator}`);
            }
        }

        if (phishingMatches > 0) {
            analysis.riskScore += phishingMatches * 15;
            analysis.flags.push(`피싱 지표 ${phishingMatches}개 발견`);
        }

        return analysis;
    }

    /**
     * 위협 요소 수집
     */
    collectThreats(analysis) {
        const threats = [];

        if (analysis.details.domain?.isSuspicious) {
            threats.push('의심스러운 도메인');
        }

        if (analysis.details.protocol?.riskScore > 0) {
            threats.push('보안되지 않은 연결');
        }

        if (analysis.details.patterns?.matchedPatterns.length > 0) {
            threats.push('악성 패턴 감지');
        }

        if (analysis.details.urlStructure?.hasRedirect) {
            threats.push('의심스러운 리다이렉트');
        }

        if (analysis.riskScore >= 70) {
            threats.push('고위험 사이트로 분류');
        } else if (analysis.riskScore >= 40) {
            threats.push('중위험 사이트로 분류');
        }

        analysis.threats = threats;
    }

    /**
     * 권장사항 생성
     */
    generateRecommendations(analysis) {
        const recommendations = [];

        if (analysis.riskLevel === 'high') {
            recommendations.push('이 사이트를 방문하지 마세요');
            recommendations.push('개인정보를 절대 입력하지 마세요');
            recommendations.push('이 링크를 다른 사람과 공유하지 마세요');
        } else if (analysis.riskLevel === 'medium') {
            recommendations.push('주의해서 이용하세요');
            recommendations.push('개인정보 입력 시 각별히 주의하세요');
            recommendations.push('URL을 다시 한 번 확인하세요');
        } else if (analysis.riskLevel === 'low') {
            recommendations.push('일반적인 주의사항을 지켜주세요');
            recommendations.push('개인정보 보호에 유의하세요');
        } else {
            recommendations.push('안전한 사이트입니다');
            recommendations.push('정상적으로 이용하실 수 있습니다');
        }

        if (!analysis.details.protocol?.isSecure) {
            recommendations.push('HTTPS 연결을 사용하는 사이트를 이용하세요');
        }

        analysis.recommendations = recommendations;
    }

    /**
     * 실시간 위험도 평가
     */
    getRiskLevel(score) {
        if (score >= 70) return { level: 'high', color: 'red', text: '고위험' };
        if (score >= 40) return { level: 'medium', color: 'yellow', text: '중위험' };
        if (score >= 20) return { level: 'low', color: 'orange', text: '저위험' };
        return { level: 'safe', color: 'green', text: '안전' };
    }

    /**
     * 분석 결과를 JSON으로 내보내기
     */
    exportAnalysis(analysis) {
        return JSON.stringify(analysis, null, 2);
    }
}

// 전역 인스턴스 생성
window.fraudDetector = new FraudDetector();
