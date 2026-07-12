const BACKEND = 'https://web-production-00104.up.railway.app';

export const portfolioLinks = [
  { key: 'github_url', label: 'GitHub' },
  { key: 'blog_url', label: 'Blog' },
  { key: 'notion_url', label: 'Notion' },
];

export const portfolioSections = [
  { key: 'intro', label: '자기소개', placeholder: '관심 분야, 성격, 작업 방식이 드러나게 작성하세요.' },
  { key: 'projects', label: '프로젝트', placeholder: '프로젝트명, 기간, 역할, 사용 기술, 결과를 정리하세요.' },
  { key: 'skills', label: '역량 / 기술', placeholder: '언어, 프레임워크, 협업 도구, 강점을 나눠 적으세요.' },
  { key: 'awards', label: '수상 / 활동', placeholder: '대회, 활동, 맡은 역할과 결과를 함께 기록하세요.' },
  { key: 'goals', label: '목표 / 진로', placeholder: '앞으로 만들고 싶은 것과 진로 방향을 작성하세요.' },
];

export const resolvePortfolioFileUrl = (value = '') => (value?.startsWith('/api') ? `${BACKEND}${value}` : value);

export const buildPortfolioShareUrl = (userId) => {
  if (!userId || typeof window === 'undefined') return '';
  return `${window.location.origin}/portfolio/share/${encodeURIComponent(userId)}`;
};

export const buildQrImageUrl = (value) => (
  value
    ? `https://api.qrserver.com/v1/create-qr-code/?size=168x168&margin=12&data=${encodeURIComponent(value)}`
    : ''
);
