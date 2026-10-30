import PolicyPage from '../components/PolicyPage'
import { CONTACT_EMAIL, DELIVERY_NOTICE, PAYMENT_DEADLINE_HOURS } from '../config/shop'

const sections = [
  {
    title: '목적',
    body: ['이 약관은 rookie 창업 동아리가 운영하는 MONGLE 쇼핑몰(이하 "쇼핑몰")에서 상품을 주문하고 이용하는 데 필요한 사항을 정합니다.'],
  },
  {
    title: '운영 형태',
    body: [
      '쇼핑몰은 rookie 창업 동아리 활동의 일환으로 단기간 운영됩니다.',
      '동아리 활동이 끝나면 쇼핑몰 운영을 종료하며, 종료 전에 접수된 주문은 배송 또는 환불까지 책임지고 처리합니다.',
    ],
  },
  {
    title: '주문',
    body: [
      '회원가입 없이 비회원으로 주문할 수 있습니다. 주문 시 이름, 휴대폰 번호, 입금자명, 배송지 주소를 정확히 입력해야 합니다.',
      '주문이 접수되면 주문번호가 발급되며, 주문번호와 휴대폰 번호로 주문 상태를 조회할 수 있습니다.',
      '상품 재고가 부족하면 주문이 접수되지 않을 수 있습니다.',
    ],
  },
  {
    title: '결제',
    body: [
      '결제는 안내된 계좌로의 계좌이체로만 가능합니다. 입금자명과 금액이 주문 정보와 같아야 빠르게 확인됩니다.',
      `주문 후 ${PAYMENT_DEADLINE_HOURS}시간 안에 입금이 확인되지 않으면 주문은 자동으로 취소됩니다.`,
    ],
  },
  {
    title: '배송',
    body: [DELIVERY_NOTICE, '입금이 확인된 후 배송을 준비하며, 배송 진행 상황은 주문조회에서 확인할 수 있습니다.'],
  },
  {
    title: '취소 및 환불',
    body: [
      ['입금 전: 입금하지 않으면 기한이 지난 뒤 자동 취소됩니다. 바로 취소를 원하시면 문의처로 연락해주세요.', '입금 후 배송 전: 문의처로 요청하시면 주문을 취소하고 입금하신 계좌로 전액 환불합니다.', '상품을 받은 후: 받은 날부터 7일 이내에 교환 · 반품을 요청할 수 있습니다. 상품에 문제가 있는 경우가 아니라면 사용하거나 훼손된 상품은 교환 · 반품이 어려울 수 있습니다.'],
    ],
  },
  {
    title: '개인정보',
    body: ['주문 과정에서 수집한 개인정보는 개인정보처리방침에 따라 처리하며, 동아리 활동이 끝나는 즉시 파기합니다.'],
  },
  {
    title: '문의처',
    body: [`주문, 취소, 환불 관련 문의: ${CONTACT_EMAIL}`],
  },
]

export default function Terms() {
  return (
    <PolicyPage
      eyebrow="TERMS OF SERVICE"
      title="이용약관"
      effectiveDate="2026년 10월 30일"
      sections={sections}
    />
  )
}
