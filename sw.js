/**
 * ClearNet PWA Service Worker
 * 오프라인 기능 및 캐싱 관리
 */

const CACHE_NAME = 'clearnet-v1.0.0';
const STATIC_CACHE = 'clearnet-static-v1';
const DYNAMIC_CACHE = 'clearnet-dynamic-v1';

// 캐싱할 정적 파일들
const STATIC_FILES = [
  '/',
  '/index.html',
  '/popup.html',
  '/css/style.css',
  '/css/content.css',
  '/js/app.js',
  '/js/detector.js',
  '/js/dashboard.js',
  '/js/popup.js',
  '/manifest-pwa.json',
  // CDN 파일들
  'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css',
  'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// 오프라인 페이지
const OFFLINE_PAGE = '/offline.html';

/**
 * Service Worker 설치
 */
self.addEventListener('install', (event) => {
  console.log('ClearNet Service Worker 설치 중...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('정적 파일 캐싱 중...');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('ClearNet Service Worker 설치 완료');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker 설치 실패:', error);
      })
  );
});

/**
 * Service Worker 활성화
 */
self.addEventListener('activate', (event) => {
  console.log('ClearNet Service Worker 활성화 중...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // 오래된 캐시 삭제
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('오래된 캐시 삭제:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('ClearNet Service Worker 활성화 완료');
        return self.clients.claim();
      })
  );
});

/**
 * 네트워크 요청 가로채기
 */
self.addEventListener('fetch', (event) => {
  // API 요청은 캐시하지 않음
  if (event.request.url.includes('/tables/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return new Response(JSON.stringify({
            error: '오프라인 상태입니다. 인터넷 연결을 확인해주세요.'
          }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 캐시에 있으면 캐시된 응답 반환
        if (response) {
          return response;
        }

        // 네트워크에서 가져오기 시도
        return fetch(event.request)
          .then((fetchResponse) => {
            // 유효한 응답인지 확인
            if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
              return fetchResponse;
            }

            // 동적 캐시에 저장
            const responseToCache = fetchResponse.clone();
            caches.open(DYNAMIC_CACHE)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return fetchResponse;
          })
          .catch(() => {
            // 오프라인이고 HTML 페이지 요청인 경우
            if (event.request.destination === 'document') {
              return caches.match(OFFLINE_PAGE);
            }

            // 기타 리소스는 기본 오프라인 응답
            return new Response('오프라인 상태입니다.', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

/**
 * 백그라운드 동기화
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

/**
 * 푸시 알림 수신
 */
self.addEventListener('push', (event) => {
  console.log('푸시 메시지 수신:', event);

  const options = {
    body: event.data ? event.data.text() : '새로운 보안 경고가 있습니다.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: '확인',
        icon: '/icons/checkmark.png'
      },
      {
        action: 'close',
        title: '닫기',
        icon: '/icons/xmark.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('ClearNet 보안 알림', options)
  );
});

/**
 * 알림 클릭 처리
 */
self.addEventListener('notificationclick', (event) => {
  console.log('알림 클릭:', event);

  event.notification.close();

  if (event.action === 'explore') {
    // 앱 열기
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'close') {
    // 알림만 닫기
    event.notification.close();
  } else {
    // 기본 동작 - 앱 포커스
    event.waitUntil(
      clients.matchAll()
        .then((clientList) => {
          for (const client of clientList) {
            if (client.url === '/' && 'focus' in client) {
              return client.focus();
            }
          }
          if (clients.openWindow) {
            return clients.openWindow('/');
          }
        })
    );
  }
});

/**
 * 백그라운드 동기화 작업
 */
async function doBackgroundSync() {
  try {
    // 오프라인 중에 저장된 데이터 동기화
    const offlineData = await getOfflineData();

    if (offlineData.length > 0) {
      console.log('오프라인 데이터 동기화 중...', offlineData.length, '개');

      for (const data of offlineData) {
        try {
          await fetch(data.url, {
            method: data.method,
            headers: data.headers,
            body: data.body
          });

          // 성공적으로 동기화된 데이터 제거
          await removeOfflineData(data.id);

        } catch (error) {
          console.error('데이터 동기화 실패:', error);
        }
      }

      console.log('백그라운드 동기화 완료');
    }

  } catch (error) {
    console.error('백그라운드 동기화 오류:', error);
  }
}

/**
 * 오프라인 데이터 가져오기
 */
async function getOfflineData() {
  // IndexedDB에서 오프라인 중에 저장된 데이터 가져오기
  // 실제 구현에서는 IndexedDB 사용
  return [];
}

/**
 * 오프라인 데이터 제거
 */
async function removeOfflineData(id) {
  // IndexedDB에서 동기화된 데이터 제거
  console.log('오프라인 데이터 제거:', id);
}
