Page({
  data: {
    url: 'https://werewolfjudge.eu.org/'
  },
  onMessage(e) {
    console.log('web-view message:', e.detail.data)
  },
  onError(e) {
    console.error('web-view load error:', e.detail)
  },
  onShareAppMessage() {
    return {
      title: '狼人杀电子法官 - 扫码加入房间',
      path: '/pages/index/index'
    }
  }
})
