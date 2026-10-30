import PolicyPage from '../components/PolicyPage'
import { CONTACT_EMAIL, PAYMENT_DEADLINE_HOURS } from '../config/shop'

const sections = [
  {
    title: '수집하는 개인정보 항목',
    body: [
      'MONGLE은 회원가입 없이 비회원 주문만 받으며, 주문 시 아래 정보만 수집합니다.',
      ['주문자 이름', '휴대폰 번호', '입금자명', '배송지 주소(우편번호, 주소, 상세주소)'],
    ],
  },
  {
    title: '수집 · 이용 목적',
    body: [
      ['주문 접수 및 계좌이체 입금 확인', '상품 배송 및 배송 관련 연락', '비회원 주문조회(주문번호 + 휴대폰 번호 확인)'],
      '위 목적 외의 용도(광고, 마케팅 등)로는 이용하지 않습니다.',
    ],
  },
  {
    title: '보유 및 이용 기간',
    body: [
      'MONGLE은 rookie 창업 동아리 활동의 일환으로 단기간 운영되는 쇼핑몰입니다.',
      '수집한 개인정보는 동아리 활동이 끝나는 즉시 지체 없이 파기합니다.',
    ],
  },
  {
    title: '파기 절차 및 방법',
    body: ['동아리 활동 종료 시 주문 데이터베이스에 저장된 개인정보를 복구할 수 없는 방법으로 삭제합니다. 종이 등으로 출력한 정보가 있다면 분쇄하여 파기합니다.'],
  },
  {
    title: '제3자 제공',
    body: ['수집한 개인정보를 외부에 제공하지 않습니다.'],
  },
  {
    title: '처리 위탁',
    body: [
      '주문 정보 저장을 위해 아래 서비스를 이용합니다.',
      ['Supabase Inc. — 주문 데이터베이스 및 서버 운영', '카카오(Daum) 우편번호 서비스 — 배송지 주소 검색'],
    ],
  },
  {
    title: '동의를 거부할 권리',
    body: [`개인정보 수집 · 이용에 동의하지 않을 수 있습니다. 다만 동의하지 않으면 주문 처리와 배송이 불가능하여 주문하실 수 없습니다. (주문 후 ${PAYMENT_DEADLINE_HOURS}시간 안에 입금되지 않아 자동 취소된 주문의 정보도 같은 기준으로 파기합니다.)`],
  },
  {
    title: '이용자의 권리',
    body: ['이용자는 언제든지 본인의 개인정보 열람, 정정, 삭제를 요청할 수 있습니다. 아래 문의처로 주문번호와 함께 요청해주시면 지체 없이 처리합니다.'],
  },
  {
    title: '문의처',
    body: [`운영: rookie 창업 동아리 · 이메일 ${CONTACT_EMAIL}`],
  },
]

export default function Privacy() {
  return (
    <PolicyPage
      eyebrow="PRIVACY POLICY"
      title="개인정보처리방침"
      effectiveDate="2026년 10월 30일"
      intro="MONGLE은 rookie 창업 동아리 활동으로 단기간 운영되며, 주문에 꼭 필요한 정보만 수집하고 동아리 활동이 끝나는 즉시 파기합니다."
      sections={sections}
    />
  )
}
