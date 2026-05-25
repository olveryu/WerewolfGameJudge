var BASE_URL = 'https://werewolfgamejudge.pages.dev/'
var API_URL = 'https://api.werewolfjudge.eu.org'

Page({
  data: {
    url: '',
    splashBg: '/images/splash-bg.webp'
  },

  onLoad(options) {
    var self = this

    wx.setKeepScreenOn({ keepScreenOn: true })

    // 1) 确定目标页面 URL — 分享链接走 options.url，否则一律首页
    var targetUrl = options.url ? decodeURIComponent(options.url) : BASE_URL

    // nonce claim 流程：wx.login + wx.request 预备 token，然后加载裸 URL
    if (options.nonce) {
      wx.login({
        success: function (res) {
          if (res.code) {
            wx.request({
              url: API_URL + '/auth/wechat-claim',
              method: 'POST',
              header: { 'Content-Type': 'application/json' },
              data: { code: res.code, nonce: options.nonce },
              success: function (resp) {
                if (resp.statusCode === 200) {
                  console.log('wechat-claim success')
                } else {
                  console.warn('wechat-claim failed:', resp.statusCode, resp.data)
                }
                self.setData({ url: targetUrl })
              },
              fail: function (err) {
                console.warn('wechat-claim request failed:', err)
                self.setData({ url: targetUrl })
              }
            })
          } else {
            console.warn('wx.login failed:', res.errMsg)
            self.setData({ url: targetUrl })
          }
        },
        fail: function () {
          self.setData({ url: targetUrl })
        }
      })
    } else {
      // 无 nonce（首次打开 / 分享链接）→ 直接加载，web 端显示登录按钮
      self.setData({ url: targetUrl })
    }
  },

  onMessage(_e) {
    // No-op — lastUrl restoration removed; share links use options.url
  },

  onError(e) {
    console.error('web-view load error:', e.detail)
  },

  onShareAppMessage(options) {
    var webViewUrl = options.webViewUrl || ''
    var match = webViewUrl.match(/\/room\/([A-Za-z0-9]+)/)
    if (match) {
      return {
        title: '来一起玩狼人杀！房间 ' + match[1],
        path: '/pages/index/index?url=' + encodeURIComponent(webViewUrl)
      }
    }
    return {
      title: '狼人面杀电子裁判助手',
      path: '/pages/index/index'
    }
  },

  onShareTimeline() {
    return {
      title: '狼人面杀电子裁判助手',
      query: ''
    }
  },

  onAddToFavorites() {
    return {
      title: '狼人面杀电子裁判助手',
      query: ''
    }
  }
})
