import { useLocation, useNavigate } from 'react-router-dom'

// 쇼핑몰 안에서 이동해 왔으면 바로 전 페이지로, 링크로 바로 들어와 이전 페이지가 없으면 홈으로 보냅니다.
// (react-router는 처음 연 페이지의 location.key를 'default'로 둡니다)
export function useGoBack() {
  const navigate = useNavigate()
  const location = useLocation()
  return () => (location.key === 'default' ? navigate('/', { replace: true }) : navigate(-1))
}
