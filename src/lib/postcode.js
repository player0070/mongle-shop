// 카카오(다음) 우편번호 서비스 - API 키 없이 사용 가능
const SRC = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
let loading = null

function loadScript() {
  if (window.daum?.Postcode) return Promise.resolve()
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = SRC
      script.onload = resolve
      script.onerror = () => {
        loading = null
        reject(new Error('주소검색을 불러오지 못했습니다.'))
      }
      document.head.appendChild(script)
    })
  }
  return loading
}

// 선택한 주소를 { zipcode, address } 로 돌려줍니다. 창을 닫으면 null.
export async function searchAddress() {
  await loadScript()
  return new Promise((resolve) => {
    let done = false
    new window.daum.Postcode({
      oncomplete(data) {
        done = true
        let address = data.userSelectedType === 'J' ? data.jibunAddress : data.roadAddress
        if (data.userSelectedType !== 'J' && data.buildingName && data.apartment === 'Y') {
          address += ` (${data.buildingName})`
        }
        resolve({ zipcode: data.zonecode, address })
      },
      onclose() {
        if (!done) resolve(null)
      },
    }).open()
  })
}
